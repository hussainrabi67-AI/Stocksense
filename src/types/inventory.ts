export type UserRole = 'STAFF' | 'MANAGER' | 'ADMIN';

export type MovementType = 'IN' | 'OUT' | 'DAMAGE' | 'ADJUSTMENT';

export type RequestStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  code: string;
  description?: string;
  created_at?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  is_active: boolean;
  created_at?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  category_id: string;
  default_supplier_id?: string;
  selling_price: number;
  cost_price?: number; // Restricted from STAFF
  profit?: number; // Restricted from STAFF
  profit_margin_percent?: number; // Restricted from STAFF
  reorder_level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  quantity_on_hand: number;
  inventory_version?: number;
  category_name?: string;
  supplier_name?: string;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  movement_type: MovementType;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  supplier_id?: string;
  reason: string;
  source: string;
  performed_by?: string;
  performer_name?: string;
  product_name?: string;
  product_sku?: string;
  supplier_name?: string;
  reference_id?: string;
  idempotency_key?: string;
  created_at: string;
}

export interface StockChangeRequest {
  id: string;
  product_id: string;
  product_name?: string;
  requested_by?: string;
  movement_type: MovementType;
  quantity: number;
  supplier_id?: string;
  supplier_name?: string;
  reason: string;
  source: string;
  status: RequestStatus;
  expected_quantity: number;
  expected_version: number;
  resulting_quantity: number;
  idempotency_key?: string;
  expires_at: string;
  confirmed_at?: string;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user_name?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  before_data?: Record<string, unknown>;
  after_data?: Record<string, unknown>;
  source: string;
  created_at: string;
}

export interface DashboardMetrics {
  totalProducts: number;
  totalInventoryUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  stockInToday: number;
  stockOutToday: number;
  totalRetailValue?: number;
  totalCostValue?: number; // Manager/Admin only
  estimatedGrossProfit?: number; // Manager/Admin only
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  source?: 'supabase' | 'n8n';
  confirmationRequest?: StockChangeRequest;
  productCard?: Partial<Product>;
  error?: boolean;
}
