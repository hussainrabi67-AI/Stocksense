import { getSupabase, getSupabaseCredentials } from './supabase';
import {
  Product,
  InventoryMovement,
  StockChangeRequest,
  Supplier,
  Category,
  Profile,
  DashboardMetrics,
  MovementType,
  UserRole
} from '../types/inventory';

// ==============================================================================
// LOCAL STORAGE BUFFER
// Pre-seeded with Nowshera Shopping Mall initial inventory if local storage is empty
// ==============================================================================

interface LocalDB {
  products: Product[];
  movements: InventoryMovement[];
  requests: StockChangeRequest[];
  categories: Category[];
  suppliers: Supplier[];
  users: Profile[];
}

const DEFAULT_USERS: Profile[] = [
  {
    id: 'user-admin-hussain',
    full_name: 'Hussain Rabi',
    email: 'hussainrabi67@gmail.com',
    role: 'ADMIN',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-elec-01', name: 'Electronics & Mobile', code: 'ELEC', description: 'Smart devices, chargers, and mobile gear', created_at: new Date().toISOString() },
  { id: 'cat-acc-02', name: 'Accessories & Peripherals', code: 'ACC', description: 'Mice, keyboards, and computer peripherals', created_at: new Date().toISOString() },
  { id: 'cat-pwr-03', name: 'Power & Cables', code: 'PWR', description: 'Power banks, adapters, and high-speed cables', created_at: new Date().toISOString() }
];

const DEFAULT_SUPPLIERS: Supplier[] = [
  { id: 'sup-ali-01', name: 'Ali Traders (Lahore)', contact_person: 'Muhammad Ali', email: 'alitrader@lahore.pk', phone: '0300-1234567', is_active: true, created_at: new Date().toISOString() },
  { id: 'sup-now-02', name: 'Nowshera Wholesale Hub', contact_person: 'Farhan Ahmad', email: 'orders@nowsherahub.pk', phone: '0312-9876543', is_active: true, created_at: new Date().toISOString() },
  { id: 'sup-pak-03', name: 'Pak Electronics Center', contact_person: 'Rashid Mahmood', email: 'rashid@pakelec.pk', phone: '0333-5556677', is_active: true, created_at: new Date().toISOString() }
];

const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'prod-cbl-01',
    sku: 'ELEC-CBL-001',
    name: 'Type-C Fast Charging Cable (65W)',
    description: 'Braided 1.8m durable USB-C to USB-C cable for laptops & mobile devices',
    category_id: 'cat-pwr-03',
    category_name: 'Power & Cables',
    default_supplier_id: 'sup-ali-01',
    supplier_name: 'Ali Traders (Lahore)',
    selling_price: 850,
    cost_price: 450,
    profit: 400,
    profit_margin_percent: 47.06,
    reorder_level: 25,
    quantity_on_hand: 120,
    inventory_version: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'prod-chg-02',
    sku: 'ELEC-CHG-002',
    name: 'Samsung 45W Super Fast Charger',
    description: 'Original 45W Type-C power adapter with Power Delivery support',
    category_id: 'cat-elec-01',
    category_name: 'Electronics & Mobile',
    default_supplier_id: 'sup-ali-01',
    supplier_name: 'Ali Traders (Lahore)',
    selling_price: 2400,
    cost_price: 1600,
    profit: 800,
    profit_margin_percent: 33.33,
    reorder_level: 15,
    quantity_on_hand: 8, // Low Stock!
    inventory_version: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

function generateDefaultMovements(): InventoryMovement[] {
  return [];
}

function getLocalDB(): LocalDB {
  if (typeof window === 'undefined') {
    return {
      products: DEFAULT_PRODUCTS,
      movements: generateDefaultMovements(),
      requests: [],
      categories: DEFAULT_CATEGORIES,
      suppliers: DEFAULT_SUPPLIERS,
      users: DEFAULT_USERS
    };
  }

  const storedProd = localStorage.getItem('stocksense_db_products');
  const storedMov = localStorage.getItem('stocksense_db_movements');
  const storedReq = localStorage.getItem('stocksense_db_requests');
  const storedCats = localStorage.getItem('stocksense_db_categories');
  const storedSups = localStorage.getItem('stocksense_db_suppliers');
  const storedUsers = localStorage.getItem('stocksense_db_users');

  const products = storedProd ? (JSON.parse(storedProd) as Product[]) : DEFAULT_PRODUCTS;
  const categories = storedCats ? (JSON.parse(storedCats) as Category[]) : DEFAULT_CATEGORIES;
  const suppliers = storedSups ? (JSON.parse(storedSups) as Supplier[]) : DEFAULT_SUPPLIERS;
  const users = storedUsers ? (JSON.parse(storedUsers) as Profile[]) : DEFAULT_USERS;

  let movements: InventoryMovement[] = [];
  if (storedMov) {
    try {
      movements = JSON.parse(storedMov) as InventoryMovement[];
    } catch (e) {
      movements = [];
    }
  }

  // Seed default weekly movements if none exist
  if (!movements || movements.length === 0) {
    movements = generateDefaultMovements();
    localStorage.setItem('stocksense_db_movements', JSON.stringify(movements));
  }

  // Ensure initial data saved if not present
  if (!storedProd) localStorage.setItem('stocksense_db_products', JSON.stringify(DEFAULT_PRODUCTS));
  if (!storedCats) localStorage.setItem('stocksense_db_categories', JSON.stringify(DEFAULT_CATEGORIES));
  if (!storedSups) localStorage.setItem('stocksense_db_suppliers', JSON.stringify(DEFAULT_SUPPLIERS));
  if (!storedUsers) localStorage.setItem('stocksense_db_users', JSON.stringify(DEFAULT_USERS));

  return {
    products,
    movements,
    requests: storedReq ? (JSON.parse(storedReq) as StockChangeRequest[]) : [],
    categories,
    suppliers,
    users
  };
}

function saveLocalDB(data: {
  products?: Product[];
  movements?: InventoryMovement[];
  requests?: StockChangeRequest[];
  categories?: Category[];
  suppliers?: Supplier[];
  users?: Profile[];
}) {
  if (typeof window === 'undefined') return;
  if (data.products !== undefined) localStorage.setItem('stocksense_db_products', JSON.stringify(data.products));
  if (data.movements !== undefined) localStorage.setItem('stocksense_db_movements', JSON.stringify(data.movements));
  if (data.requests !== undefined) localStorage.setItem('stocksense_db_requests', JSON.stringify(data.requests));
  if (data.categories !== undefined) localStorage.setItem('stocksense_db_categories', JSON.stringify(data.categories));
  if (data.suppliers !== undefined) localStorage.setItem('stocksense_db_suppliers', JSON.stringify(data.suppliers));
  if (data.users !== undefined) localStorage.setItem('stocksense_db_users', JSON.stringify(data.users));
}

// ==============================================================================
// CORE API EXPORTS
// ==============================================================================

/**
 * Filter product data based on user role.
 * CRITICAL REQUIREMENT: Staff members MUST NEVER see cost_price, profit, or margin.
 */
export function sanitizeProductForRole(product: Product, role: UserRole): Product {
  if (role === 'STAFF') {
    const copy = { ...product };
    delete copy.cost_price;
    delete copy.profit;
    delete copy.profit_margin_percent;
    return copy;
  }
  return product;
}

/**
 * Fetch all products, securely filtered for the caller's role.
 */
export async function getProducts(role: UserRole = 'STAFF'): Promise<Product[]> {
  const supabase = getSupabase();
  const creds = getSupabaseCredentials();
  const safeRole = (role || 'STAFF').toString().toUpperCase() as UserRole;
  const isElevated = safeRole === 'ADMIN' || safeRole === 'MANAGER';

  if (supabase) {
    // 1. First attempt: Query dedicated SQL views (products_manager_view / products_staff_view)
    try {
      const viewName = isElevated ? 'products_manager_view' : 'products_staff_view';
      const { data: viewData, error: viewError } = await supabase
        .from(viewName)
        .select('*')
        .order('name');

      if (!viewError && Array.isArray(viewData)) {
        return viewData.map((item: any) => {
          const sell = Number(item.selling_price) || 0;
          const cost = isElevated && item.cost_price !== undefined && item.cost_price !== null
            ? Number(item.cost_price)
            : undefined;

          const product: Product = {
            id: String(item.id),
            sku: String(item.sku || ''),
            name: String(item.name || ''),
            description: item.description || '',
            category_id: item.category_id || '',
            category_name: item.category_name || 'General',
            default_supplier_id: item.default_supplier_id || '',
            supplier_name: item.supplier_name || 'Unassigned',
            selling_price: sell,
            cost_price: cost,
            profit: cost !== undefined ? sell - cost : undefined,
            profit_margin_percent:
              cost !== undefined && sell > 0
                ? Number((((sell - cost) / sell) * 100).toFixed(2))
                : undefined,
            reorder_level: Number(item.reorder_level) || 10,
            quantity_on_hand: Number(item.quantity_on_hand) || 0,
            inventory_version: Number(item.inventory_version) || 1,
            is_active: item.is_active ?? true,
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString()
          };

          return sanitizeProductForRole(product, safeRole);
        });
      }
    } catch (vErr) {
      console.warn('products view query note:', vErr);
    }

    // 2. Direct Supabase products table with joins
    try {
      let rawData: any[] | null = null;
      let rawError: any = null;

      if (isElevated) {
        const res = await supabase
          .from('products')
          .select('id, sku, name, description, category_id, default_supplier_id, selling_price, cost_price, reorder_level, is_active, created_at, updated_at, inventory(quantity_on_hand, version), categories(name), suppliers(name)')
          .order('name');
        rawData = res.data;
        rawError = res.error;
      }

      if (!rawData || rawError) {
        const fallbackRes = await supabase
          .from('products')
          .select('id, sku, name, description, category_id, default_supplier_id, selling_price, reorder_level, is_active, created_at, updated_at, inventory(quantity_on_hand, version), categories(name), suppliers(name)')
          .order('name');
        if (!fallbackRes.error && fallbackRes.data) {
          rawData = fallbackRes.data;
          rawError = null;
        }
      }

      if (!rawError && Array.isArray(rawData)) {
        return rawData.map((item: any) => {
          const inv = Array.isArray(item.inventory) ? item.inventory[0] : item.inventory;
          const cat = Array.isArray(item.categories) ? item.categories[0] : item.categories;
          const sup = Array.isArray(item.suppliers) ? item.suppliers[0] : item.suppliers;
          const qty = Number(inv?.quantity_on_hand) || 0;
          const cost = isElevated && item.cost_price !== undefined && item.cost_price !== null
            ? Number(item.cost_price)
            : undefined;
          const sell = Number(item.selling_price) || 0;

          const prod: Product = {
            id: String(item.id),
            sku: String(item.sku || ''),
            name: String(item.name || ''),
            description: item.description || '',
            category_id: item.category_id || '',
            category_name: cat?.name || 'General',
            default_supplier_id: item.default_supplier_id || '',
            supplier_name: sup?.name || 'Unassigned',
            selling_price: sell,
            cost_price: cost,
            profit: cost !== undefined ? sell - cost : undefined,
            profit_margin_percent:
              cost !== undefined && sell > 0
                ? Number((((sell - cost) / sell) * 100).toFixed(2))
                : undefined,
            reorder_level: Number(item.reorder_level) || 10,
            quantity_on_hand: qty,
            inventory_version: Number(inv?.version) || 1,
            is_active: item.is_active ?? true,
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString()
          };
          return sanitizeProductForRole(prod, safeRole);
        });
      }
    } catch (tblErr) {
      console.warn('Direct products table query failed:', tblErr);
    }

    // When Supabase credentials are configured, NEVER return mock products from local storage buffer.
    // Return empty array so the dashboard strictly reflects the real Supabase state.
    if (creds.isConfigured) {
      return [];
    }
  }

  // 3. Fallback to local storage buffer (ONLY when Supabase is not configured)
  const db = getLocalDB();
  return db.products.map((p) => sanitizeProductForRole(p, safeRole));
}

/**
 * Fetch a single product by ID or SKU.
 */
export async function getProductById(idOrSku: string, role: UserRole = 'STAFF'): Promise<Product | null> {
  const products = await getProducts(role);
  return products.find((p) => p.id === idOrSku || p.sku.toLowerCase() === idOrSku.toLowerCase()) || null;
}

/**
 * Fetch categories.
 */
export async function getCategories(): Promise<Category[]> {
  const supabase = getSupabase();
  const creds = getSupabaseCredentials();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getCategories error:', e);
    }
    if (creds.isConfigured) return [];
  }
  return getLocalDB().categories;
}

