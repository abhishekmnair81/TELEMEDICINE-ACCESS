import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { pharmacyAPI, cartAPI } from '../services/api';
import './PharmacyBrowse.css';
import NearestMedicalStores from './Nearestmedicalstores';
import Footer from './Footer';



const Icons = {
  Search: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  Filter: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  ),
  Cart: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  ),
  Scan: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
      <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
      <line x1="7" y1="12" x2="17" y2="12"/>
    </svg>
  ),
  Upload: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  Close: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Check: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  AlertCircle: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  Pill: () => (
    <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
      <line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>
    </svg>
  ),
  ShoppingBag: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  ),
  FileText: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Sparkles: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  Info: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  ),
  Stethoscope: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
      <path d="M8 15a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-3"/>
      <circle cx="20" cy="10" r="2"/>
    </svg>
  ),
  Eye: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  MapPin: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
};

const CATEGORY_MAP = {
  medicines:         ['medicines', 'prescription_drugs', 'antibiotics', 'painkillers', 'homeopathy'],
  otc_medicines:     ['otc_medicines', 'otc'],
  vitamins:          ['vitamins', 'supplements'],
  first_aid_kits:    ['first_aid_kits', 'first_aid', 'bandages', 'antiseptics', 'syringes', 'gloves', 'cotton'],
  bp_monitors:       ['bp_monitors', 'thermometers', 'glucometers', 'pulse_oximeters', 'nebulizers', 'medical_devices', 'devices'],
  baby_care:         ['baby_care', 'diapers', 'baby_food', 'baby_wipes'],
  diabetic_supplies: ['diabetic_supplies', 'insulin', 'diabetic'],
  ayurvedic:         ['ayurvedic', 'herbal'],
};

const CATEGORIES = [
  { id: 'all',               label: 'All Products',  icon: '🏪' },
  { id: 'medicines',         label: 'Medicines',     icon: '💊' },
  { id: 'otc_medicines',     label: 'OTC Medicines', icon: '🩺' },
  { id: 'vitamins',          label: 'Vitamins',      icon: '🫐' },
  { id: 'first_aid_kits',    label: 'First Aid',     icon: '🩹' },
  { id: 'bp_monitors',       label: 'Devices',       icon: '🔬' },
  { id: 'baby_care',         label: 'Baby Care',     icon: '👶' },
  { id: 'diabetic_supplies', label: 'Diabetic',      icon: '🩸' },
  { id: 'ayurvedic',         label: 'Ayurvedic',     icon: '🌿' },
];

const productMatchesCategory = (product, tabId) => {
  if (tabId === 'all') return true;
  const productCat = (product.category || '').toLowerCase().trim();
  const allowed = CATEGORY_MAP[tabId];
  if (allowed) return allowed.includes(productCat);
  return productCat === tabId;
};

const SORT_OPTIONS = [
  { value: 'name_asc',   label: 'Name A–Z' },
  { value: 'name_desc',  label: 'Name Z–A' },
  { value: 'price_asc',  label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'discount',   label: 'Best Discount' },
];

const MAX_UPLOAD_MB    = 25;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const SCANNER_STEPS = {
  UPLOAD:    'upload',
  ANALYZING: 'analyzing',
  RESULTS:   'results',
  ADDING:    'adding',
};

