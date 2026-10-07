import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Layers,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  DollarSign,
  Bot,
  RefreshCw,
  PlusCircle,
  MinusCircle,
  Eye,
  CheckCircle2,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  ArrowRight,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import {
  getDashboardMetrics,
  getLowStockProducts,
  getMovementHistory,
  getProducts,
  getCategories
} from '../lib/api';
import { DashboardMetrics, Product, InventoryMovement, Category } from '../types/inventory';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { role, user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [lowStockItems, setLowStockItems] = useState<Product[]>([]);
  const [recentMovements, setRecentMovements] = useState<InventoryMovement[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allMovements, setAllMovements] = useState<InventoryMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Interactive Graph Controls
  const [chartFilter, setChartFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
       const [m, low, movs, prods, cats] = await Promise.all([
       getDashboardMetrics(role),
       getLowStockProducts(role),
       getMovementHistory(),
       getProducts(role),
       getCategories().catch(err => {
    console.error('Categories failed:', err);
    return [];
  })
    ]);
      setMetrics(m);
      setLowStockItems(low.slice(0, 5));
      setRecentMovements(movs.slice(0, 6));
      setAllMovements(movs);
      setAllProducts(prods);
      setCategories(cats);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => {
      loadData();
    };
    window.addEventListener('stocksense:inventory_updated', handleRefresh);
    return () => {
      window.removeEventListener('stocksense:inventory_updated', handleRefresh);
    };
  }, [role]);

  // Compute 7-day flow trend for the bar chart
  const weeklyTrendData = useMemo(() => {
    const days: {
      dateStr: string;
      label: string;
      inbound: number;
      outbound: number;
      net: number;
    }[] = [];

    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateIso = d.toISOString().split('T')[0];
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayLabel = i === 0 ? 'Today' : `${weekday} ${d.getDate()}`;

      // Sum matching movements
      const dayMovs = allMovements.filter((m) => m.created_at.startsWith(dateIso));
      let inQty = dayMovs
        .filter((m) => m.movement_type === 'IN')
        .reduce((sum, m) => sum + m.quantity, 0);
      let outQty = dayMovs
        .filter((m) => m.movement_type === 'OUT' || m.movement_type === 'DAMAGE')
        .reduce((sum, m) => sum + m.quantity, 0);

      // If today and metrics exist, incorporate today's totals
      if (i === 0 && metrics) {
        if (inQty === 0 && metrics.stockInToday) inQty = metrics.stockInToday;
        if (outQty === 0 && metrics.stockOutToday) outQty = metrics.stockOutToday;
      }

      days.push({
        dateStr: dateIso,
        label: dayLabel,
        inbound: inQty,
        outbound: outQty,
        net: inQty - outQty
      });
    }

    // Determine max value for SVG scale
    const maxVal = Math.max(
      ...days.map((d) => Math.max(d.inbound, d.outbound)),
      20
    );

    return { days, maxVal };
  }, [allMovements, metrics]);

  // Compute Category Allocation Breakdown
  const categoryBreakdown = useMemo(() => {
    const catMap = new Map<string, { name: string; units: number; skuCount: number }>();

    // Initialize with existing categories
    categories.forEach((cat) => {
      catMap.set(cat.id, { name: cat.name, units: 0, skuCount: 0 });
    });

    // Sum inventory per category
    allProducts.forEach((p) => {
      const existing = catMap.get(p.category_id) || {
        name: p.category_name || 'General',
        units: 0,
        skuCount: 0
      };
      existing.units += p.quantity_on_hand;
      existing.skuCount += 1;
      catMap.set(p.category_id, existing);
    });

    const totalUnits = allProducts.reduce((sum, p) => sum + p.quantity_on_hand, 0) || 1;

    const list = Array.from(catMap.values())
      .filter((c) => c.skuCount > 0 || c.units > 0)
      .map((c, index) => {
        const percent = Math.round((c.units / totalUnits) * 100);
        // Palette cycle
        const colorPalette = [
          'bg-emerald-500 text-emerald-500 border-emerald-500',
          'bg-teal-500 text-teal-500 border-teal-500',
          'bg-blue-500 text-blue-500 border-blue-500',
          'bg-indigo-500 text-indigo-500 border-indigo-500',
          'bg-amber-500 text-amber-500 border-amber-500',
          'bg-rose-500 text-rose-500 border-rose-500'
        ];
        return {
          ...c,
          percent,
          colorClass: colorPalette[index % colorPalette.length]
        };
      })
      .sort((a, b) => b.units - a.units);

    return { list, totalUnits };
  }, [allProducts, categories]);

  // Inventory Health Ratios
  const healthRatios = useMemo(() => {
    const total = allProducts.length || 1;
    const outOfStock = allProducts.filter((p) => p.quantity_on_hand === 0).length;
    const lowStock = allProducts.filter(
      (p) => p.quantity_on_hand > 0 && p.quantity_on_hand <= p.reorder_level
    ).length;
    const optimal = allProducts.filter((p) => p.quantity_on_hand > p.reorder_level).length;

    return {
      optimalPercent: Math.round((optimal / total) * 100),
      lowStockPercent: Math.round((lowStock / total) * 100),
      outOfStockPercent: Math.round((outOfStock / total) * 100),
      optimalCount: optimal,
      lowStockCount: lowStock,
      outOfStockCount: outOfStock,
      totalCount: allProducts.length
    };
  }, [allProducts]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Mall Inventory Overview
            </h1>
            <Badge role={role} size="md" />
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Sync
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Real-time telemetry for Nowshera Shopping Mall branches & central warehouse
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
            title="Refresh inventory metrics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => onNavigate('/stock-in')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-500/20 rounded-xl shadow-xs transition-all hover:scale-102 active:scale-98 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Stock IN</span>
          </button>

          <button
            onClick={() => onNavigate('/stock-out')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/20 rounded-xl shadow-xs transition-all hover:scale-102 active:scale-98 cursor-pointer"
          >
            <MinusCircle className="w-4 h-4" />
            <span>Stock OUT</span>
          </button>

          <button
            onClick={() => onNavigate('/assistant')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-teal-800 bg-teal-100 hover:bg-teal-200 rounded-xl transition-all hover:scale-102 active:scale-98 cursor-pointer"
          >
            <Bot className="w-4 h-4 text-teal-600" />
            <span>Ask Copilot</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Active SKUs"
          value={metrics?.totalProducts ?? 0}
          subtitle="Registered catalog items"
          icon={Package}
          color="slate"
        />

        <StatCard
          title="Total Stock Units"
          value={metrics?.totalInventoryUnits.toLocaleString() ?? 0}
          subtitle="Physical units on hand"
          icon={Layers}
          color="blue"
        />

        <StatCard
          title="Low Stock Warning"
          value={metrics?.lowStockCount ?? 0}
          subtitle="At or below reorder threshold"
          icon={AlertTriangle}
          color="amber"
          badgeText={metrics?.lowStockCount ? 'Needs Reorder' : 'Healthy'}
          badgeType={metrics?.lowStockCount ? 'warning' : 'success'}
        />

        <StatCard
          title="Stock In Today"
          value={`+${metrics?.stockInToday ?? 0}`}
          subtitle="Received shipments today"
          icon={ArrowDownToLine}
          color="emerald"
        />
      </div>

      {/* Financial Metrics (Only authorized for Manager and Admin; Staff CANNOT view cost/profit) */}
      {(role === 'MANAGER' || role === 'ADMIN') && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white border border-slate-700/60 shadow-xs hover:border-slate-600 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Retail Inventory Value</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-white">
              PKR {(metrics?.totalRetailValue || 0).toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Total selling price value of on-hand inventory</div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white border border-slate-700/60 shadow-xs hover:border-slate-600 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Total Cost Investment</span>
              <DollarSign className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-white">
              PKR {(metrics?.totalCostValue || 0).toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Supplier acquisition cost (Confidential to Managers/Admins)</div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white border border-slate-700/60 shadow-xs hover:border-slate-600 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Estimated Gross Profit</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-emerald-400">
              PKR {(metrics?.estimatedGrossProfit || 0).toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Projected inventory profit spread</div>
          </div>
        </div>
      )}

      {/* INTERACTIVE GRAPHS & VISUALIZATIONS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph 1: 7-Day Stock Flow Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Weekly Inventory Flow Trends</h2>
                <p className="text-[11px] text-slate-400">Inbound receipts vs outbound dispatches (7 days)</p>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
              <button
                onClick={() => setChartFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  chartFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setChartFilter('IN')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  chartFilter === 'IN'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-emerald-700'
                }`}
              >
                Inbound
              </button>
              <button
                onClick={() => setChartFilter('OUT')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  chartFilter === 'OUT'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-blue-700'
                }`}
              >
                Outbound
              </button>
            </div>
          </div>

          {/* SVG Bar Chart */}
          <div className="relative pt-2 pb-4">
            <div className="h-52 flex items-end justify-between gap-2 sm:gap-4 px-2">
              {weeklyTrendData.days.map((item, idx) => {
                const inPercent = Math.min(100, Math.round((item.inbound / weeklyTrendData.maxVal) * 100));
                const outPercent = Math.min(100, Math.round((item.outbound / weeklyTrendData.maxVal) * 100));
                const isHovered = hoveredBarIndex === idx;

                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredBarIndex(idx)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                  >
                    {/* Tooltip on hover */}
                    {isHovered && (
                      <div className="absolute -top-16 z-20 bg-slate-900 text-white rounded-xl py-1.5 px-3 shadow-xl border border-slate-700 text-[11px] whitespace-nowrap pointer-events-none transform -translate-x-1/2 left-1/2 animate-in fade-in zoom-in-95 duration-150">
                        <div className="font-bold text-slate-200">{item.label}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-emerald-400 font-bold">+{item.inbound} IN</span>
                          <span className="text-blue-400 font-bold">-{item.outbound} OUT</span>
                        </div>
                      </div>
                    )}

                    {/* Bars Container */}
                    <div className="w-full flex items-end justify-center gap-1 h-44 pb-1">
                      {/* Inbound Bar */}
                      {(chartFilter === 'ALL' || chartFilter === 'IN') && (
                        <div
                          style={{ height: `${Math.max(inPercent, 4)}%` }}
                          className={`w-full max-w-[18px] bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t-md transition-all duration-500 ${
                            isHovered ? 'brightness-110 shadow-md shadow-emerald-500/30' : 'opacity-90'
                          }`}
                        />
                      )}

                      {/* Outbound Bar */}
                      {(chartFilter === 'ALL' || chartFilter === 'OUT') && (
                        <div
                          style={{ height: `${Math.max(outPercent, 4)}%` }}
                          className={`w-full max-w-[18px] bg-gradient-to-t from-blue-600 to-sky-400 rounded-t-md transition-all duration-500 ${
                            isHovered ? 'brightness-110 shadow-md shadow-blue-500/30' : 'opacity-90'
                          }`}
                        />
                      )}
                    </div>

                    {/* Date label */}
                    <span className="text-[10px] font-semibold text-slate-500 mt-2 truncate max-w-full">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Bottom Legend */}
            <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-500 shadow-xs" />
                <span className="text-slate-600 font-medium">Stock IN (Shipments)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-blue-500 shadow-xs" />
                <span className="text-slate-600 font-medium">Stock OUT (Dispatches)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Graph 2: Stock Health Distribution & Gauge */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-50 text-teal-600 border border-teal-100">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Inventory Health Ratio</h2>
                  <p className="text-[11px] text-slate-400">Catalog state & stock security</p>
                </div>
              </div>
              <span className="text-xs font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">
                {healthRatios.totalCount} SKUs
              </span>
            </div>

            {/* Segmented Multi-Bar Meter */}
            <div className="my-5">
              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                <div
                  style={{ width: `${healthRatios.optimalPercent}%` }}
                  className="bg-emerald-500 hover:opacity-90 transition-all duration-700 relative group cursor-pointer"
                  title={`Optimal: ${healthRatios.optimalCount} items (${healthRatios.optimalPercent}%)`}
                />
                <div
                  style={{ width: `${healthRatios.lowStockPercent}%` }}
                  className="bg-amber-400 hover:opacity-90 transition-all duration-700 relative group cursor-pointer"
                  title={`Low Stock: ${healthRatios.lowStockCount} items (${healthRatios.lowStockPercent}%)`}
                />
                <div
                  style={{ width: `${healthRatios.outOfStockPercent}%` }}
                  className="bg-rose-500 hover:opacity-90 transition-all duration-700 relative group cursor-pointer"
                  title={`Out of Stock: ${healthRatios.outOfStockCount} items (${healthRatios.outOfStockPercent}%)`}
                />
              </div>

              {/* Status Percent Cards */}
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="text-base font-extrabold text-emerald-700">
                    {healthRatios.optimalPercent}%
                  </div>
                  <div className="text-[10px] font-bold text-emerald-800 uppercase mt-0.5">Optimal</div>
                  <div className="text-[10px] text-emerald-600 font-semibold">{healthRatios.optimalCount} SKUs</div>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                  <div className="text-base font-extrabold text-amber-700">
                    {healthRatios.lowStockPercent}%
                  </div>
                  <div className="text-[10px] font-bold text-amber-800 uppercase mt-0.5">Reorder</div>
                  <div className="text-[10px] text-amber-600 font-semibold">{healthRatios.lowStockCount} SKUs</div>
                </div>

                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                  <div className="text-base font-extrabold text-rose-700">
                    {healthRatios.outOfStockPercent}%
                  </div>
                  <div className="text-[10px] font-bold text-rose-800 uppercase mt-0.5">Depleted</div>
                  <div className="text-[10px] text-rose-600 font-semibold">{healthRatios.outOfStockCount} SKUs</div>
                </div>
              </div>
            </div>

            {/* Quick Summary Note */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>AI Recommendation</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {healthRatios.lowStockCount > 0
                  ? `${healthRatios.lowStockCount} item(s) are below safety threshold. Run Inbound intake to prevent stockouts.`
                  : 'All monitored catalog items maintain healthy buffer quantities.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('/low-stock')}
            className="mt-4 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Inspect Health Warnings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Graph 3 & Breakdown: Category Stock Allocation */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Inventory Distribution by Category</h2>
              <p className="text-[11px] text-slate-400">Share of physical inventory units stored across mall departments</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('/inventory')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <span>Explore All</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Categories Bar Representation */}
        {categoryBreakdown.list.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No category distribution available yet.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Multi-segmented full width progress bar */}
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-xs">
              {categoryBreakdown.list.map((cat, idx) => (
                <div
                  key={idx}
                  style={{ width: `${Math.max(cat.percent, 3)}%` }}
                  className={`${cat.colorClass.split(' ')[0]} transition-all duration-700 hover:opacity-80`}
                  title={`${cat.name}: ${cat.units} units (${cat.percent}%)`}
                />
              ))}
            </div>

            {/* Category Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {categoryBreakdown.list.map((cat, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className={`w-2.5 h-2.5 rounded-full ${cat.colorClass.split(' ')[0]}`} />
                    <span className="text-[11px] font-black text-slate-800">{cat.percent}%</span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 mt-2 truncate" title={cat.name}>
                    {cat.name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    {cat.units.toLocaleString()} units • {cat.skuCount} SKUs
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Low Stock Alert & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low Stock Watchlist */}
        <div className="lg:col-span-1 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Low Stock Watchlist</h2>
            </div>
            <button
              onClick={() => onNavigate('/low-stock')}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
            >
              View All
            </button>
          </div>

          <div className="space-y-3 flex-1">
            {lowStockItems.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-center p-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                <p className="text-xs font-semibold text-slate-700">All Stock Healthy</p>
                <p className="text-[11px] text-slate-400">No items are below reorder levels</p>
              </div>
            ) : (
              lowStockItems.map((prod) => (
                <div
                  key={prod.id}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-slate-900 truncate">{prod.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{prod.sku}</div>
                    <div className="text-[11px] text-amber-700 font-medium mt-0.5">
                      Reorder at: {prod.reorder_level} units
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-base font-extrabold ${
                        prod.quantity_on_hand === 0 ? 'text-rose-600' : 'text-amber-600'
                      }`}
                    >
                      {prod.quantity_on_hand}
                    </div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">on hand</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => onNavigate('/stock-in')}
            className="mt-4 w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-colors text-center"
          >
            Create Inbound Reorder
          </button>
        </div>

        {/* Recent Inventory Movements */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                <Layers className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Recent Movements & Audit Trail</h2>
            </div>
            <button
              onClick={() => onNavigate('/history')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              Full Log
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="pb-2.5">Time</th>
                  <th className="pb-2.5">Type</th>
                  <th className="pb-2.5">Product</th>
                  <th className="pb-2.5 text-right">Qty</th>
                  <th className="pb-2.5 text-right">Balance</th>
                  <th className="pb-2.5 pl-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentMovements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No stock movements recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentMovements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 text-slate-500 font-mono text-[11px]">
                        {new Date(mov.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-2.5">
                        <Badge movement={mov.movement_type} size="sm" />
                      </td>
                      <td className="py-2.5">
                        <div className="font-semibold text-slate-900 truncate max-w-[180px]">
                          {mov.product_name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{mov.product_sku}</div>
                      </td>
                      <td
                        className={`py-2.5 text-right font-bold ${
                          mov.movement_type === 'IN' ? 'text-emerald-600' : 'text-slate-800'
                        }`}
                      >
                        {mov.movement_type === 'IN' ? `+${mov.quantity}` : `-${mov.quantity}`}
                      </td>
                      <td className="py-2.5 text-right font-mono text-slate-600">
                        {mov.quantity_after}
                      </td>
                      <td className="py-2.5 pl-3 text-slate-500 truncate max-w-[140px]">
                        {mov.reason}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