/**
 * Create a new category.
 */
export async function createCategory(cat: { name: string; code: string; description?: string }): Promise<Category> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{
          name: cat.name.trim(),
          code: cat.code.trim().toUpperCase(),
          description: cat.description?.trim() || null
        }])
        .select()
        .single();
      if (!error && data) return data as Category;
    } catch (e) {
      console.warn('Supabase createCategory error:', e);
    }
  }

  const db = getLocalDB();
  if (db.categories.some((c) => c.code.toLowerCase() === cat.code.toLowerCase())) {
    throw new Error(`A category with code ${cat.code} already exists.`);
  }

  const newCat: Category = {
    id: 'cat-' + Date.now(),
    name: cat.name.trim(),
    code: cat.code.trim().toUpperCase(),
    description: cat.description?.trim(),
    created_at: new Date().toISOString()
  };
  db.categories.push(newCat);
  saveLocalDB(db);
  return newCat;
}

/**
 * Fetch suppliers.
 */
export async function getSuppliers(): Promise<Supplier[]> {
  const supabase = getSupabase();
  const creds = getSupabaseCredentials();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('suppliers').select('*').order('name');
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getSuppliers error:', e);
    }
    if (creds.isConfigured) return [];
  }
  return getLocalDB().suppliers;
}

/**
 * Create a new supplier.
 */
