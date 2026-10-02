import React, { useState } from 'react';
import { Check, X, Clock, AlertCircle, ShieldCheck } from 'lucide-react';
import { StockChangeRequest, UserRole } from '../../types/inventory';
import { confirmStockChangeViaN8n, cancelStockChangeViaN8n } from '../../lib/ai';

interface AIStockConfirmationCardProps {
  request: StockChangeRequest;
  user?: { id: string; name: string; role: UserRole };
  onConfirm?: (requestId: string) => Promise<void>;
  onSuccess?: () => void;
  onCancelled?: () => void;
}

export const AIStockConfirmationCard: React.FC<AIStockConfirmationCardProps> = ({
  request,
  user,
  onConfirm,
  onSuccess,
  onCancelled
}) => {
  const [status, setStatus] = useState<string>(request.status || 'PENDING');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fallbackUser = {
    id: user?.id || 'active-user',
    name: user?.name || 'Staff Member',
    role: user?.role || 'STAFF'
  };

  // Prevent double confirmation
  const handleConfirm = async () => {
    if (status !== 'PENDING' || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Return that id with confirmed msg to update that stock
      if (onConfirm) {
        await onConfirm(request.id);
      } else {
        await confirmStockChangeViaN8n(request.id, fallbackUser);
      }
      setStatus('CONFIRMED');

      // Refresh inventory from Supabase across the application
      if (onSuccess) onSuccess();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('stocksense:inventory_updated'));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to confirm stock change');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (status !== 'PENDING' || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Clears the pending request without changing inventory
      await cancelStockChangeViaN8n(request.id, fallbackUser);
      setStatus('CANCELLED');
      if (onCancelled) onCancelled();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to cancel stock change');
    } finally {
      setIsLoading(false);
    }
  };

  const isPending = status === 'PENDING';
  const isPositive = request.movement_type === 'IN';
  const beforeQty = request.expected_quantity ?? 0;
  const changeQty = request.quantity;
  const afterQty = request.resulting_quantity ?? (isPositive ? beforeQty + changeQty : beforeQty - changeQty);

  return (
    <div className="mt-3 bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
      {/* Top Banner */}
      <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold tracking-wider uppercase">Stock Confirmation Required</span>
        </div>
        <span className="text-[11px] font-mono text-slate-300" title={`Request ID: ${request.id}`}>
          ID: {request.id.slice(0, 8)}...
        </span>
      </div>

      <div className="p-4 space-y-3.5">
        {/* Product Details */}
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Product</span>
          <div className="text-sm font-bold text-slate-900 mt-0.5">{request.product_name || 'Inventory Item'}</div>
        </div>

        {/* Quantities Calculation Flow: Current Stock → Change → Proposed Stock */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 grid grid-cols-3 gap-2 text-center items-center">
          <div className="p-1">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Current Stock</div>
            <div className="text-base font-extrabold text-slate-700 mt-0.5">{beforeQty}</div>
            <span className="text-[10px] text-slate-400 font-semibold">units</span>
          </div>

          <div className="p-1 flex flex-col items-center justify-center">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Change</div>
            <div className={`text-base font-extrabold mt-0.5 ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isPositive ? `+${changeQty}` : `-${changeQty}`}
            </div>
            <span className="text-[10px] font-semibold text-slate-400">
              {isPositive ? 'Inbound' : 'Outbound'}
            </span>
          </div>

          <div className="p-1">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Proposed Stock</div>
            <div className="text-base font-extrabold text-slate-900 mt-0.5">{afterQty}</div>
            <span className="text-[10px] text-slate-400 font-semibold">units</span>
          </div>
        </div>

        {/* Reason / Reference */}
        <div className="text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Reason:</span>{' '}
          <span>{request.reason || 'Inventory operation'}</span>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons: Confirm / Cancel */}
        {isPending ? (
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Confirm
            </button>
          </div>
        ) : (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-medium">
              {status === 'CONFIRMED' && (
                <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1 font-bold text-xs">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Stock Confirmed & Applied
                </span>
              )}
              {status === 'CANCELLED' && (
                <span className="text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 flex items-center gap-1 text-xs font-medium">
                  <X className="w-3.5 h-3.5 text-rose-500" /> Request Cancelled (No Change)
                </span>
              )}
              {status === 'EXPIRED' && (
                <span className="text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1 text-xs font-medium">
                  <Clock className="w-3.5 h-3.5" /> Request Expired
                </span>
              )}
            </div>
            <span className="text-[11px] font-mono text-slate-400">Locked</span>
          </div>
        )}
      </div>
    </div>
  );
};