export default function PharmacyBrowse() {
  const navigate = useNavigate();

  const [products,         setProducts]         = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState(null);

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [sortBy,         setSortBy]         = useState('name_asc');
  const [priceRange,     setPriceRange]     = useState({ min: 0, max: 10000 });
  const [showFilters,    setShowFilters]    = useState(false);

  const [cartItems,   setCartItems]   = useState({});
  const [cartLoading, setCartLoading] = useState({});
  const [cartCount,   setCartCount]   = useState(0);

  const [showScanner,  setShowScanner]  = useState(false);
  const [scannerStep,  setScannerStep]  = useState(SCANNER_STEPS.UPLOAD);
  const [dragActive,   setDragActive]   = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [scanError,    setScanError]    = useState(null);
  const [scanProgress, setScanProgress] = useState('');

  const [extractedMedicines,   setExtractedMedicines]   = useState([]);
  const [matchedProducts,      setMatchedProducts]      = useState([]);
  const [unavailableMedicines, setUnavailableMedicines] = useState([]);
  const [prescriptionInfo,     setPrescriptionInfo]     = useState(null);
  const [selectedForCart,      setSelectedForCart]      = useState({});
  const [addAllResult,         setAddAllResult]         = useState(null);

  const [showNearby, setShowNearby] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    loadProducts();
    loadCartCount();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await pharmacyAPI.getAllMedicines();
      const list = Array.isArray(data) ? data : (data.results || []);
      setProducts(list);
      setFilteredProducts(list);
    } catch (err) {
      setError('Failed to load products. Please try again.');
      console.error('[PharmacyBrowse] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCartCount = async () => {
    try {
      const count = await cartAPI.getCartCount();
      setCartCount(count);
    } catch {  }
  };

  useEffect(() => {
    let result = [...products];
    result = result.filter(p => productMatchesCategory(p, activeCategory));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        (p.name         || '').toLowerCase().includes(q) ||
        (p.generic_name || '').toLowerCase().includes(q) ||
        (p.manufacturer || '').toLowerCase().includes(q) ||
        (p.brand_name   || '').toLowerCase().includes(q)
      );
    }

    result = result.filter(p =>
      parseFloat(p.price || 0) >= priceRange.min &&
      parseFloat(p.price || 0) <= priceRange.max
    );

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':   return (a.name || '').localeCompare(b.name || '');
        case 'name_desc':  return (b.name || '').localeCompare(a.name || '');
        case 'price_asc':  return parseFloat(a.price || 0) - parseFloat(b.price || 0);
        case 'price_desc': return parseFloat(b.price || 0) - parseFloat(a.price || 0);
        case 'discount':   return parseFloat(b.discount_percentage || 0) - parseFloat(a.discount_percentage || 0);
        default: return 0;
      }
    });

    setFilteredProducts(result);
  }, [products, activeCategory, searchQuery, sortBy, priceRange]);

  const handleAddToCart = async (e, product) => {
    e.stopPropagation();
    const id = product.id;
    setCartLoading(prev => ({ ...prev, [id]: true }));
    try {
      await cartAPI.addToCart(id, 1);
      setCartItems(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
      setCartCount(prev => prev + 1);
    } catch (err) {
      console.error('[Cart] Add error:', err);
    } finally {
      setCartLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleProductClick = (product) => {
    navigate(`/pharmacy/product/${product.id}`);
  };

  const MEDIA_BASE_URL = process.env.REACT_APP_MEDIA_URL || 'http://localhost:8000';
  const resolveImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${MEDIA_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const getProductImage = (product) => {
    if (!product) return null;
    if (product.primary_image) return resolveImageUrl(product.primary_image);
    if (product.images?.length > 0) {
      const primary = product.images.find(img => img.is_primary) || product.images[0];
      return resolveImageUrl(primary.image_url || primary.image);
    }
    if (product.image) return resolveImageUrl(product.image);
    return null;
  };

  const formatPrice = (price) => parseFloat(price || 0).toFixed(2);
  const getDiscount = (p)     => parseFloat(p.discount_percentage || 0).toFixed(0);

  const openScanner = () => {
    setShowScanner(true);
    setScannerStep(SCANNER_STEPS.UPLOAD);
    setUploadedFile(null);
    setScanError(null);
    setScanProgress('');
    setExtractedMedicines([]);
    setMatchedProducts([]);
    setUnavailableMedicines([]);
    setPrescriptionInfo(null);
    setSelectedForCart({});
    setAddAllResult(null);
  };

  const closeScanner = () => setShowScanner(false);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleFileSelect = (file) => {
    if (!file) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(file.type)) { setScanError('Please upload a PDF or image file (JPG, PNG).'); return; }
    if (file.size > MAX_UPLOAD_BYTES) { setScanError(`File size must be under ${MAX_UPLOAD_MB}MB.`); return; }
    setScanError(null);
    setUploadedFile(file);
  };

  const analyzePrescription = async () => {
    if (!uploadedFile) return;
    setScannerStep(SCANNER_STEPS.ANALYZING);
    setScanProgress('Reading prescription...');
    setScanError(null);
    try {
      setScanProgress('AI is extracting medicines from prescription...');
      const formData = new FormData();
      formData.append('file', uploadedFile);
      const data = await pharmacyAPI.scanPrescription(formData);
      if (!data.success) throw new Error(data.error || 'Failed to analyze prescription');
      setScanProgress('Matching medicines in our pharmacy...');
      setPrescriptionInfo({ doctorInfo: data.doctorInfo || {}, patientInfo: data.patientInfo || {}, diagnosis: data.diagnosis || '' });
      setExtractedMedicines(data.medicines || []);
      setMatchedProducts(data.matched_products || []);
      setUnavailableMedicines(data.unmatched_medicines || []);
      const defaultSelected = {};
      (data.matched_products || []).forEach(item => { defaultSelected[item.medicine.name] = true; });
      setSelectedForCart(defaultSelected);
      setScannerStep(SCANNER_STEPS.RESULTS);
    } catch (err) {
      console.error('[Scanner] Analysis error:', err);
      setScanError(err.message || 'Failed to analyze prescription. Please try again.');
      setScannerStep(SCANNER_STEPS.UPLOAD);
    }
  };

  const handleAddSelectedToCart = async () => {
    setScannerStep(SCANNER_STEPS.ADDING);
    setScanProgress('Adding medicines to cart...');
    const toAdd = matchedProducts.filter(({ medicine }) => selectedForCart[medicine.name]);
    let addedCount = 0, failedCount = 0;
    for (const { medicine, product } of toAdd) {
      try { await cartAPI.addToCart(product.id, 1); addedCount++; setCartCount(prev => prev + 1); }
      catch { failedCount++; }
    }
    setAddAllResult({ addedCount, failedCount, total: toAdd.length });
    setScannerStep(SCANNER_STEPS.RESULTS);
  };

  const toggleMedicineSelection = (name) => {
    setSelectedForCart(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const selectedCount = Object.values(selectedForCart).filter(Boolean).length;

  const renderProductCard = (product) => {
    const imgSrc     = getProductImage(product);
    const discount   = getDiscount(product);
    const inCart     = cartItems[product.id] > 0;
    const isLoading  = cartLoading[product.id];
    const outOfStock = (product.stock_quantity || 0) === 0;

    return (
      <div
        key={product.id}
        className="group bg-white rounded-2xl border border-gray-200/80 overflow-hidden flex flex-col relative transition-all duration-300 hover:shadow-lg hover:border-green-500/30 hover:-translate-y-1 cursor-pointer"
        onClick={() => handleProductClick(product)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleProductClick(product)}
        title={`View details for ${product.name}`}
      >
        {discount > 0 && (
          <div className="absolute top-2.5 left-2.5 bg-gradient-to-br from-orange-500 to-red-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-lg z-10 tracking-wide">
            {discount}% OFF
          </div>
        )}
        {product.requires_prescription && (
          <div className="absolute top-2.5 right-2.5 bg-slate-900 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-lg z-10 tracking-wider">
            Rx
          </div>
        )}

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900/85 backdrop-blur text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 shadow-lg">
          <Icons.Eye /><span>View Details</span>
        </div>

        <div className="h-40 bg-gray-50 flex items-center justify-center overflow-hidden relative">
          {imgSrc ? (
            <img
              src={imgSrc} alt={product.name}
              className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
            />
          ) : null}
          <div className="w-full h-full flex items-center justify-center bg-green-50/50" style={{ display: imgSrc ? 'none' : 'flex' }}>
            <Icons.Pill />
          </div>
        </div>

        <div className="p-3.5 flex-1 flex flex-col gap-1">
          <div className="text-[9px] font-bold text-green-500 uppercase tracking-wider">
            {(product.category || '').replace(/_/g, ' ')}
          </div>
          <h3 className="text-xs md:text-sm font-bold text-gray-900 line-clamp-2 leading-tight h-8 md:h-10" title={product.name}>
            {product.name}
          </h3>
          {product.generic_name  && <p className="text-[10px] md:text-xs text-gray-400 italic truncate">{product.generic_name}</p>}
          {product.manufacturer  && <p className="text-[9px] md:text-[10px] text-gray-400 truncate">by {product.manufacturer}</p>}
          {product.strength      && (
            <span className="inline-block w-fit bg-green-50 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-md mt-1">
              {product.strength}
            </span>
          )}
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-sm md:text-base font-extrabold text-gray-900">₹{formatPrice(product.price)}</span>
            {product.mrp && parseFloat(product.mrp) > parseFloat(product.price) && (
              <span className="text-[11px] md:text-xs text-gray-400 line-through">₹{formatPrice(product.mrp)}</span>
            )}
          </div>
          <div className="text-[10px] md:text-xs font-semibold mt-1">
            {outOfStock
              ? <span className="text-red-500">Out of Stock</span>
              : <span className="text-emerald-500">✓ In Stock ({product.stock_quantity})</span>
            }
          </div>
        </div>

        <button
          className={`w-full py-2.5 text-white text-xs font-bold flex items-center justify-center gap-1.5 border-none transition-all cursor-pointer mt-auto ${inCart ? 'bg-emerald-500' : 'bg-green-500 hover:bg-green-600'} ${outOfStock ? '!bg-gray-100 !text-gray-400 cursor-not-allowed' : ''}`}
          onClick={(e) => { if (!outOfStock) handleAddToCart(e, product); else e.stopPropagation(); }}
          disabled={outOfStock || isLoading}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
          ) : inCart ? (
            <>
              <Icons.Check /><span>Added</span>
            </>
          ) : (
            <>
              <Icons.Cart /><span>{outOfStock ? 'Unavailable' : 'Add to Cart'}</span>
            </>
          )}
        </button>
      </div>
    );
  };

  const renderScannerModal = () => {
    if (!showScanner) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease]" onClick={(e) => e.target === e.currentTarget && closeScanner()}>
        <div className="bg-white rounded-3xl w-full max-w-[680px] max-h-[90vh] flex flex-col shadow-2xl animate-[slideUp_0.28s_cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden">
          <div className="flex items-start justify-between gap-4 p-6 pb-0">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-green-500/20 text-white">
                <Icons.Sparkles />
              </div>
              <div>
                <h2 className="text-base md:text-lg font-bold text-gray-900 leading-tight m-0">AI Prescription Scanner</h2>
                <p className="text-xs text-gray-500 m-0 mt-0.5">Upload your prescription — AI extracts &amp; matches medicines automatically</p>
              </div>
            </div>
            <button className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-800 flex items-center justify-center cursor-pointer transition-colors border-none" onClick={closeScanner}>
              <Icons.Close />
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 p-5 border-b border-gray-100 flex-shrink-0 bg-gray-50/50 mt-4">
            {[
              { key: SCANNER_STEPS.UPLOAD,    label: 'Upload',  num: 1 },
              { key: SCANNER_STEPS.ANALYZING, label: 'Analyze', num: 2 },
              { key: SCANNER_STEPS.RESULTS,   label: 'Results', num: 3 },
            ].map((step, idx) => {
              const stepOrder  = [SCANNER_STEPS.UPLOAD, SCANNER_STEPS.ANALYZING, SCANNER_STEPS.RESULTS, SCANNER_STEPS.ADDING];
              const currentIdx = stepOrder.indexOf(scannerStep);
              const stepIdx    = stepOrder.indexOf(step.key);
              const isDone     = currentIdx > stepIdx;
              const isActive   = currentIdx === stepIdx;
              return (
                <React.Fragment key={step.key}>
                  <div className={`flex items-center gap-2 text-xs md:text-sm font-semibold ${isActive ? 'text-green-600' : isDone ? 'text-emerald-500' : 'text-gray-400'}`}>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-current'}`}>
                      {isDone ? <Icons.Check /> : step.num}
                    </div>
                    <span>{step.label}</span>
                  </div>
                  {idx < 2 && <div className={`w-10 h-0.5 ${isDone ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
                </React.Fragment>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {}
            {scannerStep === SCANNER_STEPS.UPLOAD && (
              <div className="flex flex-col gap-4">
                <div
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${dragActive ? 'border-green-500 bg-green-50/10' : uploadedFile ? 'border-emerald-500/50 bg-emerald-50/5' : 'border-gray-200 hover:border-green-500 hover:bg-green-50/5'}`}
                  onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                    onChange={(e) => handleFileSelect(e.target.files[0])} />
                  {uploadedFile ? (
                    <div className="flex items-center gap-3 bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl text-left">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                        <Icons.FileText />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <strong className="text-xs md:text-sm font-semibold text-gray-800 truncate">{uploadedFile.name}</strong>
                        <span className="text-[10px] md:text-xs text-gray-400 mt-0.5">{(uploadedFile.size / 1024).toFixed(1)} KB · {uploadedFile.type.split('/')[1].toUpperCase()}</span>
                      </div>
                      <button className="w-7 h-7 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center cursor-pointer transition-colors border-none bg-transparent" onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }}>
                        <Icons.Close />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                        <Icons.Upload />
                      </div>
                      <h3 className="text-sm md:text-base font-bold text-gray-800 m-0">Drop your prescription here</h3>
                      <p className="text-xs text-gray-500 m-0">or click to browse files</p>
                      <div className="flex gap-1.5 mt-1">
                        <span className="text-[9px] font-extrabold text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded uppercase tracking-wider">PDF</span>
                        <span className="text-[9px] font-extrabold text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded uppercase tracking-wider">JPG</span>
                        <span className="text-[9px] font-extrabold text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded uppercase tracking-wider">PNG</span>
                        <span className="text-[9px] font-extrabold text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded uppercase tracking-wider">Max {MAX_UPLOAD_MB}MB</span>
                      </div>
                    </div>
                  )}
                </div>
                {scanError && (
                  <div className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-3 rounded-lg text-xs font-semibold">
                    <Icons.AlertCircle /><span>{scanError}</span>
                  </div>
                )}
                <div className="flex gap-2.5 bg-blue-50/50 text-blue-800 p-4 rounded-xl text-xs leading-relaxed">
                  <Icons.Info className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="m-0">Your prescription is processed securely. AI extracts medicine names, dosages, and frequency for pharmacy matching.</p>
                </div>
                <div className="flex justify-end gap-3 mt-4 border-t border-gray-100 pt-4">
                  <button className="px-5 py-2.5 bg-white border border-gray-200 rounded-full text-xs md:text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors" onClick={closeScanner}>Cancel</button>
                  <button className="px-5 py-2.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full text-xs md:text-sm font-bold flex items-center gap-1.5 border-none transition-colors" onClick={analyzePrescription} disabled={!uploadedFile}>
                    <Icons.Sparkles /><span>Analyze Prescription</span>
                  </button>
                </div>
              </div>
            )}

            {}
            {(scannerStep === SCANNER_STEPS.ANALYZING || scannerStep === SCANNER_STEPS.ADDING) && (
              <div className="flex flex-col items-center text-center py-6 gap-3">
                <div className="relative w-16 h-16 flex items-center justify-center mb-2 bg-green-50 rounded-full text-green-600">
                  <div className="absolute inset-0 rounded-full bg-green-400/20 animate-ping"></div>
                  <Icons.Stethoscope />
                </div>
                <h3 className="text-base md:text-lg font-bold text-gray-800 m-0">{scannerStep === SCANNER_STEPS.ADDING ? 'Adding to Cart' : 'AI is Reading Your Prescription'}</h3>
                <p className="text-xs md:text-sm text-green-600 font-semibold animate-pulse m-0">{scanProgress}</p>
                <div className="flex flex-col gap-2 mt-4 text-left w-full max-w-sm mx-auto">
                  <div className="flex items-center gap-2.5 text-xs text-green-600 font-semibold">
                    <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                    <span>Extracting medicine names &amp; dosages</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-gray-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                    <span>Matching with pharmacy catalog</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-gray-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                    <span>Checking stock availability</span>
                  </div>
                </div>
              </div>
            )}

            {}
            {scannerStep === SCANNER_STEPS.RESULTS && (
              <div className="flex flex-col gap-5">
                {addAllResult && (
                  <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs md:text-sm font-semibold ${addAllResult.failedCount > 0 ? 'bg-amber-50 text-amber-800 border border-amber-100' : 'bg-emerald-50 text-emerald-800 border border-emerald-100'}`}>
                    <Icons.Check />
                    <div>
                      <strong>{addAllResult.addedCount} medicine{addAllResult.addedCount !== 1 ? 's' : ''} added to cart!</strong>
                      {addAllResult.failedCount > 0 && <span> ({addAllResult.failedCount} failed)</span>}
                    </div>
                  </div>
                )}

                {prescriptionInfo && (prescriptionInfo.doctorInfo?.name || prescriptionInfo.patientInfo?.name || prescriptionInfo.diagnosis) && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 m-0">
                      <Icons.FileText /> Prescription Details
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {prescriptionInfo.doctorInfo?.name  && <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Doctor</label><span className="text-xs md:text-sm font-semibold text-gray-800 mt-0.5 block truncate">Dr. {prescriptionInfo.doctorInfo.name}</span></div>}
                      {prescriptionInfo.doctorInfo?.clinic && <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Clinic</label><span className="text-xs md:text-sm font-semibold text-gray-800 mt-0.5 block truncate">{prescriptionInfo.doctorInfo.clinic}</span></div>}
                      {prescriptionInfo.patientInfo?.name  && <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Patient</label><span className="text-xs md:text-sm font-semibold text-gray-800 mt-0.5 block truncate">{prescriptionInfo.patientInfo.name}</span></div>}
                      {prescriptionInfo.patientInfo?.age   && <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Age</label><span className="text-xs md:text-sm font-semibold text-gray-800 mt-0.5 block truncate">{prescriptionInfo.patientInfo.age}</span></div>}
                      {prescriptionInfo.diagnosis          && <div className="col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Diagnosis</label><span className="text-xs md:text-sm font-semibold text-gray-800 mt-0.5 block truncate">{prescriptionInfo.diagnosis}</span></div>}
                    </div>
                  </div>
                )}

                {matchedProducts.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs md:text-sm font-bold text-gray-800 m-0 flex items-center gap-2">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{matchedProducts.length}</span> Medicines Available in Our Pharmacy
                      </h4>
                      <button className="bg-transparent border-none text-green-500 hover:text-green-600 text-xs font-bold cursor-pointer transition-colors p-0" onClick={() => {
                        const allSelected = matchedProducts.every(({ medicine }) => selectedForCart[medicine.name]);
                        const next = {};
                        matchedProducts.forEach(({ medicine }) => { next[medicine.name] = !allSelected; });
                        setSelectedForCart(next);
                      }}>
                        {matchedProducts.every(({ medicine }) => selectedForCart[medicine.name]) ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {matchedProducts.map(({ medicine, product }) => (
                        <div key={medicine.name}
                          className={`flex items-center gap-3 border p-3.5 rounded-xl hover:border-green-300 hover:bg-green-50/5 cursor-pointer transition-all ${selectedForCart[medicine.name] ? 'border-green-500 bg-green-500/5' : 'border-gray-200/80'}`}
                          onClick={() => !addAllResult && toggleMedicineSelection(medicine.name)}>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] text-white flex-shrink-0 ${selectedForCart[medicine.name] ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                            {selectedForCart[medicine.name] ? <Icons.Check /> : null}
                          </div>
                          <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {getProductImage(product) ? <img src={getProductImage(product)} alt={product.name} className="w-full h-full object-contain p-1" /> : <Icons.Pill />}
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <div className="flex items-baseline gap-2">
                              <strong className="text-xs md:text-sm font-bold text-gray-800 truncate">{medicine.name}</strong>
                              {medicine.dosage && <span className="bg-slate-100 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded">{medicine.dosage}</span>}
                            </div>
                            <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-gray-400">
                              {medicine.frequency    && <span>📅 {medicine.frequency}</span>}
                              {medicine.duration     && <span>⏱ {medicine.duration}</span>}
                              {medicine.instructions && <span>📋 {medicine.instructions}</span>}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-green-600 font-medium">
                              <span className="truncate max-w-[200px]">{product.name}</span>
                              {product.strength && <span className="text-[9px] bg-green-50 px-1 rounded">{product.strength}</span>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 flex-shrink-0 pl-2">
                            <span className="text-sm md:text-base font-extrabold text-gray-900">₹{formatPrice(product.price)}</span>
                            {product.mrp && parseFloat(product.mrp) > parseFloat(product.price) && <span className="text-[11px] md:text-xs text-gray-400 line-through">₹{formatPrice(product.mrp)}</span>}
                            {parseFloat(product.discount_percentage || 0) > 0 && <span className="bg-orange-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full mt-0.5">{getDiscount(product)}% off</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {unavailableMedicines.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <h4 className="text-xs md:text-sm font-bold text-gray-800 m-0 flex items-center gap-2">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{unavailableMedicines.length}</span> Not Available — Check with Pharmacist
                    </h4>
                    <div className="flex flex-col gap-2">
                      {unavailableMedicines.map((medicine, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-gray-50 border border-gray-200/80 p-3 rounded-xl">
                          <Icons.AlertCircle className="text-amber-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0 text-xs text-gray-600">
                            <strong className="text-gray-850">{medicine.name}</strong>
                            {medicine.dosage    && <span className="text-gray-400"> · {medicine.dosage}</span>}
                            {medicine.frequency && <span className="text-gray-400"> · {medicine.frequency}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-400 italic">Please consult your pharmacist or doctor for these medicines.</p>
                  </div>
                )}

                {matchedProducts.length === 0 && unavailableMedicines.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-gray-500 gap-2">
                    <Icons.AlertCircle />
                    <h3 className="text-sm font-bold text-gray-800 m-0">No Medicines Detected</h3>
                    <p className="text-xs">We couldn't extract medicine information from this prescription. Please try a clearer image.</p>
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-4 border-t border-gray-100 pt-4">
                  <button className="px-5 py-2.5 bg-white border border-gray-200 rounded-full text-xs md:text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors" onClick={() => { setScannerStep(SCANNER_STEPS.UPLOAD); setUploadedFile(null); setAddAllResult(null); }}>Scan Another</button>
                  <button className="px-5 py-2.5 bg-white border border-gray-200 rounded-full text-xs md:text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors" onClick={closeScanner}>Close</button>
                  {matchedProducts.length > 0 && !addAllResult && (
                    <button className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-full text-xs md:text-sm font-bold flex items-center gap-1.5 border-none transition-colors" onClick={handleAddSelectedToCart} disabled={selectedCount === 0}>
                      <Icons.Cart />
                      <span>Add {selectedCount > 0 ? `${selectedCount} ` : ''}Medicine{selectedCount !== 1 ? 's' : ''} to Cart</span>
                    </button>
                  )}
                  {addAllResult && (
                    <button className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-full text-xs md:text-sm font-bold flex items-center gap-1.5 border-none transition-colors animate-pulse" onClick={closeScanner}>
                      <Icons.ShoppingBag /><span>View Cart ({cartCount})</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 pb-10">

      {/* Header */}
      <div className="bg-gradient-to-br from-green-800 to-green-600 text-white p-5 md:px-7 md:py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-green-800/10">
        <div className="flex flex-col">
          <h1 className="text-xl md:text-2xl font-extrabold flex items-center gap-2.5 tracking-tight m-0">
            <Icons.ShoppingBag className="stroke-white" />Pharmacy Store
          </h1>
          <p className="text-xs md:text-sm text-green-100 font-medium m-0 mt-1">Genuine medicines, delivered to your door</p>
        </div>

        <div className="flex items-center gap-3">
          <button className="relative flex items-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur border border-white/30 text-white px-4 py-2 rounded-full text-xs md:text-sm font-bold transition-all shadow-sm cursor-pointer border-none" onClick={() => setShowNearby(true)}>
            <Icons.MapPin />
            <span>Nearby Stores</span>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full" />
          </button>

          <button className="relative flex items-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur border border-white/30 text-white px-4 py-2 rounded-full text-xs md:text-sm font-bold transition-all shadow-sm cursor-pointer border-none" onClick={openScanner}>
            <Icons.Scan /><span>Scan Prescription</span>
            <span className="bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded ml-1 uppercase tracking-wider">AI</span>
          </button>

          <button className="relative bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur border border-white/30 text-white w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm border-none" onClick={() => navigate('/cart')}>
            <Icons.Cart />
            {cartCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-extrabold w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white">{cartCount}</span>}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3 px-4 md:px-7 py-5 items-center flex-wrap">
        <div className="flex-1 min-w-[220px] flex items-center gap-2.5 bg-white border border-gray-200 rounded-full px-4 py-2.5 transition-all focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500/10">
          <Icons.Search />
          <input
            type="text"
            placeholder="Search medicines, brands, generics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 border-none outline-none text-xs md:text-sm text-gray-805 bg-transparent placeholder:text-gray-400"
          />
          {searchQuery && (
            <button className="bg-transparent border-none cursor-pointer text-gray-400 hover:text-red-500 p-0 flex items-center" onClick={() => setSearchQuery('')}>
              <Icons.Close />
            </button>
          )}
        </div>

        <div className="relative flex items-center">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="appearance-none bg-white border border-gray-200 rounded-full pl-4 pr-9 py-2.5 text-xs md:text-sm text-gray-800 cursor-pointer outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10 min-w-[160px]"
          >
            {SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <Icons.ChevronDown />
        </div>

        <button className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4.5 py-2.5 text-xs md:text-sm text-gray-700 font-semibold cursor-pointer transition-all hover:border-green-500 hover:text-green-500" onClick={() => setShowFilters(!showFilters)}>
          <Icons.Filter /><span>Filters</span>
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mx-4 md:mx-7 bg-white border border-gray-200 rounded-2xl p-5 flex gap-6 items-end flex-wrap animate-[slideDown_0.2s_ease] mb-4">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Price Range: ₹{priceRange.min} – ₹{priceRange.max}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max={priceRange.max}
                value={priceRange.min}
                onChange={(e) => setPriceRange(prev => ({ ...prev, min: Number(e.target.value) }))}
                placeholder="Min"
                className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-xs md:text-sm outline-none transition-colors focus:border-green-500"
              />
              <span className="text-gray-400 font-semibold">to</span>
              <input
                type="number"
                min={priceRange.min}
                value={priceRange.max}
                onChange={(e) => setPriceRange(prev => ({ ...prev, max: Number(e.target.value) }))}
                placeholder="Max"
                className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-xs md:text-sm outline-none transition-colors focus:border-green-500"
              />
            </div>
          </div>
          <button className="bg-transparent border border-gray-200 rounded-lg px-4 py-2 text-xs md:text-sm text-gray-700 font-semibold cursor-pointer transition-colors hover:border-red-500 hover:text-red-500" onClick={() => setPriceRange({ min: 0, max: 10000 })}>
            Reset Filters
          </button>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-2.5 px-4 md:px-7 py-2 overflow-x-auto scrollbar-none mb-4">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 bg-white text-xs md:text-sm font-semibold text-gray-700 cursor-pointer whitespace-nowrap transition-colors hover:border-green-500 hover:text-green-500 hover:bg-green-50/50 flex-shrink-0 ${activeCategory === cat.id ? '!bg-green-500 !border-green-500 !text-white shadow-md shadow-green-500/10' : ''}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            <span className="text-base">{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Results Summary */}
      <div className="px-4 md:px-7 pb-3 flex items-center justify-between text-xs md:text-sm text-gray-500 font-medium">
        <span>
          {loading ? 'Loading...' : `${filteredProducts.length} product${filteredProducts.length !== 1 ? 's' : ''} found`}
          {activeCategory !== 'all' && ` in ${CATEGORIES.find(c => c.id === activeCategory)?.label}`}
          {searchQuery && ` for "${searchQuery}"`}
        </span>
        {(activeCategory !== 'all' || searchQuery) && (
          <button className="bg-transparent border-none text-green-500 font-semibold cursor-pointer underline p-0" onClick={() => { setActiveCategory('all'); setSearchQuery(''); }}>Clear filters</button>
        )}
      </div>

      {/* Product Grid */}
      <div className="px-4 md:px-7 pb-10">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-center text-gray-500 gap-3">
            <div className="w-11 h-11 border-3 border-green-100 border-t-green-500 rounded-full animate-spin"></div>
            <p className="text-sm font-medium">Loading pharmacy products...</p>
          </div>
        )}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-center text-gray-500 gap-4">
            <Icons.AlertCircle className="text-red-500 w-12 h-12" />
            <h3 className="text-base font-bold text-gray-800 m-0">Failed to load products</h3>
            <p className="text-xs">{error}</p>
            <button className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-full text-xs font-bold border-none transition-colors" onClick={loadProducts}>Try Again</button>
          </div>
        )}
        {!loading && !error && filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center text-gray-500 gap-4">
            <Icons.ShoppingBag className="w-12 h-12 text-gray-300" />
            <h3 className="text-base font-bold text-gray-805 m-0">No products found</h3>
            <p className="text-xs">Try adjusting your search or filters</p>
            <button className="px-5 py-2.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors" onClick={() => { setActiveCategory('all'); setSearchQuery(''); }}>Show All Products</button>
          </div>
        )}
        {!loading && !error && filteredProducts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {filteredProducts.map(renderProductCard)}
          </div>
        )}
      </div>

      {/* Modals */}
      {renderScannerModal()}

      {/* Nearest Medical Stores Panel */}
      {showNearby && (
        <NearestMedicalStores onClose={() => setShowNearby(false)} />
      )}

      {/* Reusable Pharmacy Footer */}
      <Footer />

    </div>
  );
}