export async function createSupplier(sup: {
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
}): Promise<Supplier> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert([{
          name: sup.name.trim(),
          contact_person: sup.contact_person?.trim() || null,
          email: sup.email?.trim() || null,
          phone: sup.phone?.trim() || null,
          address: sup.address?.trim() || null,
          is_active: true
        }])
        .select()
        .single();
      if (!error && data) return data as Supplier;
    } catch (e) {
      console.warn('Supabase createSupplier error:', e);
    }
  }

  const db = getLocalDB();
  const newSup: Supplier = {
    id: 'sup-' + Date.now(),
    name: sup.name.trim(),
    contact_person: sup.contact_person?.trim(),
    email: sup.email?.trim(),
    phone: sup.phone?.trim(),
    address: sup.address?.trim(),
    is_active: true,
    created_at: new Date().toISOString()
  };
  db.suppliers.push(newSup);
  saveLocalDB(db);
  return newSup;
}

/**
 * Fetch low stock products (quantity <= reorder_level).
 */
export async function getLowStockProducts(role: UserRole = 'STAFF'): Promise<Product[]> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('get_low_stock');
      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((item: any) => {
          const sell = Number(item.selling_price) || 0;
          const cost = (role === 'ADMIN' || role === 'MANAGER') && item.cost_price !== undefined ? Number(item.cost_price) : undefined;
          return {
            id: String(item.product_id || item.id),
            sku: String(item.sku || ''),
            name: String(item.product_name || item.name || ''),
            description: item.description || '',
            category_id: item.category_id || '',
            category_name: item.category_name || 'General',
            default_supplier_id: item.supplier_id || item.default_supplier_id || '',
            supplier_name: item.supplier_name || 'Unassigned',
            selling_price: sell,
            cost_price: cost,
            profit: cost !== undefined ? sell - cost : undefined,
            profit_margin_percent: cost !== undefined && sell > 0 ? Number((((sell - cost) / sell) * 100).toFixed(2)) : undefined,
            reorder_level: Number(item.reorder_level) || 10,
            quantity_on_hand: Number(item.quantity_on_hand) || 0,
            inventory_version: 1,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        });
      }
    } catch (e) {
      console.warn('Supabase get_low_stock RPC note:', e);
    }
  }

  const products = await getProducts(role);
  return products.filter((p) => p.is_active && p.quantity_on_hand <= p.reorder_level);
}

/**
 * Transactional stock mutation via Supabase RPC `change_stock` or Local Engine.
 * STRICT SECURITY: Rejects negative stock. Never allows inventory < 0.
 */
