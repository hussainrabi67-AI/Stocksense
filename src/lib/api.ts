import { getSupabase } from './supabase';
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
// CORE API EXPORTS — Supabase only, no mock data
// ==============================================================================

/**
 * Filter product data based on user role.
 * STAFF members must never see cost_price, profit, or margin.
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
 * Fetch all products, securely filtered for the caller's role via get_inventory_dashboard RPC.
 */
export async function getProducts(role: UserRole = 'STAFF'): Promise<Product[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured');

  const safeRole = (role || 'STAFF').toString().toUpperCase() as UserRole;
  const isElevated = safeRole === 'ADMIN' || safeRole === 'MANAGER';

  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!userData?.user) throw new Error('No authenticated Supabase user');

  const { data, error } = await supabase.rpc('get_inventory_dashboard');
  if (error) throw error;

  return (data || []).map((item: any) => {
    const sell = Number(item.selling_price);
    const cost = isElevated ? Number(item.cost_price) : undefined;

    const product: Product = {
      id: item.id,
      sku: item.sku,
      name: item.name,
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

/**
 * Fetch a single product by ID or SKU.
 */
export async function getProductById(idOrSku: string, role: UserRole = 'STAFF'): Promise<Product | null> {
  const products = await getProducts(role);
  return products.find(
    (p) => p.id === idOrSku || p.sku.toLowerCase() === idOrSku.toLowerCase()
  ) || null;
}

/**
 * Fetch categories.
 */
export async function getCategories(): Promise<Category[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured');

  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) throw error;
  return data || [];
}

/**
 * Create a new category.
 */
export async function createCategory(cat: { name: string; code: string; description?: string }): Promise<Category> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured');

  const { data, error } = await supabase
    .from('categories')
    .insert([{
      name: cat.name.trim(),
      code: cat.code.trim().toUpperCase(),
      description: cat.description?.trim() || null
    }])
    .select()
    .single();

  if (error) throw error;
  return data as Category;
}

/**
 * Fetch suppliers.
 */
export async function getSuppliers(): Promise<Supplier[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured');

  const { data, error } = await supabase.from('suppliers').select('*').order('name');
  if (error) throw error;
  return data || [];
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
  if (!supabase) throw new Error('Supabase is not configured');

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

  if (error) throw error;
  return data as Supplier;
}

/**
 * Fetch low stock products (quantity <= reorder_level).
 */
export async function getLowStockProducts(role: UserRole = 'STAFF'): Promise<Product[]> {
  const products = await getProducts(role);
  return products.filter((p) => p.is_active && p.quantity_on_hand <= p.reorder_level);
}

/**
 * Transactional stock mutation via Supabase RPC `change_stock`.
 * Rejects negative stock. Never allows inventory < 0.
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
  const { productId, movementType, quantity, supplierId, reason, source = 'MANUAL', referenceId, idempotencyKey } = params;

  if (quantity <= 0) {
    throw new Error('Quantity must be greater than zero.');
  }

  const safeKey = (idempotencyKey && idempotencyKey.trim())
    ? idempotencyKey.trim()
    : `stock-${productId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured');

  const { data, error } = await supabase.rpc('change_stock', {
    p_product_id: productId,
    p_movement_type: movementType,
    p_quantity: quantity,
    p_supplier_id: supplierId || null,
    p_reason: reason,
    p_source: source,
    p_reference_id: referenceId || null,
    p_idempotency_key: safeKey
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Stock change failed: no response from server');

  return {
    success: true,
    movementId: data.movement_id || 'supabase-' + Date.now(),
    quantityBefore: data.quantity_before,
    quantityAfter: data.quantity_after
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
  if (!supabase) throw new Error('Supabase is not configured');

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
  if (error) throw error;

  let movements = (data || []).map((item: any) => ({
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

  if (filters?.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    movements = movements.filter(
      (m: InventoryMovement) =>
        m.product_name?.toLowerCase().includes(q) ||
        m.product_sku?.toLowerCase().includes(q) ||
        m.reason?.toLowerCase().includes(q) ||
        m.supplier_name?.toLowerCase().includes(q)
    );
  }

  return movements;
}

export interface TopProductSalesItem {
  product: Product;
  unitsSold: number;
  transactionsCount: number;
  retailRevenue: number;
  grossProfit?: number;
  lastSoldAt: string;
}

export interface WeeklySalesAnalysis {
  topItem: TopProductSalesItem | null;
  rankings: TopProductSalesItem[];
  totalUnitsSoldAll: number;
  totalRetailRevenueAll: number;
  totalGrossProfitAll?: number;
  days: number;
}

/**
 * Fetch top selling products based on real outbound movements.
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

  let weeklyOutMovements = movements.filter((m) => {
    if (m.movement_type !== 'OUT') return false;
    const mTime = new Date(m.created_at).getTime();
    return !isNaN(mTime) && mTime >= cutoffTime;
  });

  if (weeklyOutMovements.length === 0) {
    weeklyOutMovements = movements.filter((m) => m.movement_type === 'OUT');
  }

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
  if (!supabase) throw new Error('Supabase is not configured');

  const { data, error } = await supabase.rpc('prepare_stock_change', {
    p_product_id: productId,
    p_movement_type: movementType,
    p_quantity: quantity,
    p_supplier_id: supplierId || null,
    p_reason: reason,
    p_source: source,
    p_idempotency_key: safeKey
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Failed to prepare stock change request');

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

/**
 * 2-Step Confirmation: Fetch pending stock change request details by request_id
 */
export async function getStockChangeRequestById(requestId: string): Promise<StockChangeRequest | null> {
  if (!requestId) return null;
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured');

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

  if (error) throw error;
  if (!data) return null;

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

/**
 * 2-Step Confirmation: Confirm pending stock change request
 */
export async function confirmStockChangeRequest(
  requestId: string,
  idempotencyKey?: string,
  performer?: { id?: string; name?: string }
): Promise<boolean> {
  const safeKey = (idempotencyKey && idempotencyKey.trim())
    ? idempotencyKey.trim()
    : `confirm-${requestId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured');

  const { data, error } = await supabase.rpc('confirm_stock_change', {
    p_request_id: requestId,
    p_idempotency_key: safeKey
  });

  if (error) throw new Error(error.message);
  return data?.success ?? true;
}

/**
 * 2-Step Confirmation: Cancel pending stock change request
 */
export async function cancelStockChangeRequest(requestId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured');

  const { error } = await supabase.rpc('cancel_stock_change', { p_request_id: requestId });
  if (error) throw new Error(error.message);
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
    : 0;

  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured');

  const { data, error } = await supabase.rpc('create_product', {
    p_sku: productData.sku.toUpperCase(),
    p_name: productData.name,
    p_description: productData.description,
    p_category_id: productData.categoryId,
    p_supplier_id: productData.defaultSupplierId || null,
    p_selling_price: productData.sellingPrice,
    p_cost_price: safeCost,
    p_reorder_level: productData.reorderLevel,
    p_initial_stock: productData.initialStock
  });

  if (error) throw new Error(error.message);

  const prodId = data?.product_id || data?.id;
  if (!prodId) throw new Error('Failed to create product: no product ID returned');

  const created = await getProductById(prodId, role);
  if (!created) throw new Error('Product was created but could not be fetched');

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('stocksense:inventory_updated'));
  }

  return created;
}

/**
 * Remove an existing stock item from the database (soft delete).
 */
export async function deleteProduct(productId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured');

  const { error: updateErr } = await supabase
    .from('products')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', productId);

  if (updateErr) throw new Error(updateErr.message);

  await supabase
    .from('inventory')
    .update({ quantity_on_hand: 0, updated_at: new Date().toISOString() })
    .eq('product_id', productId);

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
  if (!supabase) throw new Error('Supabase is not configured');

  const { error } = await supabase.rpc('update_product_prices', {
    p_product_id: productId,
    p_selling_price: sellingPrice,
    p_cost_price: costPrice
  });

  if (error) throw new Error(error.message);
  return true;
}

/**
 * Fetch all users (Admin only)
 */
export async function getUsers(): Promise<Profile[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No active session');

  const { data, error } = await supabase.from('profiles').select('*');
  if (error) throw error;

  return (data || []).map((p: any) => {
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
  if (!supabase) throw new Error('Supabase is not configured');

  const { error } = await supabase.rpc('change_user_role', {
    p_target_user_id: targetUserId,
    p_new_role: newRole.toLowerCase()
  });

  if (error) throw new Error(error.message);
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
  if (!supabase) throw new Error('Supabase is not configured');

  const { error } = await supabase.rpc('set_user_active', {
    p_target_user_id: targetUserId,
    p_is_active: isActive
  });

  if (error) throw new Error(error.message);
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
  if (!supabase) throw new Error('Supabase is not configured');

  if (!user.password) {
    throw new Error('A password is required to create a new staff account.');
  }

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: user.email,
    password: user.password,
    options: {
      data: {
        full_name: user.fullName
      }
    }
  });

  if (authError) throw new Error(authError.message);
  if (!authData.user) throw new Error('Failed to create auth account');

  // The handle_new_user trigger auto-creates a STAFF profile.
  // If the role should be different, update it via RPC (requires admin session).
  if (user.role !== 'STAFF') {
    await supabase.rpc('change_user_role', {
      p_target_user_id: authData.user.id,
      p_new_role: user.role.toLowerCase()
    });
  }

  // Fetch the created profile
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileErr) throw new Error(profileErr.message);

  return {
    id: authData.user.id,
    full_name: user.fullName,
    email: user.email,
    role: user.role,
    is_active: profile?.is_active ?? true,
    created_at: profile?.created_at || new Date().toISOString(),
    updated_at: profile?.updated_at || new Date().toISOString()
  };
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
