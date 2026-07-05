import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FaSearch, FaArrowLeft, FaBox, FaPills, FaStethoscope,
  FaWarehouse, FaBolt, FaTimes
} from 'react-icons/fa';
import { pharmacyAPI } from '../services/api';
import './PharmacistHomepage.css';

const MEDIA_BASE_URL = process.env.REACT_APP_MEDIA_URL || 'http://localhost:8000';
const resolveImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${MEDIA_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const getMedicineImage = (product) => {
  if (!product) return null;
  if (product.primary_image) return resolveImageUrl(product.primary_image);
  if (product.images && product.images.length > 0) {
    const img = product.images.find(i => i.is_primary) || product.images[0];
    return resolveImageUrl(img.image_url || img.image);
  }
  if (product.image) return resolveImageUrl(product.image);
  return null;
};

const PharmacySearch = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialTab = searchParams.get('tab') || 'medicines';
  
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [allProducts, setAllProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load all products
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        const products = await pharmacyAPI.getAllMedicines();
        setAllProducts(products);
      } catch (error) {
        console.error('[PharmacySearch] Error loading products:', error);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []);

  // Filter products based on search and tab
  useEffect(() => {
    const query = searchQuery.toLowerCase().trim();
    
    // Define medicine categories
    const medicineCategories = [
      'medicines', 'prescription_drugs', 'otc_medicines',
      'antibiotics', 'painkillers', 'vitamins', 'ayurvedic', 'homeopathy'
    ];
    
    const filtered = allProducts.filter(product => {
      // Search filter
      const matchesQuery = !query || 
        product.name?.toLowerCase().includes(query) ||
        product.generic_name?.toLowerCase().includes(query) ||
        product.manufacturer?.toLowerCase().includes(query) ||
        product.brand?.toLowerCase().includes(query) ||
        product.category?.toLowerCase().includes(query);
      
      // Tab filter
      const isMedicine = medicineCategories.includes(product.category?.toLowerCase());
      const matchesTab = activeTab === 'medicines' ? isMedicine : !isMedicine;
      
      return matchesQuery && matchesTab;
    });
    
    setFilteredProducts(filtered);
  }, [searchQuery, activeTab, allProducts]);

  const handleSearch = (e) => {
    e.preventDefault();
  };

  const renderProductCard = (product) => (
    <div key={product.id} className="bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group flex flex-col h-full">
      <div className="aspect-[4/3] bg-slate-50 dark:bg-slate-900/50 relative overflow-hidden">
        {getMedicineImage(product) ? (
          <img 
            src={getMedicineImage(product)} 
            alt={product.name} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-350 dark:text-slate-600 text-3xl">
            <FaBox />
          </div>
        )}
        
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.stock_quantity <= 50 && product.stock_quantity > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-sm">
              <FaBolt className="text-[8px]" /> Low Stock
            </span>
          )}
          {product.stock_quantity === 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500 text-white shadow-sm">
              <FaTimes className="text-[8px]" /> Out of Stock
            </span>
          )}
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div className="space-y-1">
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">{product.category}</span>
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 leading-snug line-clamp-1">{product.name}</h3>
          {product.generic_name && (
            <p className="text-[11px] text-slate-450 dark:text-slate-500 font-bold italic line-clamp-1">{product.generic_name}</p>
          )}
          {product.manufacturer && (
            <p className="text-[10px] text-slate-400 dark:text-slate-400 font-semibold flex items-center gap-1">
              <FaBox className="text-[8px] text-emerald-500" /> {product.manufacturer}
            </p>
          )}
        </div>
        
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50 dark:border-slate-700/60">
          <div className="flex flex-col">
            <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Price</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">₹{parseFloat(product.price).toFixed(2)}</span>
          </div>
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800">
            <FaWarehouse className="text-[8px]" /> Stock: {product.stock_quantity}
          </div>
        </div>
      </div>
    </div>
  );

  // Count products for each tab
  const medicineCategories = [
    'medicines', 'prescription_drugs', 'otc_medicines',
    'antibiotics', 'painkillers', 'vitamins', 'ayurvedic', 'homeopathy'
  ];
  
  const medicineCount = allProducts.filter(p => 
    medicineCategories.includes(p.category?.toLowerCase())
  ).length;
  
  const otherCount = allProducts.filter(p => 
    !medicineCategories.includes(p.category?.toLowerCase())
  ).length;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800/80 sticky top-0 z-40 shadow-sm transition-colors">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <button 
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-colors border-none cursor-pointer"
            onClick={() => navigate(-1)}
          >
            <FaArrowLeft /> Back
          </button>

          <form className="flex-1 max-w-lg relative flex items-center" onSubmit={handleSearch}>
            <FaSearch className="absolute left-4 text-slate-400 text-sm" />
            <input
              type="text"
              placeholder="Search medicines, devices, supplies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/85 dark:border-slate-700 rounded-2xl text-xs focus:outline-none focus:border-green-600 focus:ring-4 focus:ring-green-500/10 transition-all font-semibold placeholder:text-slate-400 dark:text-white"
            />
          </form>
        </div>
      </header>

      {/* Search Results */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 mb-8 overflow-x-auto nms-stores-scrollbar">
          <button
            onClick={() => setActiveTab('medicines')}
            className={`flex items-center gap-2 px-5 py-4 border-b-2 font-black text-xs uppercase tracking-wider bg-transparent border-none cursor-pointer transition-colors ${
              activeTab === 'medicines'
                ? "border-green-600 text-green-605"
                : "border-transparent text-slate-450 hover:text-slate-600"
            }`}
          >
            <FaPills /> <span>Medicines ({medicineCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('other')}
            className={`flex items-center gap-2 px-5 py-4 border-b-2 font-black text-xs uppercase tracking-wider bg-transparent border-none cursor-pointer transition-colors ${
              activeTab === 'other'
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-450 hover:text-slate-600"
            }`}
          >
            <FaStethoscope /> <span>Other Products ({otherCount})</span>
          </button>
        </div>

        {/* Results Header */}
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            {searchQuery ? `Search Results: "${searchQuery}"` : 'All Products'}
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-1">Found {filteredProducts.length} matching products</p>
        </div>

        {/* Results Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Searching catalogue...</p>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map(renderProductCard)}
          </div>
        ) : (
          <div className="py-20 text-center space-y-3">
            <FaSearch className="text-5xl text-slate-300 mx-auto" />
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">
              {searchQuery ? 'No Products Found' : 'Start Searching'}
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold max-w-sm mx-auto">
              {searchQuery 
                ? 'Try different keywords or check spelling.' 
                : 'Enter a product name, category, or manufacturer.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default PharmacySearch;