export async function changeStock(params: {
  productId: string;
  movementType: MovementType;
  quantity: number;
  supplierId?: string;
  reason: string;
  source?: string;
  referenceId?: string;
  performedByName?: string;
  idempotencyKey?: string;
}): Promise<{
  success: boolean;
  movementId: string;
  quantityBefore: number;
  quantityAfter: number;
}> {
  const { productId, movementType, quantity, supplierId, reason, source = 'MANUAL', referenceId, performedByName, idempotencyKey } = params;

  if (quantity <= 0) {
    throw new Error('Quantity must be greater than zero.');
  }

  const safeKey = (idempotencyKey && idempotencyKey.trim())
    ? idempotencyKey.trim()
    : `stock-${productId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const supabase = getSupabase();

  if (supabase) {
    // 1. Try Supabase RPC change_stock with non-null idempotency key
    try {
      const { data, error } = await supabase.rpc('change_stock', {
        p_product_id: productId,
        p_movement_type: movementType,
        p_quantity: quantity,
        p_supplier_id: supplierId || null,
        p_reason: reason,
        p_source: source,
        p_idempotency_key: safeKey
      });

      if (!error && data) {
        return {
          success: true,
          movementId: data.movement_id || 'supabase-' + Date.now(),
          quantityBefore: data.quantity_before,
          quantityAfter: data.quantity_after
        };
      }

      if (error && error.message?.includes('Insufficient stock')) {
        throw new Error(error.message);
      }
    } catch (err: any) {
      if (err.message && err.message.includes('Insufficient stock')) {
        throw err;
      }
      console.warn('Supabase change_stock RPC failed, using direct table transaction:', err);
    }

    // 2. Direct Supabase Table Transaction Fallback
    try {
      // Query current inventory on Supabase
      const { data: invData } = await supabase
        .from('inventory')
        .select('quantity_on_hand, version')
        .eq('product_id', productId)
        .maybeSingle();

      const before = invData?.quantity_on_hand ?? 0;
      let after = before;

      if (movementType === 'IN') {
        after = before + quantity;
      } else if (movementType === 'OUT' || movementType === 'DAMAGE') {
        if (before < quantity) {
          throw new Error(`Insufficient stock. Available quantity: ${before}, requested: ${quantity}.`);
        }
        after = before - quantity;
      } else if (movementType === 'ADJUSTMENT') {
        after = before + quantity;
        if (after < 0) {
          throw new Error(`Adjustment would result in negative stock. Current: ${before}, adjustment: ${quantity}.`);
        }
      }

      // Upsert inventory
      const currentVersion = (invData?.version ?? 0) + 1;
      const { error: upsertErr } = await supabase
        .from('inventory')
        .upsert(
          {
            product_id: productId,
            quantity_on_hand: after,
            version: currentVersion,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'product_id' }
        );

      if (upsertErr) {
        throw new Error(`Inventory table update failed: ${upsertErr.message}`);
      }

      // Record movement in audit trail
      const movId = 'mov-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      let userId: string | null = null;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        userId = sessionData?.session?.user?.id || null;
      } catch {
        userId = null;
      }

      await supabase.from('inventory_movements').insert({
        id: movId,
        product_id: productId,
        movement_type: movementType,
        quantity,
        quantity_before: before,
        quantity_after: after,
        supplier_id: supplierId || null,
        reason,
        source,
        performed_by: userId,
        reference_id: referenceId || null,
        idempotency_key: safeKey,
        created_at: new Date().toISOString()
      });

      return {
        success: true,
        movementId: movId,
        quantityBefore: before,
        quantityAfter: after
      };
    } catch (directErr: any) {
      if (directErr.message?.includes('Insufficient stock')) {
        throw directErr;
      }
      console.warn('Direct Supabase inventory update fallback failed:', directErr);
    }
  }

  const db = getLocalDB();
  const prodIndex = db.products.findIndex(
    (p: Product) => p.id === productId || p.sku.toLowerCase() === productId.toLowerCase()
  );

  if (prodIndex === -1) {
    throw new Error('Product not found in database.');
  }

  const prod = db.products[prodIndex];
  const before = prod.quantity_on_hand;
  let after = before;

  if (movementType === 'IN') {
    after = before + quantity;
  } else if (movementType === 'OUT' || movementType === 'DAMAGE') {
    if (before < quantity) {
      throw new Error(`Insufficient stock. Available quantity: ${before}, requested: ${quantity}.`);
    }
    after = before - quantity;
  } else if (movementType === 'ADJUSTMENT') {
    if (!reason.trim()) {
      throw new Error('A specific reason is required for inventory adjustments.');
    }
    after = before + quantity;
    if (after < 0) {
      throw new Error(`Adjustment would result in negative stock. Current: ${before}, adjustment: ${quantity}.`);
    }
  }

  prod.quantity_on_hand = after;
  prod.inventory_version = (prod.inventory_version || 1) + 1;
  prod.updated_at = new Date().toISOString();
  db.products[prodIndex] = prod;

  const movId = 'mov-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const supplier = db.suppliers.find((s: Supplier) => s.id === (supplierId || prod.default_supplier_id));

  const newMovement: InventoryMovement = {
    id: movId,
    product_id: prod.id,
    product_name: prod.name,
    product_sku: prod.sku,
    movement_type: movementType,
    quantity,
    quantity_before: before,
    quantity_after: after,
    supplier_id: supplier?.id,
    supplier_name: supplier?.name,
    reason,
    source,
    performed_by: 'current-user',
    performer_name: performedByName || 'Staff Member',
    reference_id: referenceId,
    idempotency_key: idempotencyKey,
    created_at: new Date().toISOString()
  };

  db.movements.unshift(newMovement);
  saveLocalDB(db);

  return {
    success: true,
    movementId: movId,
    quantityBefore: before,
    quantityAfter: after
  };
}

/**
 * Fetch inventory movement history with filtering.
 */
export async function getMovementHistory(filters?: {
  productId?: string;
  movementType?: MovementType;
  searchQuery?: string;
}): Promise<InventoryMovement[]> {
  const supabase = getSupabase();
  const creds = getSupabaseCredentials();
  console.log('TRACE: getMovementHistory called');

  if (supabase) {
    try {
      let query = supabase
        .from('inventory_movements')
        .select(`
          id, product_id, movement_type, quantity, quantity_before, quantity_after,
          supplier_id, reason, source, performed_by, reference_id, idempotency_key, created_at,
          products(name, sku),
          suppliers(name),
          profiles(full_name)
        `)
        .order('created_at', { ascending: false });

      if (filters?.productId) {
        query = query.eq('product_id', filters.productId);
      }
      if (filters?.movementType) {
        query = query.eq('movement_type', filters.movementType);
      }

      const { data, error } = await query;
      if (!error && data) {
        return data.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.products?.name || 'Unknown Product',
          product_sku: item.products?.sku || 'N/A',
          movement_type: item.movement_type,
          quantity: item.quantity,
          quantity_before: item.quantity_before,
          quantity_after: item.quantity_after,
          supplier_id: item.supplier_id,
          supplier_name: item.suppliers?.name,
          reason: item.reason,
          source: item.source,
          performed_by: item.performed_by,
          performer_name: item.profiles?.full_name || 'System Operator',
          reference_id: item.reference_id,
          idempotency_key: item.idempotency_key,
          created_at: item.created_at
        }));
      }
    } catch (e) {
      console.warn('Supabase getMovementHistory error:', e);
    }

    if (creds.isConfigured) {
      return [];
    }
  }

  let list = getLocalDB().movements;
  if (filters?.productId) {
    list = list.filter((m) => m.product_id === filters.productId);
  }
  if (filters?.movementType) {
    list = list.filter((m) => m.movement_type === filters.movementType);
  }
  if (filters?.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    list = list.filter(
      (m) =>
        m.product_name?.toLowerCase().includes(q) ||
        m.product_sku?.toLowerCase().includes(q) ||
        m.reason?.toLowerCase().includes(q) ||
        m.supplier_name?.toLowerCase().includes(q)
    );
  }
  return list;
}

export interface TopProductSalesItem {
  product: Product;
  unitsSold: number;
  transactionsCount: number;
  retailRevenue: number;
  grossProfit?: number; // Restricted to MANAGER and ADMIN
  lastSoldAt: string;
}

export interface WeeklySalesAnalysis {
  topItem: TopProductSalesItem | null;
  rankings: TopProductSalesItem[];
  totalUnitsSoldAll: number;
  totalRetailRevenueAll: number;
  totalGrossProfitAll?: number; // Restricted to MANAGER and ADMIN
  days: number;
}

/**
 * Fetch top selling products based on real outbound movements for the specified timeframe.
 * Enforces role security (strictly hiding cost/profit for STAFF).
 */
export async function getTopSellingProducts(
  days: number = 7,
  role: UserRole = 'STAFF'
): Promise<WeeklySalesAnalysis> {
  const [movements, products] = await Promise.all([
    getMovementHistory(),
    getProducts(role)
  ]);

  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

  // Filter for OUT movements within the requested timeframe
  let weeklyOutMovements = movements.filter((m) => {
    if (m.movement_type !== 'OUT') return false;
    const mTime = new Date(m.created_at).getTime();
    return !isNaN(mTime) && mTime >= cutoffTime;
  });

  // If no movements found in the last N days, fallback to all recorded OUT movements
  if (weeklyOutMovements.length === 0) {
    weeklyOutMovements = movements.filter((m) => m.movement_type === 'OUT');
  }

  // Aggregate units sold and transaction frequency per product
  const aggMap = new Map<string, { unitsSold: number; count: number; lastSoldAt: string }>();

  for (const mov of weeklyOutMovements) {
    const key = mov.product_id || mov.product_sku || mov.product_name || 'unknown-item';
    const existing = aggMap.get(key) || { unitsSold: 0, count: 0, lastSoldAt: mov.created_at };
    existing.unitsSold += mov.quantity;
    existing.count += 1;
    if (new Date(mov.created_at).getTime() > new Date(existing.lastSoldAt).getTime()) {
      existing.lastSoldAt = mov.created_at;
    }
    aggMap.set(key, existing);
  }

  // Map to catalog products
  const rankings: TopProductSalesItem[] = [];

  for (const [key, data] of aggMap.entries()) {
    const prod = products.find(
      (p) =>
        p.id === key ||
        p.sku.toLowerCase() === key.toLowerCase() ||
        p.name.toLowerCase() === key.toLowerCase()
    );

    if (prod) {
      const retailRevenue = data.unitsSold * prod.selling_price;
      const grossProfit = (role !== 'STAFF' && prod.cost_price !== undefined)
        ? data.unitsSold * (prod.selling_price - prod.cost_price)
        : undefined;

      rankings.push({
        product: prod,
        unitsSold: data.unitsSold,
        transactionsCount: data.count,
        retailRevenue,
        grossProfit,
        lastSoldAt: data.lastSoldAt
      });
    }
  }

  // Sort descending by units sold
  rankings.sort((a, b) => b.unitsSold - a.unitsSold);

  const totalUnitsSoldAll = rankings.reduce((sum, item) => sum + item.unitsSold, 0);
  const totalRetailRevenueAll = rankings.reduce((sum, item) => sum + item.retailRevenue, 0);
  const totalGrossProfitAll = role !== 'STAFF'
    ? rankings.reduce((sum, item) => sum + (item.grossProfit || 0), 0)
    : undefined;

  return {
    topItem: rankings[0] || null,
    rankings,
    totalUnitsSoldAll,
    totalRetailRevenueAll,
    totalGrossProfitAll,
    days
  };
}

/**
 * 2-Step Confirmation: Prepare a stock change request (Used by AI assistant)
 */
export async function prepareStockChangeRequest(params: {
  productId: string;
  movementType: MovementType;
  quantity: number;
  supplierId?: string;
  reason: string;
  source?: string;
  idempotencyKey?: string;
}): Promise<StockChangeRequest> {
  const { productId, movementType, quantity, supplierId, reason, source = 'AI_ASSISTANT', idempotencyKey } = params;

  if (quantity <= 0) {
    throw new Error('Quantity must be greater than zero.');
  }

  const safeKey = (idempotencyKey && idempotencyKey.trim())
    ? idempotencyKey.trim()
    : `prep-${productId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('prepare_stock_change', {
        p_product_id: productId,
        p_movement_type: movementType,
        p_quantity: quantity,
        p_supplier_id: supplierId || null,
        p_reason: reason,
        p_source: source,
        p_idempotency_key: safeKey
      });

      if (!error && data) {
        return {
          id: data.request_id,
          product_id: data.product_id,
          product_name: data.product_name,
          movement_type: data.movement_type,
          quantity: data.quantity,
          reason: data.reason,
          source,
          status: 'PENDING',
          expected_quantity: data.current_stock,
          expected_version: 1,
          resulting_quantity: data.resulting_stock,
          idempotency_key: safeKey,
          expires_at: data.expires_at,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }

      if (error && error.message.includes('Insufficient stock')) throw new Error(error.message);
      console.warn('Supabase prepare_stock_change RPC returned note:', error?.message);
    } catch (e: any) {
      if (e.message && e.message.includes('Insufficient stock')) throw e;
      console.warn('Supabase prepareStockChange fallback:', e);
    }

    // Direct Supabase table fallback
    try {
      const { data: prodData } = await supabase
        .from('products')
        .select(`
          id, name, sku, default_supplier_id,
          inventory(quantity_on_hand, version),
          suppliers(name)
        `)
        .eq('id', productId)
        .maybeSingle();

      if (prodData) {
        const inv = Array.isArray(prodData.inventory) ? prodData.inventory[0] : prodData.inventory;
        const supp = Array.isArray(prodData.suppliers) ? prodData.suppliers[0] : prodData.suppliers;
        const current = inv?.quantity_on_hand ?? 0;
        let resulting = current;

        if (movementType === 'IN') {
          resulting = current + quantity;
        } else {
          if (current < quantity) {
            throw new Error(`Insufficient stock. Available quantity: ${current}, requested: ${quantity}.`);
          }
          resulting = current - quantity;
        }

        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        let createdReqId = 'req-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

        try {
          let userId: string | null = null;
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            userId = sessionData?.session?.user?.id || null;
          } catch {
            userId = null;
          }
          const { data: insertedReq, error: insertErr } = await supabase
            .from('stock_change_requests')
            .insert({
              product_id: productId,
              movement_type: movementType,
              quantity,
              supplier_id: supplierId || prodData.default_supplier_id || null,
              reason,
              source,
              status: 'PENDING',
              expected_quantity: current,
              expected_version: inv?.version || 1,
              resulting_quantity: resulting,
              idempotency_key: safeKey,
              expires_at: expiresAt,
              requested_by: userId
            })
            .select()
            .maybeSingle();

          if (!insertErr && insertedReq) {
            createdReqId = insertedReq.id;
          }
        } catch (insErr) {
          console.warn('Direct insert into stock_change_requests note:', insErr);
        }

        const fallbackReq: StockChangeRequest = {
          id: createdReqId,
          product_id: productId,
          product_name: prodData.name,
          movement_type: movementType,
          quantity,
          supplier_id: supplierId || prodData.default_supplier_id || undefined,
          supplier_name: supp?.name,
          reason,
          source,
          status: 'PENDING',
          expected_quantity: current,
          expected_version: inv?.version || 1,
          resulting_quantity: resulting,
          idempotency_key: safeKey,
          expires_at: expiresAt,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const db = getLocalDB();
        db.requests.unshift(fallbackReq);
        saveLocalDB(db);

        return fallbackReq;
      }
    } catch (tblErr: any) {
      if (tblErr.message?.includes('Insufficient stock')) throw tblErr;
      console.warn('Direct Supabase prepare fallback error:', tblErr);
    }
  }

  const db = getLocalDB();
  let prod = db.products.find((p) => p.id === productId);
  if (!prod) {
    const all = await getProducts();
    prod = all.find((p) => p.id === productId || p.sku.toLowerCase() === productId.toLowerCase());
  }
  if (!prod) throw new Error('Product not found in store catalog.');

  const current = prod.quantity_on_hand;
  let resulting = current;

  if (movementType === 'IN') {
    resulting = current + quantity;
  } else {
    if (current < quantity) {
      throw new Error(`Insufficient stock. Available quantity: ${current}, requested: ${quantity}.`);
    }
    resulting = current - quantity;
  }

  const reqId = 'req-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
  const supplier = db.suppliers.find((s) => s.id === (supplierId || prod.default_supplier_id));

  const req: StockChangeRequest = {
    id: reqId,
    product_id: prod.id,
    product_name: prod.name,
    movement_type: movementType,
    quantity,
    supplier_id: supplier?.id,
    supplier_name: supplier?.name,
    reason,
    source,
    status: 'PENDING',
    expected_quantity: current,
    expected_version: prod.inventory_version || 1,
    resulting_quantity: resulting,
    idempotency_key: safeKey,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.requests.unshift(req);
  saveLocalDB(db);

  return req;
}

/**
 * 2-Step Confirmation: Fetch pending stock change request details by real request_id
 */
export async function getStockChangeRequestById(requestId: string): Promise<StockChangeRequest | null> {
  if (!requestId) return null;
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('stock_change_requests')
        .select(`
          id, product_id, movement_type, quantity, supplier_id, reason, source,
          status, expected_quantity, expected_version, resulting_quantity,
          idempotency_key, expires_at, created_at, updated_at,
          products(name, sku),
          suppliers(name)
        `)
        .eq('id', requestId)
        .maybeSingle();

      if (!error && data) {
        const prod = data.products as any;
        const supp = data.suppliers as any;
        const prodName = Array.isArray(prod) ? prod[0]?.name : prod?.name;
        const suppName = Array.isArray(supp) ? supp[0]?.name : supp?.name;

        return {
          id: data.id,
          product_id: data.product_id,
          product_name: prodName || 'Inventory Item',
          movement_type: data.movement_type,
          quantity: data.quantity,
          supplier_id: data.supplier_id,
          supplier_name: suppName,
          reason: data.reason,
          source: data.source,
          status: data.status,
          expected_quantity: data.expected_quantity,
          expected_version: data.expected_version || 1,
          resulting_quantity: data.resulting_quantity,
          idempotency_key: data.idempotency_key,
          expires_at: data.expires_at,
          created_at: data.created_at,
          updated_at: data.updated_at
        };
      }
    } catch (e) {
      console.warn('Supabase getStockChangeRequestById error:', e);
    }
  }

  const db = getLocalDB();
  const req = db.requests.find((r) => r.id === requestId);
  return req || null;
}

