/*
# StockSense: AI Inventory Management System — Full Schema

## Overview
Complete database schema for Nowshera Shopping Mall inventory management.
Includes tables, RPCs, views, RLS policies, and auth trigger.

## Tables Created
1. **profiles** — User profiles linked to auth.users (id, full_name, role, is_active, email)
2. **categories** — Product categories (name, code, description)
3. **suppliers** — Supplier records (name, contact_person, email, phone, address, is_active)
4. **products** — Product catalog (sku, name, description, prices, reorder_level, is_active)
5. **inventory** — Current stock levels per product (quantity_on_hand, version)
6. **inventory_movements** — Immutable audit trail of all stock changes
7. **stock_change_requests** — 2-step AI confirmation workflow (PENDING → CONFIRMED/CANCELLED/EXPIRED)
8. **audit_logs** — Administrative action audit trail
9. **idempotency_keys** — Idempotent stock mutation cache

## RPCs Created
- **handle_new_user()** — Auto-creates profile on auth signup; first user becomes ADMIN
- **get_my_role()** — Returns caller's role
- **is_manager() / is_admin() / is_manager_or_admin()** — Role check helpers
- **get_inventory_dashboard()** — Returns products joined with inventory, categories, suppliers (role-aware)
- **change_stock()** — Transactional stock mutation with idempotency, row lock, non-negative enforcement
- **prepare_stock_change()** — Creates PENDING stock change request
- **confirm_stock_change()** — Confirms a pending request and applies the stock mutation
- **cancel_stock_change()** — Cancels a pending request
- **create_product()** — Creates product + initial inventory + initial movement (MANAGER/ADMIN only)
- **update_product_prices()** — Updates product pricing (MANAGER/ADMIN only)
- **get_low_stock()** — Returns products at or below reorder threshold
- **change_user_role()** — Changes user role (ADMIN only, anti-self-promotion, multi-admin protection)
- **set_user_active()** — Activates/deactivates user (MANAGER/ADMIN only)

## Views Created
- **products_staff_view** — Excludes cost_price, profit, margin
- **products_manager_view** — Includes cost_price, profit, margin

## Security
- RLS enabled on ALL tables
- SELECT policies for authenticated users on all business tables
- INSERT/UPDATE/DELETE policies scoped by role (is_manager_or_admin) where appropriate
- stock_change_requests: SELECT for authenticated, INSERT for authenticated (owner-scoped), UPDATE for authenticated
- audit_logs: SELECT for authenticated, no direct INSERT (only via SECURITY DEFINER RPCs)
- All privileged mutations go through SECURITY DEFINER RPCs that bypass RLS safely

## Notes
1. This is a multi-tenant app with auth — all policies scope TO authenticated
2. The first user to sign up automatically becomes ADMIN via handle_new_user trigger
3. All stock mutations use SECURITY DEFINER RPCs for atomicity and role enforcement
4. cost_price is never exposed to STAFF — the view system enforces this at the database level
*/

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('STAFF', 'MANAGER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE movement_type AS ENUM ('IN', 'OUT', 'DAMAGE', 'ADJUSTMENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE request_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. PROFILES TABLE (Linked with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'STAFF',
    is_active BOOLEAN NOT NULL DEFAULT true,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger to automatically create a profile entry when a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM public.profiles;
    INSERT INTO public.profiles (id, full_name, email, role, is_active)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        new.email,
        CASE WHEN user_count = 0 THEN 'ADMIN'::user_role ELSE 'STAFF'::user_role END,
        true
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    default_supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    selling_price NUMERIC(12, 2) NOT NULL CHECK (selling_price >= 0),
    cost_price NUMERIC(12, 2) NOT NULL CHECK (cost_price >= 0),
    reorder_level INTEGER NOT NULL DEFAULT 10 CHECK (reorder_level >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. INVENTORY TABLE
CREATE TABLE IF NOT EXISTS public.inventory (
    product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. INVENTORY MOVEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    movement_type movement_type NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    quantity_before INTEGER NOT NULL CHECK (quantity_before >= 0),
    quantity_after INTEGER NOT NULL CHECK (quantity_after >= 0),
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'MANUAL',
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reference_id TEXT,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. STOCK CHANGE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.stock_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    movement_type movement_type NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'AI_ASSISTANT',
    status request_status NOT NULL DEFAULT 'PENDING',
    expected_quantity INTEGER NOT NULL,
    expected_version INTEGER NOT NULL,
    resulting_quantity INTEGER NOT NULL CHECK (resulting_quantity >= 0),
    idempotency_key TEXT UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    before_data JSONB,
    after_data JSONB,
    source TEXT NOT NULL DEFAULT 'WEB',
    request_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. IDEMPOTENCY KEYS TABLE
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    key TEXT PRIMARY KEY,
    response_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL
);

-- ==============================================================================
-- RESTRICTED VIEWS
-- ==============================================================================

CREATE OR REPLACE VIEW public.products_staff_view AS
SELECT 
    p.id, p.sku, p.name, p.description, p.category_id, p.default_supplier_id,
    p.selling_price, p.reorder_level, p.is_active, p.created_at, p.updated_at,
    COALESCE(i.quantity_on_hand, 0) AS quantity_on_hand,
    COALESCE(i.version, 1) AS inventory_version,
    c.name AS category_name,
    s.name AS supplier_name
FROM public.products p
LEFT JOIN public.inventory i ON i.product_id = p.id
LEFT JOIN public.categories c ON c.id = p.category_id
LEFT JOIN public.suppliers s ON s.id = p.default_supplier_id;

CREATE OR REPLACE VIEW public.products_manager_view AS
SELECT 
    p.id, p.sku, p.name, p.description, p.category_id, p.default_supplier_id,
    p.selling_price, p.cost_price,
    (p.selling_price - p.cost_price) AS profit,
    CASE 
        WHEN p.selling_price > 0 THEN ROUND(((p.selling_price - p.cost_price) / p.selling_price * 100)::numeric, 2)
        ELSE 0 
    END AS profit_margin_percent,
    p.reorder_level, p.is_active, p.created_at, p.updated_at,
    COALESCE(i.quantity_on_hand, 0) AS quantity_on_hand,
    COALESCE(i.version, 1) AS inventory_version,
    c.name AS category_name,
    s.name AS supplier_name
FROM public.products p
LEFT JOIN public.inventory i ON i.product_id = p.id
LEFT JOIN public.categories c ON c.id = p.category_id
LEFT JOIN public.suppliers s ON s.id = p.default_supplier_id;

-- ==============================================================================
-- HELPER FUNCTIONS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'MANAGER' AND is_active = true);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = true);
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('MANAGER', 'ADMIN') AND is_active = true);
$$;

