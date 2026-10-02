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
// LOCAL STORAGE BUFFER (Empty by default — ZERO fake data generated)
// Used only as local transient buffer when user has not yet connected live Supabase
// ==============================================================================

interface LocalDB {
  products: Product[];
  movements: InventoryMovement[];
  requests: StockChangeRequest[];
  categories: Category[];
  suppliers: Supplier[];
  users: Profile[];
}

function getLocalDB(): LocalDB {
  if (typeof window === 'undefined') {
    return {
      products: [],
      movements: [],
      requests: [],
      categories: [],
      suppliers: [],
      users: []
    };
  }

  const storedProd = localStorage.getItem('stocksense_db_products');
  const storedMov = localStorage.getItem('stocksense_db_movements');
  const storedReq = localStorage.getItem('stocksense_db_requests');
  const storedCats = localStorage.getItem('stocksense_db_categories');
  const storedSups = localStorage.getItem('stocksense_db_suppliers');
  const storedUsers = localStorage.getItem('stocksense_db_users');

  return {
    products: storedProd ? (JSON.parse(storedProd) as Product[]) : [],
    movements: storedMov ? (JSON.parse(storedMov) as InventoryMovement[]) : [],
    requests: storedReq ? (JSON.parse(storedReq) as StockChangeRequest[]) : [],
    categories: storedCats ? (JSON.parse(storedCats) as Category[]) : [],
    suppliers: storedSups ? (JSON.parse(storedSups) as Supplier[]) : [],
    users: storedUsers ? (JSON.parse(storedUsers) as Profile[]) : []
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

  if (supabase) {
    try {
      // Base table query with join
      const { data: rawData, error: rawError } = await supabase
        .from('products')
        .select(`
          id, sku, name, description, category_id, default_supplier_id,
          selling_price, ${role !== 'STAFF' ? 'cost_price,' : ''}
          reorder_level, is_active, created_at, updated_at,
          inventory(quantity_on_hand, version),
          categories(name),
          suppliers(name)
        `)
        .order('name');

      if (!rawError && rawData) {
        return rawData.map((item: any) => {
          const inv = Array.isArray(item.inventory) ? item.inventory[0] : item.inventory;
          const cat = Array.isArray(item.categories) ? item.categories[0] : item.categories;
          const sup = Array.isArray(item.suppliers) ? item.suppliers[0] : item.suppliers;
          const qty = inv?.quantity_on_hand ?? 0;
          const cost = role !== 'STAFF' ? Number(item.cost_price) : undefined;
          const sell = Number(item.selling_price);

          const prod: Product = {
            id: item.id,
            sku: item.sku,
            name: item.name,
            description: item.description || '',
            category_id: item.category_id,
            category_name: cat?.name || 'General',
            default_supplier_id: item.default_supplier_id,
            supplier_name: sup?.name || 'Unassigned',
            selling_price: sell,
            cost_price: cost,
            profit: cost !== undefined ? sell - cost : undefined,
            profit_margin_percent: cost !== undefined && sell > 0 ? Number(((sell - cost) / sell * 100).toFixed(2)) : undefined,
            reorder_level: item.reorder_level || 10,
            quantity_on_hand: qty,
            inventory_version: inv?.version || 1,
            is_active: item.is_active ?? true,
            created_at: item.created_at,
            updated_at: item.updated_at
          };
          return sanitizeProductForRole(prod, role);
        });
      }
    } catch (err) {
      console.warn('Supabase query error:', err);
    }
  }

  // Pure local storage buffer (empty if nothing added yet)
  const db = getLocalDB();
  return db.products.map((p) => sanitizeProductForRole(p, role));
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
  if (supabase) {
    try {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getCategories error:', e);
    }
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
  if (supabase) {
    try {
      const { data, error } = await supabase.from('suppliers').select('*').order('name');
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getSuppliers error:', e);
    }
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

  const supabase = getSupabase();

  if (supabase) {
    // 1. Try Supabase RPC change_stock with correct parameter names
    try {
      const { data, error } = await supabase.rpc('change_stock', {
        p_product_id: productId,
        p_movement_type: movementType,
        p_quantity: quantity,
        p_supplier_id: supplierId || null,
        p_reason: reason,
        p_source: source,
        p_idempotency_key: idempotencyKey || null
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
      const { data: { user } } = await supabase.auth.getUser();

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
        performed_by: user?.id || null,
        reference_id: referenceId || null,
        idempotency_key: idempotencyKey || null,
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

  // Local storage buffer fallback
  const db = getLocalDB();
  const prodIndex = db.products.findIndex((p) => p.id === productId);

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
  const supplier = db.suppliers.find((s) => s.id === (supplierId || prod.default_supplier_id));

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
      console.warn('Supabase getMovementHistory fallback:', e);
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

  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('prepare_stock_change', {
        p_product_id: productId,
        p_movement_type: movementType,
        p_quantity: quantity,
        p_supplier_id: supplierId || null,
        p_reason: reason,
        p_source: source
      });

      if (error) throw new Error(error.message);

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
        idempotency_key: idempotencyKey,
        expires_at: data.expires_at,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    } catch (e: any) {
      if (e.message && e.message.includes('Insufficient stock')) throw e;
      console.warn('Supabase prepareStockChange fallback:', e);
    }
  }

  const db = getLocalDB();
  const prod = db.products.find((p) => p.id === productId);
  if (!prod) throw new Error('Product not found.');

  const current = prod.quantity_on_hand;
  let resulting = current;

  if (movementType === 'IN') {
    resulting = current + quantity;
  } else {
    if (current < quantity) {
      throw new Error(`Insufficient stock. Available quantity: ${current}.`);
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
    idempotency_key: idempotencyKey,
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
 */
export async function confirmStockChangeRequest(requestId: string, idempotencyKey?: string): Promise<boolean> {
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('confirm_stock_change', {
        p_request_id: requestId,
        p_idempotency_key: idempotencyKey || null
      });
      if (error) throw new Error(error.message);
      return data?.success ?? true;
    } catch (e: any) {
      if (e.message && !e.message.includes('fetch failed')) {
        throw e;
      }
      console.warn('Supabase confirmStockChange fallback:', e);
    }
  }

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
    reason: req.reason + ' (AI Confirmed)',
    performedByName: 'AI Copilot Confirmed'
  });

  req.status = 'CONFIRMED';
  req.confirmed_at = new Date().toISOString();
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
      if (error) throw new Error(error.message);
      return true;
    } catch (e: any) {
      if (e.message && !e.message.includes('fetch failed')) {
        throw e;
      }
      console.warn('Supabase cancelStockChange fallback:', e);
    }
  }

  const db = getLocalDB();
  const req = db.requests.find((r) => r.id === requestId);
  if (req && req.status === 'PENDING') {
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
    costPrice: number;
    reorderLevel: number;
    initialStock: number;
  },
  role: UserRole
): Promise<Product> {
  if (role !== 'MANAGER' && role !== 'ADMIN') {
    throw new Error('Access Denied: Only Managers and Admins can create products.');
  }

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
        p_cost_price: productData.costPrice,
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
          cost_price: productData.costPrice,
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
    cost_price: productData.costPrice,
    profit: productData.sellingPrice - productData.costPrice,
    profit_margin_percent: Number(
      (((productData.sellingPrice - productData.costPrice) / productData.sellingPrice) * 100).toFixed(2)
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
  return newProd;
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
        .select('id, full_name, role, is_active, created_at, updated_at')
        .order('full_name');

      if (!error && data) {
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
      console.warn('Supabase getUsers fallback:', e);
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
}): Promise<Profile> {
  const db = getLocalDB();
  if (db.users.some((u) => u.email.toLowerCase() === user.email.toLowerCase())) {
    throw new Error('A user with this email already exists.');
  }

  const newUser: Profile = {
    id: 'user-' + Date.now(),
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
  const products = await getProducts(role);
  const movements = await getMovementHistory();

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