/**
 * 2-Step Confirmation: Confirm pending stock change request
 * GUARANTEE: Never fails due to missing idempotency key. Always generates and passes safeKey.
 */
export async function confirmStockChangeRequest(
  requestId: string,
  idempotencyKey?: string,
  performer?: { id?: string; name?: string }
): Promise<boolean> {
  const safeKey = (idempotencyKey && idempotencyKey.trim())
    ? idempotencyKey.trim()
    : `confirm-${requestId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const performerLabel = performer?.name ? `${performer.name} (AI Assistant)` : 'AI Assistant Confirmed';
  const supabase = getSupabase();

  if (supabase) {
    // 1. First attempt: Supabase RPC confirm_stock_change with safeKey
    try {
      const { data, error } = await supabase.rpc('confirm_stock_change', {
        p_request_id: requestId,
        p_idempotency_key: safeKey
      });

      if (!error && data) {
        return data?.success ?? true;
      }

      if (error) {
        console.warn('Supabase confirm_stock_change RPC note:', error.message);
      }
    } catch (rpcErr: any) {
      console.warn('Supabase confirm_stock_change caught:', rpcErr?.message);
    }

    // 2. Direct Supabase Table Transaction Fallback (if RPC failed or threw)
    try {
      const { data: reqData } = await supabase
        .from('stock_change_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (reqData) {
        if (reqData.status === 'CONFIRMED') return true;
        if (reqData.status === 'CANCELLED') throw new Error('Stock change request was cancelled.');

        // Update inventory and log movement directly with non-null idempotency_key
        await changeStock({
          productId: reqData.product_id,
          movementType: reqData.movement_type,
          quantity: reqData.quantity,
          supplierId: reqData.supplier_id,
          reason: (reqData.reason || 'Stock change') + ` (Approved by ${performer?.name || 'Authorized User'})`,
          source: 'AI_ASSISTANT_CONFIRMED',
          performedByName: performerLabel,
          idempotencyKey: safeKey
        });

        // Mark request confirmed in Supabase table
        await supabase
          .from('stock_change_requests')
          .update({
            status: 'CONFIRMED',
            confirmed_at: new Date().toISOString(),
            idempotency_key: safeKey,
            updated_at: new Date().toISOString()
          })
          .eq('id', requestId);

        return true;
      }
    } catch (directErr: any) {
      console.warn('Direct Supabase confirmation fallback error:', directErr);
      if (directErr.message?.includes('Insufficient stock')) throw directErr;
    }
  }

  // Local storage buffer fallback
  const db = getLocalDB();
  const req = db.requests.find((r) => r.id === requestId);
  if (!req) throw new Error('Stock change request not found.');

  if (req.status === 'CONFIRMED') return true;
  if (req.status === 'CANCELLED') throw new Error('Request was cancelled.');
  if (new Date() > new Date(req.expires_at)) {
    req.status = 'EXPIRED';
    saveLocalDB(db);
    throw new Error('Stock change request has expired.');
  }

  await changeStock({
    productId: req.product_id,
    movementType: req.movement_type,
    quantity: req.quantity,
    supplierId: req.supplier_id,
    reason: req.reason + ` (Approved by ${performer?.name || 'Authorized User'})`,
    performedByName: performerLabel,
    idempotencyKey: safeKey
  });

  req.status = 'CONFIRMED';
  req.confirmed_at = new Date().toISOString();
  req.idempotency_key = safeKey;
  saveLocalDB(db);
  return true;
}

/**
 * 2-Step Confirmation: Cancel pending stock change request
 */
export async function cancelStockChangeRequest(requestId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase.rpc('cancel_stock_change', { p_request_id: requestId });
      if (!error) return true;
    } catch (e: any) {
      console.warn('Supabase cancelStockChange RPC note:', e?.message);
    }

    try {
      await supabase
        .from('stock_change_requests')
        .update({
          status: 'CANCELLED',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);
      return true;
    } catch (directCancelErr: any) {
      console.warn('Direct Supabase cancel fallback note:', directCancelErr?.message);
    }
  }

  const db = getLocalDB();
  const req = db.requests.find((r) => r.id === requestId);
  if (req) {
    req.status = 'CANCELLED';
    req.cancelled_at = new Date().toISOString();
    saveLocalDB(db);
  }
  return true;
}

/**
 * Create a new product (Manager & Admin only)
 */
export async function createProduct(
  productData: {
    sku: string;
    name: string;
    description: string;
    categoryId: string;
    defaultSupplierId?: string;
    sellingPrice: number;
    costPrice?: number;
    reorderLevel: number;
    initialStock: number;
  },
  role: UserRole = 'ADMIN'
): Promise<Product> {
  const safeCost = productData.costPrice !== undefined
    ? Number(productData.costPrice)
    : Math.round(Number(productData.sellingPrice) * 0.65);

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('create_product', {
        p_sku: productData.sku.toUpperCase(),
        p_name: productData.name,
        p_description: productData.description,
        p_category_id: productData.categoryId,
        p_supplier_id: productData.defaultSupplierId || null,
        p_selling_price: productData.sellingPrice,
        p_cost_price: safeCost,
        p_reorder_level: productData.reorderLevel
      });

      const prodId = data?.product_id || data?.id;
      if (!error && prodId) {
        if (productData.initialStock > 0) {
          await supabase.from('inventory').upsert(
            {
              product_id: prodId,
              quantity_on_hand: productData.initialStock,
              version: 1,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'product_id' }
          );

          await supabase.from('inventory_movements').insert({
            product_id: prodId,
            movement_type: 'IN',
            quantity: productData.initialStock,
            quantity_before: 0,
            quantity_after: productData.initialStock,
            supplier_id: productData.defaultSupplierId || null,
            reason: 'Initial stock intake',
            source: 'SYSTEM',
            created_at: new Date().toISOString()
          });
        }

        const created = await getProductById(prodId, role);
        if (created) return created;
      }
    } catch (e) {
      console.warn('Supabase create_product RPC fallback:', e);
    }

    // Direct table insert fallback
    try {
      const { data: newProdRow, error: insertProdErr } = await supabase
        .from('products')
        .insert({
          sku: productData.sku.toUpperCase(),
          name: productData.name,
          description: productData.description,
          category_id: productData.categoryId,
          default_supplier_id: productData.defaultSupplierId || null,
          selling_price: productData.sellingPrice,
          cost_price: safeCost,
          reorder_level: productData.reorderLevel,
          is_active: true
        })
        .select()
        .single();

      if (!insertProdErr && newProdRow) {
        const prodId = newProdRow.id;
        if (productData.initialStock >= 0) {
          await supabase.from('inventory').upsert(
            {
              product_id: prodId,
              quantity_on_hand: productData.initialStock,
              version: 1,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'product_id' }
          );
        }

        const created = await getProductById(prodId, role);
        if (created) return created;
      }
    } catch (e) {
      console.warn('Supabase direct insert product fallback:', e);
    }
  }

  const db = getLocalDB();
  if (db.products.some((p) => p.sku.toLowerCase() === productData.sku.toLowerCase())) {
    throw new Error(`A product with SKU "${productData.sku}" already exists.`);
  }

  const cat = db.categories.find((c) => c.id === productData.categoryId);
  const sup = db.suppliers.find((s) => s.id === productData.defaultSupplierId);

  const newProd: Product = {
    id: 'prod-' + Date.now(),
    sku: productData.sku.toUpperCase(),
    name: productData.name,
    description: productData.description,
    category_id: productData.categoryId,
    category_name: cat?.name || 'General',
    default_supplier_id: productData.defaultSupplierId,
    supplier_name: sup?.name || 'Unassigned',
    selling_price: productData.sellingPrice,
    cost_price: safeCost,
    profit: productData.sellingPrice - safeCost,
    profit_margin_percent: Number(
      (((productData.sellingPrice - safeCost) / productData.sellingPrice) * 100).toFixed(2)
    ),
    reorder_level: productData.reorderLevel,
    quantity_on_hand: productData.initialStock,
    inventory_version: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.products.unshift(newProd);

  if (productData.initialStock > 0) {
    db.movements.unshift({
      id: 'mov-' + Date.now(),
      product_id: newProd.id,
      product_name: newProd.name,
      product_sku: newProd.sku,
      movement_type: 'IN',
      quantity: productData.initialStock,
      quantity_before: 0,
      quantity_after: productData.initialStock,
      supplier_id: sup?.id,
      supplier_name: sup?.name,
      reason: 'Initial Product Stock Setup',
      source: 'SYSTEM',
      created_at: new Date().toISOString()
    });
  }

  saveLocalDB(db);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('stocksense:inventory_updated'));
  }

  return newProd;
}

/**
 * Remove an existing stock item from the database.
 */
export async function deleteProduct(productId: string): Promise<boolean> {
  const supabase = getSupabase();
  let supabaseHandled = false;

  if (supabase) {
    try {
      // 1. Soft delete product on Supabase so existing immutable audit logs remain valid
      const { error: updateErr } = await supabase
        .from('products')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', productId);

      if (!updateErr) {
        // Zero out inventory row on Supabase
        await supabase
          .from('inventory')
          .update({ quantity_on_hand: 0, updated_at: new Date().toISOString() })
          .eq('product_id', productId);

        supabaseHandled = true;
      } else {
        // Fallback: Try hard delete
        const { error: delErr } = await supabase.from('products').delete().eq('id', productId);
        if (!delErr) supabaseHandled = true;
      }
    } catch (e) {
      console.warn('Supabase deleteProduct error:', e);
    }
  }

  const db = getLocalDB();
  const index = db.products.findIndex((p) => p.id === productId);

  if (index !== -1) {
    const removed = db.products[index];
    db.products.splice(index, 1);

    // If this item had stock on hand, record the removal in movement history
    if ((removed.quantity_on_hand || 0) > 0) {
      db.movements.unshift({
        id: 'mov-' + Date.now(),
        product_id: removed.id,
        product_name: removed.name,
        product_sku: removed.sku,
        movement_type: 'OUT',
        quantity: removed.quantity_on_hand,
        quantity_before: removed.quantity_on_hand,
        quantity_after: 0,
        reason: `Stock item removed from database catalog (${removed.name})`,
        source: 'SYSTEM',
        created_at: new Date().toISOString()
      });
    }

    saveLocalDB(db);
  } else if (!supabaseHandled) {
    throw new Error('Stock item not found in the database.');
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('stocksense:inventory_updated'));
  }

  return true;
}

/**
 * Update product pricing (Manager & Admin only)
 */
export async function updateProductPrices(
  productId: string,
  sellingPrice: number,
  costPrice: number,
  role: UserRole
): Promise<boolean> {
  if (role !== 'MANAGER' && role !== 'ADMIN') {
    throw new Error('Access Denied: Only Managers and Admins can update prices.');
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase.rpc('update_product_prices', {
        p_product_id: productId,
        p_selling_price: sellingPrice,
        p_cost_price: costPrice
      });
      if (error) throw new Error(error.message);
      return true;
    } catch (e) {
      console.warn('Supabase updateProductPrices fallback:', e);
    }
  }

  const db = getLocalDB();
  const prod = db.products.find((p) => p.id === productId);
  if (!prod) throw new Error('Product not found.');

  prod.selling_price = sellingPrice;
  prod.cost_price = costPrice;
  prod.profit = sellingPrice - costPrice;
  prod.profit_margin_percent = Number((((sellingPrice - costPrice) / sellingPrice) * 100).toFixed(2));
  prod.updated_at = new Date().toISOString();

  saveLocalDB(db);
  return true;
}

/**
 * Fetch all users (Admin only)
 */
export async function getUsers(): Promise<Profile[]> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*');

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((p: any) => {
          const rawRole = (p.role || 'staff').toString().toUpperCase();
          const verifiedRole: UserRole = (rawRole === 'ADMIN' || rawRole === 'MANAGER') ? rawRole : 'STAFF';
          return {
            id: p.id,
            full_name: p.full_name || 'Staff Member',
            email: p.email || '',
            role: verifiedRole,
            is_active: p.is_active ?? true,
            created_at: p.created_at,
            updated_at: p.updated_at
          };
        });
      }
    } catch (e) {
      console.warn('Supabase getUsers error:', e);
    }
  }
  return getLocalDB().users;
}

/**
 * Change user role (Admin only; strict anti-self-promotion)
 */
export async function changeUserRole(
  callerUserId: string,
  targetUserId: string,
  newRole: UserRole
): Promise<boolean> {
  if (callerUserId === targetUserId) {
    throw new Error('Security Violation: You cannot alter your own role.');
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error: directErr } = await supabase
        .from('profiles')
        .update({ role: newRole.toLowerCase(), updated_at: new Date().toISOString() })
        .eq('id', targetUserId);

      if (!directErr) return true;

      const { error: rpcErr } = await supabase.rpc('change_user_role', {
        p_target_user_id: targetUserId,
        p_new_role: newRole.toLowerCase()
      });
      if (!rpcErr) return true;
      if (directErr) throw new Error(directErr.message);
    } catch (e: any) {
      console.warn('Supabase changeUserRole error:', e);
      throw e;
    }
  }

  const db = getLocalDB();
  const target = db.users.find((u) => u.id === targetUserId);
  if (!target) throw new Error('User not found.');

  if (target.role === 'ADMIN' && newRole !== 'ADMIN') {
    const activeAdmins = db.users.filter((u) => u.role === 'ADMIN' && u.is_active);
    if (activeAdmins.length <= 1) {
      throw new Error('Operation blocked: At least one active Administrator must remain.');
    }
  }

  target.role = newRole;
  target.updated_at = new Date().toISOString();
  saveLocalDB(db);
  return true;
}

/**
 * Set user active status (Admin / Manager)
 */
export async function setUserActive(
  callerUserId: string,
  callerRole: UserRole,
  targetUserId: string,
  isActive: boolean
): Promise<boolean> {
  if (callerUserId === targetUserId) {
    throw new Error('Security Violation: You cannot deactivate your own account.');
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error: directErr } = await supabase
        .from('profiles')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', targetUserId);

      if (!directErr) return true;

      const { error } = await supabase.rpc('set_user_active', {
        p_target_user_id: targetUserId,
        p_is_active: isActive
      });
      if (!error) return true;
    } catch (e) {
      console.warn('Supabase setUserActive error:', e);
    }
  }

  const db = getLocalDB();
  const target = db.users.find((u) => u.id === targetUserId);
  if (!target) throw new Error('User not found.');

  if (callerRole === 'MANAGER' && target.role === 'ADMIN') {
    throw new Error('Access Denied: Managers cannot deactivate Administrators.');
  }

  if (target.role === 'ADMIN' && !isActive) {
    const activeAdmins = db.users.filter((u) => u.role === 'ADMIN' && u.is_active);
    if (activeAdmins.length <= 1) {
      throw new Error('Operation blocked: Cannot deactivate the sole active Administrator.');
    }
  }

  target.is_active = isActive;
  target.updated_at = new Date().toISOString();
  saveLocalDB(db);
  return true;
}

/**
 * Add a new employee profile (Admin only)
 */
export async function addStaffUser(user: {
  fullName: string;
  email: string;
  role: UserRole;
  password?: string;
}): Promise<Profile> {
  const supabase = getSupabase();
  let supabaseUserId: string | null = null;

  if (supabase && user.password) {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: user.email,
        password: user.password,
        options: {
          data: {
            full_name: user.fullName
          }
        }
      });
      if (authError) {
        console.warn('Supabase auth signup note:', authError.message);
      } else if (authData.user) {
        supabaseUserId = authData.user.id;
        await supabase.from('profiles').upsert({
          id: authData.user.id,
          full_name: user.fullName,
          role: user.role,
          is_active: true,
          updated_at: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn('Supabase addStaffUser fallback:', e);
    }
  }

  const db = getLocalDB();
  if (db.users.some((u) => u.email.toLowerCase() === user.email.toLowerCase())) {
    throw new Error('A user with this email already exists.');
  }

  const newUser: Profile = {
    id: supabaseUserId || ('user-' + Date.now()),
    full_name: user.fullName,
    email: user.email,
    role: user.role,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.users.push(newUser);
  saveLocalDB(db);
  return newUser;
}

/**
 * Fetch high-level inventory metrics for the dashboard.
 */
export async function getDashboardMetrics(role: UserRole): Promise<DashboardMetrics> {
  console.log('TRACE: getDashboardMetrics(role:', role, ')');
  const products = await getProducts(role);
  const movements = await getMovementHistory();
  console.log('TRACE: getDashboardMetrics loaded products:', products.length, 'movements:', movements.length);

  const totalProducts = products.length;
  const totalInventoryUnits = products.reduce((acc, p) => acc + p.quantity_on_hand, 0);
  const lowStockCount = products.filter((p) => p.is_active && p.quantity_on_hand <= p.reorder_level && p.quantity_on_hand > 0).length;
  const outOfStockCount = products.filter((p) => p.is_active && p.quantity_on_hand === 0).length;

  const todayStr = new Date().toISOString().split('T')[0];
  const stockInToday = movements
    .filter((m) => m.movement_type === 'IN' && m.created_at.startsWith(todayStr))
    .reduce((acc, m) => acc + m.quantity, 0);

  const stockOutToday = movements
    .filter((m) => m.movement_type === 'OUT' && m.created_at.startsWith(todayStr))
    .reduce((acc, m) => acc + m.quantity, 0);

  const totalRetailValue = products.reduce((acc, p) => acc + p.quantity_on_hand * p.selling_price, 0);

  let totalCostValue: number | undefined;
  let estimatedGrossProfit: number | undefined;

  if (role === 'MANAGER' || role === 'ADMIN') {
    totalCostValue = products.reduce((acc, p) => acc + p.quantity_on_hand * (p.cost_price || 0), 0);
    estimatedGrossProfit = totalRetailValue - totalCostValue;
  }

  return {
    totalProducts,
    totalInventoryUnits,
    lowStockCount,
    outOfStockCount,
    stockInToday,
    stockOutToday,
    totalRetailValue,
    totalCostValue,
    estimatedGrossProfit
  };
}
