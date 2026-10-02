import React, { useState, useEffect } from 'react';
import {
  Layers,
  Search,
  Filter,
  ArrowUpDown,
  PlusCircle,
  MinusCircle,
  AlertTriangle,
  Package,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';
import { getProducts, getCategories } from '../lib/api';
import { Product, Category, StockStatus } from '../types/inventory';

interface InventoryPageProps {
  onNavigate: (path: string) => void;
  onSelectProductForStock?: (productId: string, action: 'IN' | 'OUT') => void;
}

export const InventoryPage: React.FC<InventoryPageProps> = ({
  onNavigate,
  onSelectProductForStock
}) => {
  const { role } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'qty' | 'name' | 'reorder'>('qty');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prods, cats] = await Promise.all([getProducts(role), getCategories()]);
      setProducts(prods);
      setCategories(cats);
    } catch (e) {
      console.error('Error loading inventory:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [role]);

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());

    const matchesCat = categoryFilter === 'ALL' || p.category_id === categoryFilter;

    let matchesStatus = true;
    if (statusFilter === 'OUT') matchesStatus = p.quantity_on_hand === 0;
    else if (statusFilter === 'LOW') matchesStatus = p.quantity_on_hand > 0 && p.quantity_on_hand <= p.reorder_level;
    else if (statusFilter === 'IN') matchesStatus = p.quantity_on_hand > p.reorder_level;

    return matchesSearch && matchesCat && matchesStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'qty') {
      return sortOrder === 'asc' ? a.quantity_on_hand - b.quantity_on_hand : b.quantity_on_hand - a.quantity_on_hand;
    }
    if (sortBy === 'name') {
      return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    }
    if (sortBy === 'reorder') {
      return sortOrder === 'asc' ? a.reorder_level - b.reorder_level : b.reorder_level - a.reorder_level;
    }
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Live Stock Levels
            </h1>
            <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-full">
              {products.length} Registered Items
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Real-time physical stock counts across Nowshera Shopping Mall storage depot and counters
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
            title="Refresh on-hand counts"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => onNavigate('/stock-in')}
            className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Receive (Stock IN)</span>
          </button>

          <button
            onClick={() => onNavigate('/stock-out')}
            className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
          >
            <MinusCircle className="w-4 h-4" />
            <span>Dispatch (Stock OUT)</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search stock by SKU, product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700"
        >
          <option value="ALL">All Levels</option>
          <option value="OUT">Out of Stock (0 units)</option>
          <option value="LOW">Low Stock (≤ Reorder)</option>
          <option value="IN">Sufficient Stock</option>
        </select>

        <div className="flex items-center gap-1 border-l border-slate-100 pl-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-2 bg-white text-slate-700"
          >
            <option value="qty">Sort: On-Hand Qty</option>
            <option value="name">Sort: Product Name</option>
            <option value="reorder">Sort: Reorder Level</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
            title="Toggle sort direction"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-700 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Item & SKU</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Reorder Threshold</th>
                <th className="py-3.5 px-4 text-right">Current Stock</th>
                <th className="py-3.5 px-4 text-right">Quick Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Fetching latest inventory state...
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">No inventory records found</p>
                    <p className="text-xs text-slate-400 mt-1">Try resetting search filters</p>
                  </td>
                </tr>
              ) : (
                sorted.map((prod) => {
                  const status: StockStatus =
                    prod.quantity_on_hand === 0
                      ? 'OUT_OF_STOCK'
                      : prod.quantity_on_hand <= prod.reorder_level
                      ? 'LOW_STOCK'
                      : 'IN_STOCK';

                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{prod.name}</div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          SKU: {prod.sku}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {prod.category_name}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <Badge status={status} size="sm" />
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {prod.reorder_level} units
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-black text-base ${
                            prod.quantity_on_hand === 0
                              ? 'text-rose-600'
                              : prod.quantity_on_hand <= prod.reorder_level
                              ? 'text-amber-600'
                              : 'text-emerald-700'
                          }`}
                        >
                          {prod.quantity_on_hand}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">units</span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              if (onSelectProductForStock) {
                                onSelectProductForStock(prod.id, 'IN');
                              }
                              onNavigate('/stock-in');
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg flex items-center gap-1 transition-colors"
                            title="Receive more units into stock"
                          >
                            <PlusCircle className="w-3 h-3" />
                            <span>In</span>
                          </button>

                          <button
                            onClick={() => {
                              if (onSelectProductForStock) {
                                onSelectProductForStock(prod.id, 'OUT');
                              }
                              onNavigate('/stock-out');
                            }}
                            disabled={prod.quantity_on_hand === 0}
                            className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Dispatch units from inventory"
                          >
                            <MinusCircle className="w-3 h-3" />
                            <span>Out</span>
                          </button>
                        </div>
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
