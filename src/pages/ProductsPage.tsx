import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Edit3,
  CheckCircle,
  AlertCircle,
  Eye,
  DollarSign,
  ShieldAlert,
  X,
  Building2,
  FolderPlus,
  Truck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';
import { getProducts, getCategories, getSuppliers, createProduct, updateProductPrices, createCategory, createSupplier } from '../lib/api';
import { Product, Category, Supplier, StockStatus } from '../types/inventory';

export const ProductsPage: React.FC = () => {
  const { role } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStockStatus, setSelectedStockStatus] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'price'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createCategoryModalOpen, setCreateCategoryModalOpen] = useState(false);
  const [createSupplierModalOpen, setCreateSupplierModalOpen] = useState(false);
  const [editPriceModalProduct, setEditPriceModalProduct] = useState<Product | null>(null);
  const [viewProductDetails, setViewProductDetails] = useState<Product | null>(null);

  // Create Product Form State
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCatId, setNewCatId] = useState('');
  const [newSupId, setNewSupId] = useState('');
  const [newSellingPrice, setNewSellingPrice] = useState<number>(0);
  const [newCostPrice, setNewCostPrice] = useState<number>(0);
  const [newReorderLevel, setNewReorderLevel] = useState<number>(10);
  const [newInitialStock, setNewInitialStock] = useState<number>(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Category State
  const [catName, setCatName] = useState('');
  const [catCode, setCatCode] = useState('');
  const [catDesc, setCatDesc] = useState('');

  // New Supplier State
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');

  // Edit Prices Form State
  const [editSellingPrice, setEditSellingPrice] = useState<number>(0);
  const [editCostPrice, setEditCostPrice] = useState<number>(0);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prodList, catList, supList] = await Promise.all([
        getProducts(role),
        getCategories(),
        getSuppliers()
      ]);
      setProducts(prodList);
      setCategories(catList);
      setSuppliers(supList);
      if (catList.length > 0 && !newCatId) setNewCatId(catList[0].id);
      if (supList.length > 0 && !newSupId) setNewSupId(supList[0].id);
    } catch (e) {
      console.error('Failed to load products:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [role]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSku.trim() || !newName.trim()) {
      setFormError('SKU and Product Name are required.');
      return;
    }
    if (newSellingPrice < 0 || newCostPrice < 0) {
      setFormError('Prices cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await createProduct(
        {
          sku: newSku.trim(),
          name: newName.trim(),
          description: newDesc.trim(),
          categoryId: newCatId || (categories[0]?.id || ''),
          defaultSupplierId: newSupId || (suppliers[0]?.id || undefined),
          sellingPrice: Number(newSellingPrice),
          costPrice: Number(newCostPrice),
          reorderLevel: Number(newReorderLevel),
          initialStock: Number(newInitialStock)
        },
        role
      );

      setCreateModalOpen(false);
      setNewSku('');
      setNewName('');
      setNewDesc('');
      setNewSellingPrice(0);
      setNewCostPrice(0);
      setNewInitialStock(0);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim() || !catCode.trim()) return;
    setIsSubmitting(true);
    try {
      const created = await createCategory({
        name: catName.trim(),
        code: catCode.trim(),
        description: catDesc.trim()
      });
      setCategories((prev) => [...prev, created]);
      setNewCatId(created.id);
      setCreateCategoryModalOpen(false);
      setCatName('');
      setCatCode('');
      setCatDesc('');
    } catch (err: any) {
      alert(err.message || 'Failed to add category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;
    setIsSubmitting(true);
    try {
      const created = await createSupplier({
        name: supName.trim(),
        contact_person: supContact.trim(),
        email: supEmail.trim(),
        phone: supPhone.trim(),
        address: supAddress.trim()
      });
      setSuppliers((prev) => [...prev, created]);
      setNewSupId(created.id);
      setCreateSupplierModalOpen(false);
      setSupName('');
      setSupContact('');
      setSupEmail('');
      setSupPhone('');
      setSupAddress('');
    } catch (err: any) {
      alert(err.message || 'Failed to add supplier');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPriceModalProduct) return;

    setIsSubmitting(true);
    try {
      await updateProductPrices(
        editPriceModalProduct.id,
        Number(editSellingPrice),
        Number(editCostPrice),
        role
      );
      setEditPriceModalProduct(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Price update failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter & Sort Logic
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'ALL' || p.category_id === selectedCategory;

    let matchesStock = true;
    if (selectedStockStatus === 'OUT') matchesStock = p.quantity_on_hand === 0;
    else if (selectedStockStatus === 'LOW') matchesStock = p.quantity_on_hand > 0 && p.quantity_on_hand <= p.reorder_level;
    else if (selectedStockStatus === 'IN') matchesStock = p.quantity_on_hand > p.reorder_level;

    return matchesSearch && matchesCategory && matchesStock;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'name') {
      return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    }
    if (sortBy === 'stock') {
      return sortOrder === 'asc' ? a.quantity_on_hand - b.quantity_on_hand : b.quantity_on_hand - a.quantity_on_hand;
    }
    if (sortBy === 'price') {
      return sortOrder === 'asc' ? a.selling_price - b.selling_price : b.selling_price - a.selling_price;
    }
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Product Catalog</h1>
            <Badge role={role} size="md" />
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            {role === 'STAFF'
              ? 'Authorized staff view (Restricted from cost & margin data)'
              : 'Managerial & Administrative catalog, pricing, and supplier management'}
          </p>
        </div>

        {/* Manager/Admin can register new products, categories, suppliers */}
        {(role === 'MANAGER' || role === 'ADMIN') ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCreateCategoryModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5 text-slate-500" />
              <span>+ Category</span>
            </button>

            <button
              onClick={() => setCreateSupplierModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              <Truck className="w-3.5 h-3.5 text-slate-500" />
              <span>+ Supplier</span>
            </button>

            <button
              onClick={() => {
                setFormError(null);
                setCreateModalOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          </div>
        ) : (
          <div className="text-[11px] text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-slate-700" />
            Product creation restricted to Managers & Admins
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by SKU, product name, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <select
          value={selectedStockStatus}
          onChange={(e) => setSelectedStockStatus(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:ring-2 focus:ring-emerald-500"
        >
          <option value="ALL">All Stock Levels</option>
          <option value="IN">In Stock</option>
          <option value="LOW">Low Stock</option>
          <option value="OUT">Out of Stock</option>
        </select>

        <div className="flex items-center gap-1 border-l border-slate-100 pl-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-2 bg-white text-slate-700"
          >
            <option value="name">Sort: Name</option>
            <option value="stock">Sort: Stock</option>
            <option value="price">Sort: Price</option>
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

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-700 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Product / SKU</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Selling Price</th>
                {role !== 'STAFF' && (
                  <>
                    <th className="py-3 px-4 text-right text-purple-700">Cost Price</th>
                    <th className="py-3 px-4 text-right text-purple-700">Margin</th>
                  </>
                )}
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Stock</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={role !== 'STAFF' ? 8 : 6} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Querying database...
                  </td>
                </tr>
              ) : sortedProducts.length === 0 ? (
                <tr>
                  <td colSpan={role !== 'STAFF' ? 8 : 6} className="py-12 text-center">
                    <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-base font-bold text-slate-800">No products found in the catalog</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Your database is ready. Register your first genuine mall product by clicking the button below.
                    </p>
                    {(role === 'MANAGER' || role === 'ADMIN') && (
                      <button
                        onClick={() => {
                          setFormError(null);
                          setCreateModalOpen(true);
                        }}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add First Product</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                sortedProducts.map((p) => {
                  const stockStatus: StockStatus =
                    p.quantity_on_hand === 0
                      ? 'OUT_OF_STOCK'
                      : p.quantity_on_hand <= p.reorder_level
                      ? 'LOW_STOCK'
                      : 'IN_STOCK';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{p.sku}</span>
                          {p.supplier_name && (
                            <span className="text-slate-400">• {p.supplier_name}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {p.category_name}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                        PKR {p.selling_price.toLocaleString()}
                      </td>

                      {role !== 'STAFF' && (
                        <>
                          <td className="py-3 px-4 text-right font-mono text-purple-900 bg-purple-50/30">
                            PKR {(p.cost_price || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">
                            {p.profit_margin_percent}%
                          </td>
                        </>
                      )}

                      <td className="py-3 px-4 text-center">
                        <Badge status={stockStatus} size="sm" />
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span className={`font-extrabold text-sm ${
                          p.quantity_on_hand === 0 ? 'text-rose-600' : p.quantity_on_hand <= p.reorder_level ? 'text-amber-600' : 'text-slate-900'
                        }`}>
                          {p.quantity_on_hand}
                        </span>
                        <div className="text-[10px] text-slate-400">Min: {p.reorder_level}</div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewProductDetails(p)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {(role === 'MANAGER' || role === 'ADMIN') && (
                            <button
                              onClick={() => {
                                setEditPriceModalProduct(p);
                                setEditSellingPrice(p.selling_price);
                                setEditCostPrice(p.cost_price || 0);
                              }}
                              className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Update prices"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
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

      {/* CREATE PRODUCT MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <Package className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">Register Product</h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-6 overflow-y-auto space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ELEC-001"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Category *
                    </label>
                    <button
                      type="button"
                      onClick={() => setCreateCategoryModalOpen(true)}
                      className="text-[10px] text-emerald-600 font-bold hover:underline"
                    >
                      + New
                    </button>
                  </div>
                  <select
                    value={newCatId}
                    onChange={(e) => setNewCatId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    {categories.length === 0 ? (
                      <option value="">No categories yet (Click + New)</option>
                    ) : (
                      categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wireless Headset"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Product specs, notes, warranty..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Default Supplier
                  </label>
                  <button
                    type="button"
                    onClick={() => setCreateSupplierModalOpen(true)}
                    className="text-[10px] text-emerald-600 font-bold hover:underline"
                  >
                    + New
                  </button>
                </div>
                <select
                  value={newSupId}
                  onChange={(e) => setNewSupId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="">Unassigned</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Selling Price (PKR) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={newSellingPrice}
                    onChange={(e) => setNewSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-900 uppercase mb-1">
                    Cost Price (PKR) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={newCostPrice}
                    onChange={(e) => setNewCostPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-mono bg-purple-50/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Reorder Threshold *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newReorderLevel}
                    onChange={(e) => setNewReorderLevel(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Initial Stock Count
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newInitialStock}
                    onChange={(e) => setNewInitialStock(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center gap-1.5"
                >
                  {isSubmitting ? 'Registering...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CATEGORY MODAL */}
      {createCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Add Mall Category</h3>
              <button
                onClick={() => setCreateCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCategory} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Footwear & Shoes"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Category Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FOOT"
                  value={catCode}
                  onChange={(e) => setCatCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Brief category description..."
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateCategoryModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                >
                  {isSubmitting ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE SUPPLIER MODAL */}
      {createSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Add Mall Supplier</h3>
              <button
                onClick={() => setCreateSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSupplier} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Supplier Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Al-Rehman Traders"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Muhammad Bilal"
                  value={supContact}
                  onChange={(e) => setSupContact(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+92 300 0000000"
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="contact@supplier.com"
                    value={supEmail}
                    onChange={(e) => setSupEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Address</label>
                <input
                  type="text"
                  placeholder="e.g. Saddar, Peshawar / GT Road"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateSupplierModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                >
                  {isSubmitting ? 'Saving...' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PRICE MODAL */}
      {editPriceModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Update Product Pricing</h3>
              <button
                onClick={() => setEditPriceModalProduct(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-3">
              <div className="text-xs font-bold text-slate-800">{editPriceModalProduct.name}</div>
              <div className="text-[11px] text-slate-400 font-mono">{editPriceModalProduct.sku}</div>
            </div>

            <form onSubmit={handleUpdatePrice} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Retail Selling Price (PKR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={editSellingPrice}
                  onChange={(e) => setEditSellingPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-900 uppercase mb-1">
                  Supplier Cost Price (PKR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={editCostPrice}
                  onChange={(e) => setEditCostPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs border border-purple-300 rounded-lg font-mono focus:ring-2 focus:ring-purple-500 bg-purple-50/40"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-xs flex justify-between font-mono">
                <span className="text-slate-600 font-sans">Projected Margin:</span>
                <span className="font-bold text-emerald-700">
                  {editSellingPrice > 0
                    ? (((editSellingPrice - editCostPrice) / editSellingPrice) * 100).toFixed(2)
                    : 0}
                  %
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditPriceModalProduct(null)}
                  className="px-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm"
                >
                  {isSubmitting ? 'Updating...' : 'Save Prices'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW PRODUCT DETAILS MODAL */}
      {viewProductDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Product Specifications</h3>
              </div>
              <button
                onClick={() => setViewProductDetails(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-sm font-extrabold text-slate-900">{viewProductDetails.name}</div>
                <div className="text-xs font-mono text-emerald-600 mt-0.5">SKU: {viewProductDetails.sku}</div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                {viewProductDetails.description || 'No description entered.'}
              </p>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-600 font-semibold block text-[10px] uppercase">Category</span>
                  <span className="font-bold text-slate-800">{viewProductDetails.category_name}</span>
                </div>
                <div>
                  <span className="text-slate-600 font-semibold block text-[10px] uppercase">Default Supplier</span>
                  <span className="font-bold text-slate-800">{viewProductDetails.supplier_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-600 font-semibold block text-[10px] uppercase">Retail Price</span>
                  <span className="font-bold text-slate-900 font-mono">
                    PKR {viewProductDetails.selling_price.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 font-semibold block text-[10px] uppercase">Quantity on Hand</span>
                  <span className="font-extrabold text-slate-900">{viewProductDetails.quantity_on_hand} units</span>
                </div>
              </div>

              {role !== 'STAFF' && viewProductDetails.cost_price !== undefined && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-purple-950 uppercase text-[10px]">Confidential Manager Info</div>
                  <div className="flex justify-between">
                    <span className="text-purple-700">Cost Price:</span>
                    <span className="font-mono font-bold text-purple-900">
                      PKR {viewProductDetails.cost_price.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-700">Gross Margin:</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {viewProductDetails.profit_margin_percent}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewProductDetails(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
