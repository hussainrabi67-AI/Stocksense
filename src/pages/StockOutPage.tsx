import React, { useState, useEffect } from 'react';
import {
  ArrowUpFromLine,
  AlertTriangle,
  CheckCircle2,
  Package,
  FileText,
  Hash,
  ShieldAlert,
  History,
  Layers,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getProducts, changeStock } from '../lib/api';
import { Product, MovementType } from '../types/inventory';
import { Badge } from '../components/common/Badge';

interface StockOutPageProps {
  preselectedProductId?: string;
  onNavigate: (path: string) => void;
}

export const StockOutPage: React.FC<StockOutPageProps> = ({
  preselectedProductId,
  onNavigate
}) => {
  const { user, role } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [selectedProductId, setSelectedProductId] = useState(preselectedProductId || '');
  const [movementType, setMovementType] = useState<MovementType>('OUT');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [reason, setReason] = useState('Customer checkout counter sale');
  const [referenceId, setReferenceId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    movementId: string;
    productName: string;
    quantityBefore: number;
    quantityAfter: number;
    quantityDeducted: number;
    type: MovementType;
  } | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const prods = await getProducts(role);
        const activeProds = prods.filter((p) => p.is_active);
        setProducts(activeProds);

        if (preselectedProductId) {
          setSelectedProductId(preselectedProductId);
        } else if (activeProds.length > 0) {
          setSelectedProductId(activeProds[0].id);
        }
      } catch (e) {
        console.error('Failed to load products for stock out:', e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [role, preselectedProductId]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const currentStock = selectedProduct?.quantity_on_hand ?? 0;
  const qtyNumber = typeof quantity === 'number' ? quantity : 0;

  // Strict validation check
  const isInsufficientStock = qtyNumber > currentStock;
  const newStock = currentStock - qtyNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedProductId) {
      setErrorMessage('Please choose an item from the inventory.');
      return;
    }
    if (!qtyNumber || qtyNumber <= 0) {
      setErrorMessage('Quantity must be greater than zero.');
      return;
    }

    // STRICT INVENTORY SECURITY: Section 18
    if (isInsufficientStock) {
      setErrorMessage(`Insufficient stock. Available quantity: ${currentStock}. Cannot dispatch ${qtyNumber} units.`);
      return;
    }

    if (!reason.trim()) {
      setErrorMessage('A reason for the stock deduction is mandatory.');
      return;
    }

    setIsSubmitting(true);
    const idempotencyKey = `stock-out-${selectedProductId}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    try {
      const res = await changeStock({
        productId: selectedProductId,
        movementType,
        quantity: qtyNumber,
        reason: reason.trim(),
        referenceId: referenceId.trim() || undefined,
        performedByName: user?.full_name || 'Staff Member',
        idempotencyKey
      });

      setSuccessResult({
        movementId: res.movementId,
        productName: selectedProduct?.name || 'Item',
        quantityBefore: res.quantityBefore,
        quantityAfter: res.quantityAfter,
        quantityDeducted: qtyNumber,
        type: movementType
      });

      // Update current state
      setQuantity('');
      setReferenceId('');
      if (selectedProduct) {
        selectedProduct.quantity_on_hand = res.quantityAfter;
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Stock OUT operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            <ArrowUpFromLine className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Stock OUT & Dispatch</h1>
            <p className="text-xs text-slate-500">Record customer sales, damaged goods, or internal mall store transfers</p>
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
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 shadow-xs animate-in fade-in">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-blue-950">
                Stock Deduction Recorded Successfully
              </h3>
              <p className="text-xs text-blue-800 mt-1">
                Dispatched <strong>-{successResult.quantityDeducted} units</strong> from{' '}
                <strong>{successResult.productName}</strong>.
              </p>

              <div className="mt-3 bg-white/80 rounded-xl p-3 border border-blue-200/60 inline-flex items-center gap-6 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Before</span>
                  <span className="font-mono text-slate-700">{successResult.quantityBefore} units</span>
                </div>
                <div className="text-blue-600 font-bold">→</div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Remaining Balance</span>
                  <span className="font-mono font-extrabold text-blue-900 text-sm">
                    {successResult.quantityAfter} units
                  </span>
                </div>
                <div className="border-l border-blue-200 pl-4">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Audit ID</span>
                  <span className="font-mono text-slate-600 text-[11px]">{successResult.movementId.slice(0, 14)}...</span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => setSuccessResult(null)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                >
                  Record Another Dispatch
                </button>
                <button
                  onClick={() => onNavigate('/inventory')}
                  className="px-3 py-1.5 bg-white border border-blue-300 text-blue-800 hover:bg-blue-100/50 rounded-lg text-xs font-semibold"
                >
                  View Live Inventory
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Stock OUT Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        {products.length === 0 && !isLoading ? (
          <div className="py-10 text-center space-y-3">
            <Package className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">Your Catalog is Empty</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Before recording customer sales or stock dispatches, you must first register products in your catalog.
            </p>
            <button
              onClick={() => onNavigate('/products')}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
            >
              <Package className="w-4 h-4" />
              <span>Go to Products & Add Items</span>
            </button>
          </div>
        ) : (
          <>
            {errorMessage && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-700 animate-in fade-in">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
                <div>
                  <strong className="font-bold block">Validation Error:</strong>
                  {errorMessage}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
          {/* Movement Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Operation Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMovementType('OUT');
                  setReason('Customer checkout sale');
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  movementType === 'OUT'
                    ? 'bg-blue-50 border-blue-300 text-blue-700 ring-2 ring-blue-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ArrowUpFromLine className="w-3.5 h-3.5" />
                <span>Customer Sale (OUT)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMovementType('DAMAGE');
                  setReason('Item damaged or expired in transit/counter');
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  movementType === 'DAMAGE'
                    ? 'bg-rose-50 border-rose-300 text-rose-700 ring-2 ring-rose-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Damaged Goods</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMovementType('ADJUSTMENT');
                  setReason('Periodic physical count audit adjustment');
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  movementType === 'ADJUSTMENT'
                    ? 'bg-amber-50 border-amber-300 text-amber-700 ring-2 ring-amber-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Audit Adjustment</span>
              </button>
            </div>
          </div>

          {/* Product Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              <span>Target Product / SKU *</span>
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              required
              className="w-full px-3 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} [{p.sku}] — Current Stock: {p.quantity_on_hand}
                </option>
              ))}
            </select>
          </div>

          {/* Real-time Math Calculator & Negative Stock Guard Banner */}
          <div className={`border rounded-xl p-4 transition-colors ${
            isInsufficientStock 
              ? 'bg-rose-50 border-rose-200' 
              : 'bg-slate-50 border-slate-200/80'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Predicted Inventory Impact
              </span>
              {isInsufficientStock && (
                <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" /> Blocked: Insufficient Stock
                </span>
              )}
            </div>

            <div className="grid grid-cols-5 items-center text-center">
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-400">Current Stock</div>
                <div className="text-lg font-bold text-slate-700">{currentStock}</div>
              </div>
              <div className="text-xl font-bold text-rose-600">-</div>
              <div>
                <div className="text-[10px] uppercase font-semibold text-rose-600">Deduct Qty</div>
                <div className="text-lg font-bold text-rose-600 font-mono">
                  {qtyNumber > 0 ? qtyNumber : 0}
                </div>
              </div>
              <div className="text-xl font-bold text-slate-400">=</div>
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-900">Projected Balance</div>
                <div className={`text-xl font-black font-mono ${
                  isInsufficientStock ? 'text-rose-600' : 'text-slate-900'
                }`}>
                  {isInsufficientStock ? 'INVALID' : newStock}
                </div>
              </div>
            </div>

            {isInsufficientStock && (
              <p className="mt-3 text-xs text-rose-700 bg-rose-100/70 p-2 rounded-lg font-medium">
                Insufficient stock. Available quantity: <strong>{currentStock}</strong>. The system will reject any negative stock transaction.
              </p>
            )}
          </div>

          {/* Quantity & Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <span>Quantity to Dispatch *</span>
              </label>
              <input
                type="number"
                min="1"
                max={currentStock}
                step="1"
                required
                placeholder="e.g. 5"
                value={quantity}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                  setQuantity(val);
                }}
                className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:ring-2 font-mono ${
                  isInsufficientStock
                    ? 'border-rose-300 focus:ring-rose-500 bg-rose-50/20'
                    : 'border-slate-300 focus:ring-blue-500'
                }`}
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Max available: {currentStock} units
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                POS Receipt / Customer Reference
              </label>
              <input
                type="text"
                placeholder="e.g. REC-NOWSHERA-1082"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                className="w-full px-3 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Mandatory Reason / Note *</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sold to walk-in customer at Counter 2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-[11px] text-slate-400">
              Transaction logged in Supabase audit history
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
                disabled={isSubmitting || qtyNumber <= 0 || isInsufficientStock || currentStock === 0}
                className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ArrowUpFromLine className="w-4 h-4" />
                )}
                <span>Record Stock OUT</span>
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
