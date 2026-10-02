import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  Download,
  RefreshCw,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  Calendar,
  User,
  Package
} from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { getMovementHistory } from '../lib/api';
import { InventoryMovement, MovementType } from '../types/inventory';

export const HistoryPage: React.FC = () => {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await getMovementHistory();
      setMovements(data);
    } catch (e) {
      console.error('Failed to load history:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = movements.filter((m) => {
    const matchesSearch =
      m.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.product_sku?.toLowerCase().includes(search.toLowerCase()) ||
      m.reason?.toLowerCase().includes(search.toLowerCase()) ||
      m.performer_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.supplier_name?.toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === 'ALL' || m.movement_type === typeFilter;

    return matchesSearch && matchesType;
  });

  const exportCSV = () => {
    const headers = ['Timestamp', 'Type', 'SKU', 'Product', 'Quantity', 'Before', 'After', 'Reason', 'Supplier', 'Performed By', 'Source'];
    const rows = filtered.map((m) => [
      m.created_at,
      m.movement_type,
      `"${m.product_sku || ''}"`,
      `"${m.product_name || ''}"`,
      m.quantity,
      m.quantity_before,
      m.quantity_after,
      `"${m.reason.replace(/"/g, '""')}"`,
      `"${m.supplier_name || ''}"`,
      `"${m.performer_name || ''}"`,
      m.source
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `stocksense_movements_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Inventory Movement Audit Log
            </h1>
            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
              {filtered.length} Entries
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Immutable transactional history and ledger for Nowshera Shopping Mall
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
            title="Refresh history"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by SKU, product name, reason, or staff member..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700"
          >
            <option value="ALL">All Movement Types</option>
            <option value="IN">Stock IN (Receive)</option>
            <option value="OUT">Stock OUT (Customer Sale)</option>
            <option value="DAMAGE">Damaged Goods</option>
            <option value="ADJUSTMENT">Audit Adjustments</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-700 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Date / Time</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Item & SKU</th>
                <th className="py-3 px-4 text-right">Delta</th>
                <th className="py-3 px-4 text-right">Before</th>
                <th className="py-3 px-4 text-right">After</th>
                <th className="py-3 px-4">Reason & Supplier</th>
                <th className="py-3 px-4">Operator / Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading audit trail...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">No movement records match</p>
                    <p className="text-xs text-slate-400 mt-1">Try resetting search filters</p>
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                      <div>{new Date(m.created_at).toLocaleDateString()}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge movement={m.movement_type} size="sm" />
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{m.product_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{m.product_sku}</div>
                    </td>

                    <td className="py-3 px-4 text-right font-black font-mono">
                      <span className={m.movement_type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}>
                        {m.movement_type === 'IN' ? `+${m.quantity}` : `-${m.quantity}`}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-slate-500">
                      {m.quantity_before}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {m.quantity_after}
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-slate-800 leading-snug">{m.reason}</div>
                      {m.supplier_name && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Supplier: {m.supplier_name}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-700 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{m.performer_name || 'System'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Src: {m.source}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
