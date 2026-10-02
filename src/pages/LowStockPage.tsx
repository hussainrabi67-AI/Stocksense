import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Package,
  PlusCircle,
  RefreshCw,
  CheckCircle2,
  TrendingDown,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';
import { getLowStockProducts } from '../lib/api';
import { Product } from '../types/inventory';

interface LowStockPageProps {
  onNavigate: (path: string) => void;
  onSelectProductForStock?: (productId: string, action: 'IN') => void;
}

export const LowStockPage: React.FC<LowStockPageProps> = ({
  onNavigate,
  onSelectProductForStock
}) => {
  const { role } = useAuth();
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await getLowStockProducts(role);
      setLowStockProducts(data);
    } catch (e) {
      console.error('Failed to load low stock items:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [role]);

  const outOfStockCount = lowStockProducts.filter((p) => p.quantity_on_hand === 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Low Stock & Reorder Watchlist
            </h1>
            <span className="text-xs font-bold bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full">
              {lowStockProducts.length} Needs Attention
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Products that are currently at or below their designated reorder threshold in Nowshera Shopping Mall
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors self-start sm:self-auto"
          title="Refresh low stock query"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Critical Alert Bar if 0 units items exist */}
      {outOfStockCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-rose-950">
                Critical Alert: {outOfStockCount} Product{outOfStockCount > 1 ? 's are' : ' is'} Completely Out of Stock!
              </h3>
              <p className="text-[11px] sm:text-xs text-rose-800">
                Customers cannot purchase these products until an intake shipment is recorded.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Low Stock Items List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-700 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Product Name & SKU</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Reorder Level</th>
                <th className="py-3 px-4 text-right">Current On-Hand</th>
                <th className="py-3 px-4 text-right">Deficit</th>
                <th className="py-3 px-4 text-right">Immediate Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Querying low stock thresholds...
                  </td>
                </tr>
              ) : lowStockProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-800">All Stock Counts Are Healthy!</p>
                    <p className="text-xs text-slate-400 mt-1">No products are below their safety reorder thresholds.</p>
                  </td>
                </tr>
              ) : (
                lowStockProducts.map((p) => {
                  const deficit = Math.max(0, p.reorder_level - p.quantity_on_hand);
                  const isZero = p.quantity_on_hand === 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">{p.sku}</div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {p.category_name}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {p.supplier_name || 'Unassigned'}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <Badge status={isZero ? 'OUT_OF_STOCK' : 'LOW_STOCK'} size="sm" />
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                        {p.reorder_level} units
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className={`font-black text-sm ${isZero ? 'text-rose-600' : 'text-amber-600'}`}>
                          {p.quantity_on_hand}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">units</span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-rose-600 font-bold">
                        -{deficit} units
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            if (onSelectProductForStock) {
                              onSelectProductForStock(p.id, 'IN');
                            }
                            onNavigate('/stock-in');
                          }}
                          className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs inline-flex items-center gap-1.5 transition-colors"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Reorder Now</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