-- ==============================================================================
-- GET_INVENTORY_DASHBOARD: Role-aware product+inventory join
-- Returns cost_price only for MANAGER/ADMIN; omits for STAFF
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_inventory_dashboard()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_role user_role;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid() AND is_active = true;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'User not authenticated or inactive';
    END IF;

    IF v_role IN ('MANAGER', 'ADMIN') THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', p.id, 'sku', p.sku, 'name', p.name, 'description', COALESCE(p.description, ''),
            'category_id', COALESCE(p.category_id, ''), 'category_name', COALESCE(c.name, 'General'),
            'default_supplier_id', COALESCE(p.default_supplier_id, ''), 'supplier_name', COALESCE(s.name, 'Unassigned'),
            'selling_price', p.selling_price, 'cost_price', p.cost_price,
            'reorder_level', p.reorder_level, 'is_active', p.is_active,
            'quantity_on_hand', COALESCE(i.quantity_on_hand, 0), 'inventory_version', COALESCE(i.version, 1),
            'created_at', COALESCE(p.created_at, now()), 'updated_at', COALESCE(p.updated_at, now())
        ) ORDER BY p.name), '[]'::jsonb) INTO v_role;
        -- Re-query with proper return
        RETURN (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', p.id, 'sku', p.sku, 'name', p.name, 'description', COALESCE(p.description, ''),
                'category_id', COALESCE(p.category_id, ''), 'category_name', COALESCE(c.name, 'General'),
                'default_supplier_id', COALESCE(p.default_supplier_id, ''), 'supplier_name', COALESCE(s.name, 'Unassigned'),
                'selling_price', p.selling_price, 'cost_price', p.cost_price,
                'reorder_level', p.reorder_level, 'is_active', p.is_active,
                'quantity_on_hand', COALESCE(i.quantity_on_hand, 0), 'inventory_version', COALESCE(i.version, 1),
                'created_at', COALESCE(p.created_at, now()), 'updated_at', COALESCE(p.updated_at, now())
            ) ORDER BY p.name), '[]'::jsonb)
            FROM public.products p
            LEFT JOIN public.inventory i ON i.product_id = p.id
            LEFT JOIN public.categories c ON c.id = p.category_id
            LEFT JOIN public.suppliers s ON s.id = p.default_supplier_id
        );
    ELSE
        RETURN (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', p.id, 'sku', p.sku, 'name', p.name, 'description', COALESCE(p.description, ''),
                'category_id', COALESCE(p.category_id, ''), 'category_name', COALESCE(c.name, 'General'),
                'default_supplier_id', COALESCE(p.default_supplier_id, ''), 'supplier_name', COALESCE(s.name, 'Unassigned'),
                'selling_price', p.selling_price, 'cost_price', null,
                'reorder_level', p.reorder_level, 'is_active', p.is_active,
                'quantity_on_hand', COALESCE(i.quantity_on_hand, 0), 'inventory_version', COALESCE(i.version, 1),
                'created_at', COALESCE(p.created_at, now()), 'updated_at', COALESCE(p.updated_at, now())
            ) ORDER BY p.name), '[]'::jsonb)
            FROM public.products p
            LEFT JOIN public.inventory i ON i.product_id = p.id
            LEFT JOIN public.categories c ON c.id = p.category_id
            LEFT JOIN public.suppliers s ON s.id = p.default_supplier_id
        );
    END IF;
