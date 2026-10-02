import React, { useState, useEffect } from 'react';
import {
  ArrowDownToLine,
  CheckCircle2,
  AlertCircle,
  Package,
  Truck,
  FileText,
  Hash,
  ShieldCheck,
  History,
  Layers
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getProducts, getSuppliers, changeStock } from '../lib/api';
import { Product, Supplier } from '../types/inventory';

interface StockInPageProps {
  preselectedProductId?: string;
  onNavigate: (path: string) => void;
}

export const StockInPage: React.FC<StockInPageProps> = ({
  preselectedProductId,
  onNavigate
}) => {
  const { user, role } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [selectedProductId, setSelectedProductId] = useState(preselectedProductId || '');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [supplierId, setSupplierId] = useState('');
  const [reason, setReason] = useState('Stock shipment received from supplier');
  const [referenceId, setReferenceId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    movementId: string;
    productName: string;
    quantityBefore: number;
    quantityAfter: number;
    quantityAdded: number;
  } | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [prods, sups] = await Promise.all([getProducts(role), getSuppliers()]);
        const activeProds = prods.filter((p) => p.is_active);
        setProducts(activeProds);
        setSuppliers(sups);

        if (preselectedProductId) {
          setSelectedProductId(preselectedProductId);
          const matched = activeProds.find((p) => p.id === preselectedProductId);
          if (matched?.default_supplier_id) {
            setSupplierId(matched.default_supplier_id);
          }
        } else if (activeProds.length > 0) {
          setSelectedProductId(activeProds[0].id);
          if (activeProds[0].default_supplier_id) {
            setSupplierId(activeProds[0].default_supplier_id);
          }
        }
      } catch (e) {
        console.error('Failed to load products for stock in:', e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [role, preselectedProductId]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // Auto-set default supplier when product changes
  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    const prod = products.find((p) => p.id === productId);
    if (prod?.default_supplier_id) {
      setSupplierId(prod.default_supplier_id);
    }
  };

  const qtyNumber = typeof quantity === 'number' ? quantity : 0;
  const currentStock = selectedProduct?.quantity_on_hand ?? 0;
  const newStock = currentStock + qtyNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      setErrorMessage('Please select a product.');
      return;
    }
    if (!qtyNumber || qtyNumber <= 0) {
      setErrorMessage('Quantity must be an integer greater than zero.');
      return;
    }
    if (!reason.trim()) {
      setErrorMessage('A reason or receiving note is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    // Client idempotency key preventing double clicks / network duplicates
    const idempotencyKey = `stock-in-${selectedProductId}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    try {
      const res = await changeStock({
        productId: selectedProductId,
        movementType: 'IN',
        quantity: qtyNumber,
        supplierId: supplierId || undefined,
        reason: reason.trim(),
        referenceId: referenceId.trim() || undefined,
        performedByName: user?.full_name || 'Staff Operator',
        idempotencyKey
      });

      setSuccessResult({
        movementId: res.movementId,
        productName: selectedProduct?.name || 'Item',
        quantityBefore: res.quantityBefore,
        quantityAfter: res.quantityAfter,
        quantityAdded: qtyNumber
      });

      // Reset form
      setQuantity('');
      setReferenceId('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Stock IN operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <ArrowDownToLine className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Stock IN (Receive Shipment)</h1>
            <p className="text-xs text-slate-500">Record supplier intake and increase on-hand inventory</p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('/history')}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
        >
          <History className="w-3.5 h-3.5" />
          <span>Movement History</span>
        </button>
      </div>

      {/* Success Notification */}
      {successResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 shadow-xs animate-in fade-in">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-emerald-950">
                Stock IN Transaction Confirmed
              </h3>
              <p className="text-xs text-emerald-800 mt-1">
                Successfully recorded <strong>+{successResult.quantityAdded} units</strong> for{' '}
                <strong>{successResult.productName}</strong>.
              </p>

              <div className="mt-3 bg-white/80 rounded-xl p-3 border border-emerald-200/60 inline-flex items-center gap-6 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Before</span>
                  <span className="font-mono text-slate-700">{successResult.quantityBefore} units</span>
                </div>
                <div className="text-emerald-600 font-bold">→</div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Now In Stock</span>
                  <span className="font-mono font-extrabold text-emerald-700 text-sm">
                    {successResult.quantityAfter} units
                  </span>
                </div>
                <div className="border-l border-emerald-200 pl-4">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Audit ID</span>
                  <span className="font-mono text-slate-600 text-[11px]">{successResult.movementId.slice(0, 14)}...</span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => setSuccessResult(null)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                >
                  Receive Another Item
                </button>
                <button
                  onClick={() => onNavigate('/inventory')}
                  className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/50 rounded-lg text-xs font-semibold"
                >
                  View Inventory
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Stock IN Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        {products.length === 0 && !isLoading ? (
          <div className="py-10 text-center space-y-3">
            <Package className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">Your Catalog is Empty</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Before receiving stock shipments, you must first register products in your catalog.
            </p>
            <button
              onClick={() => onNavigate('/products')}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
            >
              <Package className="w-4 h-4" />
              <span>Go to Products & Add Items</span>
            </button>
          </div>
        ) : (
          <>
            {errorMessage && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-700 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <div>{errorMessage}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
          {/* Product Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              <span>Target Product / SKU *</span>
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => handleProductChange(e.target.value)}
              required
              className="w-full px-3 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} [{p.sku}] — Current Stock: {p.quantity_on_hand}
                </option>
              ))}
            </select>
          </div>

          {/* Real-time Math Calculator Display (Section 17: CURRENT STOCK + QUANTITY = NEW STOCK) */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Calculated On-Hand Balance
            </div>
            <div className="grid grid-cols-5 items-center text-center">
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-400">Current Stock</div>
                <div className="text-lg font-bold text-slate-700">{currentStock}</div>
              </div>
              <div className="text-xl font-bold text-emerald-600">+</div>
              <div>
                <div className="text-[10px] uppercase font-semibold text-emerald-600">Stock IN Qty</div>
                <div className="text-lg font-bold text-emerald-600 font-mono">
                  {qtyNumber > 0 ? qtyNumber : 0}
                </div>
              </div>
              <div className="text-xl font-bold text-slate-400">=</div>
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-900">New Total Stock</div>
                <div className="text-xl font-black text-slate-900 font-mono">
                  {newStock}
                </div>
              </div>
            </div>
          </div>

          {/* Quantity & Supplier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <span>Quantity to Receive *</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                placeholder="e.g. 50"
                value={quantity}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                  setQuantity(val);
                }}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-slate-400" />
                <span>Source Supplier</span>
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="">Unspecified / General Depot</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reason & Reference ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Receiving Reason *</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Weekly Restock from Ali Traders"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Purchase Order / Invoice #
              </label>
              <input
                type="text"
                placeholder="e.g. PO-2026-0941"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                className="w-full px-3 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Transaction locked via Supabase RPC</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('/inventory')}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || qtyNumber <= 0}
                className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ArrowDownToLine className="w-4 h-4" />
                )}
                <span>Record Stock IN</span>
              </button>
            </div>
          </div>
        </form>
        </>
        )}
      </div>
    </div>
  );
};