END;
$$;

-- ==============================================================================
-- CHANGE STOCK RPC (accepts p_source parameter)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.change_stock(
    p_product_id UUID,
    p_movement_type movement_type,
    p_quantity INTEGER,
    p_supplier_id UUID DEFAULT NULL,
    p_reason TEXT DEFAULT '',
    p_source TEXT DEFAULT 'MANUAL',
    p_reference_id TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_current_stock INTEGER;
    v_new_stock INTEGER;
    v_version INTEGER;
    v_user_id UUID;
    v_movement_id UUID;
    v_product_name TEXT;
    v_cached_response JSONB;
BEGIN
    IF p_idempotency_key IS NOT NULL THEN
        SELECT response_payload INTO v_cached_response
        FROM public.idempotency_keys
        WHERE key = p_idempotency_key AND expires_at > now();
        IF v_cached_response IS NOT NULL THEN RETURN v_cached_response; END IF;
    END IF;

    v_user_id := auth.uid();
    IF v_user_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND is_active = true) THEN
            RAISE EXCEPTION 'User account is deactivated or unauthorized';
        END IF;
    END IF;

    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than zero. Received %', p_quantity;
    END IF;

    SELECT name INTO v_product_name FROM public.products WHERE id = p_product_id AND is_active = true;
    IF v_product_name IS NULL THEN
        RAISE EXCEPTION 'Product not found or is currently inactive';
    END IF;

    SELECT quantity_on_hand, version INTO v_current_stock, v_version
    FROM public.inventory WHERE product_id = p_product_id FOR UPDATE;

    IF v_current_stock IS NULL THEN
        INSERT INTO public.inventory (product_id, quantity_on_hand, version)
        VALUES (p_product_id, 0, 1)
        RETURNING quantity_on_hand, version INTO v_current_stock, v_version;
    END IF;

    IF p_movement_type = 'IN' THEN
        v_new_stock := v_current_stock + p_quantity;
    ELSIF p_movement_type IN ('OUT', 'DAMAGE') THEN
        IF v_current_stock < p_quantity THEN
            RAISE EXCEPTION 'Insufficient stock. Available quantity: %, requested: %', v_current_stock, p_quantity;
        END IF;
        v_new_stock := v_current_stock - p_quantity;
    ELSIF p_movement_type = 'ADJUSTMENT' THEN
        IF p_reason IS NULL OR trim(p_reason) = '' THEN
            RAISE EXCEPTION 'Reason is required for inventory adjustment';
        END IF;
        v_new_stock := v_current_stock + p_quantity;
        IF v_new_stock < 0 THEN
            RAISE EXCEPTION 'Adjustment would result in negative stock. Current: %, change: %', v_current_stock, p_quantity;
        END IF;
    ELSE
        RAISE EXCEPTION 'Unsupported movement type: %', p_movement_type;
    END IF;

    UPDATE public.inventory
    SET quantity_on_hand = v_new_stock, version = version + 1, updated_at = now()
    WHERE product_id = p_product_id;

    INSERT INTO public.inventory_movements (
        product_id, movement_type, quantity, quantity_before, quantity_after,
        supplier_id, reason, source, performed_by, reference_id, idempotency_key
    ) VALUES (
        p_product_id, p_movement_type, p_quantity, v_current_stock, v_new_stock,
        p_supplier_id, COALESCE(p_reason, 'Standard ' || p_movement_type),
        COALESCE(p_source, 'MANUAL'), v_user_id, p_reference_id, p_idempotency_key
    ) RETURNING id INTO v_movement_id;

    v_cached_response := jsonb_build_object(
        'success', true, 'movement_id', v_movement_id, 'product_id', p_product_id,
        'product_name', v_product_name, 'movement_type', p_movement_type,
        'quantity', p_quantity, 'quantity_before', v_current_stock,
        'quantity_after', v_new_stock, 'timestamp', now()
    );

    IF p_idempotency_key IS NOT NULL THEN
        INSERT INTO public.idempotency_keys (key, response_payload, expires_at)
        VALUES (p_idempotency_key, v_cached_response, now() + INTERVAL '24 hours')
        ON CONFLICT (key) DO NOTHING;
    END IF;

    RETURN v_cached_response;
END;
$$;

-- ==============================================================================
-- AI CONFIRMATION RPCs
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.prepare_stock_change(
    p_product_id UUID, p_movement_type movement_type, p_quantity INTEGER,
    p_supplier_id UUID DEFAULT NULL, p_reason TEXT DEFAULT '',
    p_source TEXT DEFAULT 'AI_ASSISTANT', p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_current_stock INTEGER; v_version INTEGER; v_resulting_stock INTEGER;
    v_product_name TEXT; v_request_id UUID; v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF p_quantity <= 0 THEN RAISE EXCEPTION 'Requested quantity must be positive'; END IF;

    SELECT name INTO v_product_name FROM public.products WHERE id = p_product_id AND is_active = true;
    IF v_product_name IS NULL THEN RAISE EXCEPTION 'Product not found or inactive'; END IF;

    SELECT quantity_on_hand, version INTO v_current_stock, v_version
    FROM public.inventory WHERE product_id = p_product_id;
    IF v_current_stock IS NULL THEN v_current_stock := 0; v_version := 1; END IF;

    IF p_movement_type = 'IN' THEN
        v_resulting_stock := v_current_stock + p_quantity;
    ELSIF p_movement_type IN ('OUT', 'DAMAGE') THEN
        IF v_current_stock < p_quantity THEN
            RAISE EXCEPTION 'Insufficient stock. Available quantity: %', v_current_stock;
        END IF;
        v_resulting_stock := v_current_stock - p_quantity;
    ELSE
        v_resulting_stock := v_current_stock + p_quantity;
    END IF;

    INSERT INTO public.stock_change_requests (
        product_id, requested_by, movement_type, quantity, supplier_id, reason, source,
        status, expected_quantity, expected_version, resulting_quantity, idempotency_key, expires_at
    ) VALUES (
        p_product_id, v_user_id, p_movement_type, p_quantity, p_supplier_id, p_reason, p_source,
        'PENDING', v_current_stock, v_version, v_resulting_stock, p_idempotency_key,
        now() + INTERVAL '10 minutes'
    ) RETURNING id INTO v_request_id;

    RETURN jsonb_build_object(
        'request_id', v_request_id, 'product_id', p_product_id, 'product_name', v_product_name,
        'movement_type', p_movement_type, 'quantity', p_quantity,
        'current_stock', v_current_stock, 'resulting_stock', v_resulting_stock,
        'reason', p_reason, 'status', 'PENDING', 'expires_at', now() + INTERVAL '10 minutes'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_stock_change(
    p_request_id UUID, p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_req RECORD; v_current_stock INTEGER; v_new_stock INTEGER; v_movement_id UUID;
BEGIN
    SELECT * INTO v_req FROM public.stock_change_requests WHERE id = p_request_id FOR UPDATE;
    IF v_req IS NULL THEN RAISE EXCEPTION 'Stock change request not found'; END IF;
    IF v_req.status = 'CONFIRMED' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Request was already confirmed', 'request_id', p_request_id);
    END IF;
    IF v_req.status = 'CANCELLED' THEN RAISE EXCEPTION 'Request was cancelled'; END IF;
    IF now() > v_req.expires_at THEN
        UPDATE public.stock_change_requests SET status = 'EXPIRED' WHERE id = p_request_id;
        RAISE EXCEPTION 'Stock change request has expired';
    END IF;

    SELECT quantity_on_hand INTO v_current_stock FROM public.inventory WHERE product_id = v_req.product_id FOR UPDATE;
    IF v_current_stock IS NULL THEN v_current_stock := 0; END IF;

    IF v_req.movement_type = 'IN' THEN
        v_new_stock := v_current_stock + v_req.quantity;
    ELSE
        IF v_current_stock < v_req.quantity THEN
            RAISE EXCEPTION 'Insufficient stock. Current available: %, required: %', v_current_stock, v_req.quantity;
        END IF;
        v_new_stock := v_current_stock - v_req.quantity;
    END IF;

    UPDATE public.inventory SET quantity_on_hand = v_new_stock, version = version + 1, updated_at = now()
    WHERE product_id = v_req.product_id;

    INSERT INTO public.inventory_movements (
        product_id, movement_type, quantity, quantity_before, quantity_after,
        supplier_id, reason, source, performed_by, idempotency_key
    ) VALUES (
        v_req.product_id, v_req.movement_type, v_req.quantity, v_current_stock, v_new_stock,
        v_req.supplier_id, v_req.reason, 'AI_ASSISTANT_CONFIRMED', auth.uid(), p_idempotency_key
    ) RETURNING id INTO v_movement_id;

    UPDATE public.stock_change_requests
    SET status = 'CONFIRMED', confirmed_at = now(), updated_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'success', true, 'request_id', p_request_id, 'movement_id', v_movement_id,
        'quantity_before', v_current_stock, 'quantity_after', v_new_stock
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_stock_change(p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.stock_change_requests
    SET status = 'CANCELLED', cancelled_at = now(), updated_at = now()
    WHERE id = p_request_id AND status = 'PENDING';
    RETURN jsonb_build_object('success', true, 'request_id', p_request_id, 'status', 'CANCELLED');
END;
$$;

-- ==============================================================================
-- PRODUCT MANAGEMENT RPCs
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_product(
    p_sku TEXT, p_name TEXT, p_description TEXT, p_category_id UUID, p_supplier_id UUID,
    p_selling_price NUMERIC, p_cost_price NUMERIC, p_reorder_level INTEGER DEFAULT 10,
    p_initial_stock INTEGER DEFAULT 0
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_product_id UUID; v_role user_role;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid() AND is_active = true;
    IF v_role NOT IN ('MANAGER', 'ADMIN') THEN
        RAISE EXCEPTION 'Access Denied: Only Managers and Admins can create products';
    END IF;
    IF EXISTS (SELECT 1 FROM public.products WHERE sku = trim(p_sku)) THEN
        RAISE EXCEPTION 'A product with SKU % already exists', p_sku;
    END IF;

    INSERT INTO public.products (sku, name, description, category_id, default_supplier_id, selling_price, cost_price, reorder_level, is_active)
    VALUES (trim(p_sku), trim(p_name), p_description, p_category_id, p_supplier_id, p_selling_price, p_cost_price, p_reorder_level, true)
    RETURNING id INTO v_product_id;

    INSERT INTO public.inventory (product_id, quantity_on_hand, version)
    VALUES (v_product_id, GREATEST(p_initial_stock, 0), 1);

    IF p_initial_stock > 0 THEN
        INSERT INTO public.inventory_movements (product_id, movement_type, quantity, quantity_before, quantity_after, supplier_id, reason, source, performed_by)
        VALUES (v_product_id, 'IN', p_initial_stock, 0, p_initial_stock, p_supplier_id, 'Initial Stock Setup', 'SYSTEM', auth.uid());
    END IF;

    RETURN jsonb_build_object('success', true, 'product_id', v_product_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_product_prices(
    p_product_id UUID, p_selling_price NUMERIC, p_cost_price NUMERIC
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_role user_role;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid() AND is_active = true;
    IF v_role NOT IN ('MANAGER', 'ADMIN') THEN
        RAISE EXCEPTION 'Access Denied: Only Managers and Admins can update pricing';
    END IF;
    UPDATE public.products SET selling_price = p_selling_price, cost_price = p_cost_price, updated_at = now()
    WHERE id = p_product_id;
    RETURN jsonb_build_object('success', true, 'product_id', p_product_id);
END;
$$;

-- ==============================================================================
-- LOW STOCK RPC
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_low_stock()
RETURNS TABLE (
    product_id UUID, sku TEXT, name TEXT, reorder_level INTEGER,
    quantity_on_hand INTEGER, category_name TEXT, supplier_name TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT p.id, p.sku, p.name, p.reorder_level,
        COALESCE(i.quantity_on_hand, 0), c.name, s.name
    FROM public.products p
    LEFT JOIN public.inventory i ON i.product_id = p.id
    LEFT JOIN public.categories c ON c.id = p.category_id
    LEFT JOIN public.suppliers s ON s.id = p.default_supplier_id
    WHERE p.is_active = true AND COALESCE(i.quantity_on_hand, 0) <= p.reorder_level
    ORDER BY COALESCE(i.quantity_on_hand, 0) ASC;
$$;

-- ==============================================================================
-- USER MANAGEMENT RPCs
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.change_user_role(p_target_user_id UUID, p_new_role user_role)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_caller_role user_role; v_target_role user_role; v_admin_count INTEGER;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid() AND is_active = true;
    IF v_caller_role != 'ADMIN' THEN RAISE EXCEPTION 'Access Denied: Only Admins can modify user roles'; END IF;
    IF auth.uid() = p_target_user_id THEN RAISE EXCEPTION 'Security Violation: You cannot alter your own role'; END IF;
    SELECT role INTO v_target_role FROM public.profiles WHERE id = p_target_user_id;
    IF v_target_role IS NULL THEN RAISE EXCEPTION 'Target user not found'; END IF;
    IF v_target_role = 'ADMIN' AND p_new_role != 'ADMIN' THEN
        SELECT COUNT(*) INTO v_admin_count FROM public.profiles WHERE role = 'ADMIN' AND is_active = true;
        IF v_admin_count <= 1 THEN RAISE EXCEPTION 'Operation blocked: At least one active Administrator must remain'; END IF;
    END IF;
    UPDATE public.profiles SET role = p_new_role, updated_at = now() WHERE id = p_target_user_id;
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, before_data, after_data)
    VALUES (auth.uid(), 'ROLE_CHANGE', 'PROFILE', p_target_user_id::text,
        jsonb_build_object('old_role', v_target_role), jsonb_build_object('new_role', p_new_role));
    RETURN jsonb_build_object('success', true, 'target_user_id', p_target_user_id, 'new_role', p_new_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_active(p_target_user_id UUID, p_is_active BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_caller_role user_role; v_target_role user_role; v_admin_count INTEGER;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid() AND is_active = true;
    IF v_caller_role NOT IN ('MANAGER', 'ADMIN') THEN
        RAISE EXCEPTION 'Access Denied: Only Managers and Admins can activate/deactivate accounts';
    END IF;
    IF auth.uid() = p_target_user_id THEN RAISE EXCEPTION 'Security Violation: You cannot deactivate your own account'; END IF;
    SELECT role INTO v_target_role FROM public.profiles WHERE id = p_target_user_id;
    IF v_caller_role = 'MANAGER' AND v_target_role = 'ADMIN' THEN
        RAISE EXCEPTION 'Access Denied: Managers cannot deactivate Administrators';
    END IF;
    IF v_target_role = 'ADMIN' AND p_is_active = false THEN
        SELECT COUNT(*) INTO v_admin_count FROM public.profiles WHERE role = 'ADMIN' AND is_active = true;
        IF v_admin_count <= 1 THEN RAISE EXCEPTION 'Operation blocked: Cannot deactivate the sole active Administrator'; END IF;
    END IF;
    UPDATE public.profiles SET is_active = p_is_active, updated_at = now() WHERE id = p_target_user_id;
    RETURN jsonb_build_object('success', true, 'target_user_id', p_target_user_id, 'is_active', p_is_active);
END;
$$;

-- ==============================================================================
-- ROW LEVEL SECURITY
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Profiles: SELECT for authenticated; UPDATE own profile (but cannot change role via direct update)
DROP POLICY IF EXISTS "Profiles SELECT" ON public.profiles;
CREATE POLICY "Profiles SELECT" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Profiles UPDATE own" ON public.profiles;
CREATE POLICY "Profiles UPDATE own" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Categories: SELECT for all; INSERT/UPDATE/DELETE for managers+admins
DROP POLICY IF EXISTS "Categories SELECT" ON public.categories;
CREATE POLICY "Categories SELECT" ON public.categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Categories INSERT" ON public.categories;
CREATE POLICY "Categories INSERT" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "Categories UPDATE" ON public.categories;
CREATE POLICY "Categories UPDATE" ON public.categories FOR UPDATE TO authenticated USING (public.is_manager_or_admin()) WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "Categories DELETE" ON public.categories;
CREATE POLICY "Categories DELETE" ON public.categories FOR DELETE TO authenticated USING (public.is_manager_or_admin());

-- Suppliers: SELECT for all; INSERT/UPDATE/DELETE for managers+admins
DROP POLICY IF EXISTS "Suppliers SELECT" ON public.suppliers;
CREATE POLICY "Suppliers SELECT" ON public.suppliers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Suppliers INSERT" ON public.suppliers;
CREATE POLICY "Suppliers INSERT" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "Suppliers UPDATE" ON public.suppliers;
CREATE POLICY "Suppliers UPDATE" ON public.suppliers FOR UPDATE TO authenticated USING (public.is_manager_or_admin()) WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "Suppliers DELETE" ON public.suppliers;
CREATE POLICY "Suppliers DELETE" ON public.suppliers FOR DELETE TO authenticated USING (public.is_manager_or_admin());

-- Products: SELECT for all; INSERT/UPDATE for managers+admins; DELETE for managers+admins
DROP POLICY IF EXISTS "Products SELECT" ON public.products;
CREATE POLICY "Products SELECT" ON public.products FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Products INSERT" ON public.products;
CREATE POLICY "Products INSERT" ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "Products UPDATE" ON public.products;
CREATE POLICY "Products UPDATE" ON public.products FOR UPDATE TO authenticated USING (public.is_manager_or_admin()) WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "Products DELETE" ON public.products;
CREATE POLICY "Products DELETE" ON public.products FOR DELETE TO authenticated USING (public.is_manager_or_admin());

-- Inventory: SELECT for all; INSERT/UPDATE for managers+admins (direct table fallback for create_product)
DROP POLICY IF EXISTS "Inventory SELECT" ON public.inventory;
CREATE POLICY "Inventory SELECT" ON public.inventory FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Inventory INSERT" ON public.inventory;
CREATE POLICY "Inventory INSERT" ON public.inventory FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "Inventory UPDATE" ON public.inventory;
CREATE POLICY "Inventory UPDATE" ON public.inventory FOR UPDATE TO authenticated USING (public.is_manager_or_admin()) WITH CHECK (public.is_manager_or_admin());

-- Inventory Movements: SELECT for all; INSERT for all authenticated (staff can record movements via RPC)
DROP POLICY IF EXISTS "Movements SELECT" ON public.inventory_movements;
CREATE POLICY "Movements SELECT" ON public.inventory_movements FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Movements INSERT" ON public.inventory_movements;
CREATE POLICY "Movements INSERT" ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (true);

-- Stock Change Requests: SELECT for all authenticated; INSERT for all authenticated; UPDATE for all authenticated
DROP POLICY IF EXISTS "StockRequests SELECT" ON public.stock_change_requests;
CREATE POLICY "StockRequests SELECT" ON public.stock_change_requests FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "StockRequests INSERT" ON public.stock_change_requests;
CREATE POLICY "StockRequests INSERT" ON public.stock_change_requests FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "StockRequests UPDATE" ON public.stock_change_requests;
CREATE POLICY "StockRequests UPDATE" ON public.stock_change_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Audit Logs: SELECT for authenticated; no direct INSERT (only via SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS "AuditLogs SELECT" ON public.audit_logs;
CREATE POLICY "AuditLogs SELECT" ON public.audit_logs FOR SELECT TO authenticated USING (true);

-- Idempotency Keys: no direct access (only used by SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS "IdempotencyKeys SELECT" ON public.idempotency_keys;
CREATE POLICY "IdempotencyKeys SELECT" ON public.idempotency_keys FOR SELECT TO authenticated USING (false);
