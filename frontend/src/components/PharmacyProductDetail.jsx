import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowRight } from 'react-icons/fa';
import {
  FaShoppingCart, FaHeart, FaShare, FaChevronLeft, FaChevronRight,
  FaTruck, FaShieldAlt, FaUndo, FaClock, FaMapMarkerAlt, FaPhone,
  FaCheck, FaTimes, FaBox, FaStar, FaStarHalfAlt, FaPlus, FaMinus,
  FaExclamationTriangle, FaInfoCircle, FaPills, FaFirstAid, FaStethoscope,
  FaChevronDown, FaChevronUp, FaPercentage, FaCertificate, FaSpinner, FaGlobe
} from 'react-icons/fa';
import { pharmacyAPI, cartAPI } from '../services/api';
import './PharmacyProductDetail.css';
import Footer from './Footer';



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

const PharmacyProductDetail = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [wishlist, setWishlist] = useState([]);
  const [showAddedToCart, setShowAddedToCart] = useState(false);
  const [activeTab, setActiveTab] = useState('description');
  const [addingToCart, setAddingToCart] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    keyFeatures: true,
    usage: false,
    benefits: false,
    ingredients: false
  });

  useEffect(() => {
    loadProduct();
    loadCartCount();
    loadWishlist();
  }, [productId]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const response = await pharmacyAPI.getMedicineById(productId);
      setProduct(response);
      
      if (response.category) {
        loadRelatedProducts(response.category);
      }
      
      setError(null);
    } catch (err) {
      console.error('[ProductDetail] Error:', err);
      setError('Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const loadCartCount = async () => {
    try {
      const count = await cartAPI.getCartCount();
      setCartCount(count);
    } catch (err) {
      console.error('[ProductDetail] Error loading cart count:', err);
      setCartCount(0);
    }
  };

  const loadRelatedProducts = async (category) => {
    try {
      const response = await pharmacyAPI.getAllMedicines();
      const related = response
        .filter(p => p.category === category && p.id !== parseInt(productId))
        .slice(0, 6);
      setRelatedProducts(related);
    } catch (err) {
      console.error('[ProductDetail] Error loading related:', err);
    }
  };

  const loadWishlist = () => {
    const savedWishlist = localStorage.getItem('pharmacy_wishlist');
    if (savedWishlist) {
      setWishlist(JSON.parse(savedWishlist));
    }
  };

  const saveWishlist = (updatedWishlist) => {
    localStorage.setItem('pharmacy_wishlist', JSON.stringify(updatedWishlist));
    setWishlist(updatedWishlist);
  };

  const handleAddToCart = async () => {
    if (!product || addingToCart) return;

    try {
      setAddingToCart(true);
      await cartAPI.addToCart(product.id, quantity);
      
      setShowAddedToCart(true);
      setTimeout(() => setShowAddedToCart(false), 3000);
      
      await loadCartCount();
      
      console.log(`[ProductDetail] Added ${quantity}x ${product.name} to cart`);
    } catch (err) {
      console.error('[ProductDetail] Add to cart error:', err);
      alert('Failed to add to cart: ' + err.message);
    } finally {
      setAddingToCart(false);
    }
  };

  const handleAddToWishlist = () => {
    if (!product) return;

    const isInWishlist = wishlist.some(item => item.id === product.id);
    
    let updatedWishlist;
    if (isInWishlist) {
      updatedWishlist = wishlist.filter(item => item.id !== product.id);
    } else {
      updatedWishlist = [...wishlist, {
        id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        mrp: parseFloat(product.mrp || product.price),
        image: product.primary_image || (product.images && product.images[0]?.image_url),
        category: product.category
      }];
    }

    saveWishlist(updatedWishlist);
  };

  const handleQuantityChange = (delta) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= product.stock_quantity) {
      setQuantity(newQuantity);
    }
  };

  const navigateImage = (direction) => {
    if (!product || !product.images || product.images.length === 0) return;
    
    if (direction === 'next') {
      setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
    } else {
      setCurrentImageIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
    }
  };

  const calculateDiscount = () => {
    if (!product || !product.mrp) return 0;
    const mrp = parseFloat(product.mrp);
    const price = parseFloat(product.price);
    return Math.round(((mrp - price) / mrp) * 100);
  };

  const isInWishlist = () => {
    return wishlist.some(item => item.id === product?.id);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-green-500 rounded-full animate-spin"></div>
        <p className="text-gray-500 font-semibold">Loading product...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5 text-center px-4">
        <FaExclamationTriangle className="text-red-500" size={48} />
        <h2 className="text-2xl font-bold text-gray-900">{error || 'Product not found'}</h2>
        <button 
          onClick={() => navigate('/pharmacy-home')} 
          className="px-7 py-3 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors duration-200 cursor-pointer shadow-md shadow-green-500/10 border-none"
        >
          Back to Shop
        </button>
      </div>
    );
  }

  const discount = calculateDiscount();
  const images = product.images || [];
  const currentImageRaw = images.length > 0 
    ? (images[currentImageIndex]?.image_url || images[currentImageIndex]?.image) 
    : (product.primary_image || product.image || null);
  const currentImage = resolveImageUrl(currentImageRaw);

  return (
    <div className="min-h-screen bg-white py-5 pb-10">
      {/* Breadcrumb */}
      <div className="bg-white py-3 border-b border-gray-200 mb-5">
        <div className="max-w-[1200px] mx-auto px-4 flex items-center flex-wrap gap-y-1">
          <span 
            onClick={() => navigate('/')}
            className="text-gray-500 text-xs md:text-sm cursor-pointer hover:text-green-500 transition-colors"
          >
            Home
          </span>
          <span className="mx-2 text-gray-400 cursor-default">/</span>
          <span 
            onClick={() => navigate(`/pharmacy?category=${product.category}`)}
            className="text-gray-500 text-xs md:text-sm cursor-pointer hover:text-green-500 transition-colors"
          >
            {product.category}
          </span>
          <span className="mx-2 text-gray-400 cursor-default">/</span>
          <span className="text-gray-900 font-medium cursor-default pointer-events-none text-xs md:text-sm truncate max-w-[200px] md:max-w-xs">
            {product.name}
          </span>
        </div>
      </div>

      {/* Success Toast */}
      {showAddedToCart && (
        <div className="fixed top-20 right-5 bg-emerald-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-2.5 z-[10000] animate-[slideIn_0.3s_ease] text-sm font-semibold">
          <FaCheck /> Added to cart successfully!
        </div>
      )}

      <div className="max-w-[1200px] mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-8 mb-10 bg-white">
          {/* Image Gallery Section */}
          <div className="lg:sticky lg:top-20 h-fit">
            <div className="bg-white">
              <div className="relative w-full aspect-square bg-white border border-gray-200 rounded-xl overflow-hidden mb-4 flex items-center justify-center shadow-sm">
                {currentImage ? (
                  <img src={currentImage} alt={product.name} className="w-full h-full object-contain p-6" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50">
                    <FaBox size={80} />
                  </div>
                )}
                
                {discount > 0 && (
                  <div className="absolute top-3 left-3 bg-red-600 text-white px-2.5 py-1 rounded font-bold text-xs z-10">
                    {discount}% OFF
                  </div>
                )}

                <button 
                  className="absolute top-3 right-3 w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center cursor-pointer transition-colors z-10 text-gray-400 hover:border-green-500 hover:text-green-500 shadow-sm"
                  onClick={handleAddToWishlist}
                >
                  <FaHeart className={isInWishlist() ? 'text-red-500' : ''} />
                </button>
              </div>

              {images.length > 1 && (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-5 gap-3">
                  {images.map((img, idx) => (
                    <div
                      key={idx}
                      className={`aspect-square bg-white border-2 rounded-lg overflow-hidden cursor-pointer transition-all flex items-center justify-center hover:border-green-500 ${idx === currentImageIndex ? 'border-green-500 bg-green-500/5' : 'border-gray-200'}`}
                      onClick={() => setCurrentImageIndex(idx)}
                    >
                      <img src={resolveImageUrl(img.image_url || img.image)} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-contain p-2" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Product Info Section */}
          <div className="flex flex-col gap-4 py-2">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">{product.name}</h1>
            
            {product.generic_name && (
              <p className="text-xs md:text-sm text-gray-500 italic mt-0.5">{product.generic_name}</p>
            )}

            {product.manufacturer && (
              <p className="text-xs md:text-sm text-gray-700">
                <span className="text-gray-500">Manufacturer:</span> {product.manufacturer}
              </p>
            )}

            {/* Rating */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1 text-amber-400 text-sm md:text-base">
                <FaStar />
                <FaStar />
                <FaStar />
                <FaStar />
                <FaStarHalfAlt />
              </div>
              <span className="text-xs md:text-sm text-gray-500">4.5 | 120 ratings</span>
            </div>

            {/* Price Section */}
            <div className="py-4 border-y border-gray-200 flex flex-col gap-1">
              <div className="flex items-baseline gap-3">
                <div className="text-2xl md:text-3xl font-extrabold text-gray-900">₹{product.price}</div>
                {product.mrp && parseFloat(product.mrp) > parseFloat(product.price) && (
                  <>
                    <div className="text-sm md:text-lg text-gray-500 line-through">MRP ₹{product.mrp}</div>
                    <div className="text-sm md:text-base text-emerald-500 font-semibold">Save {discount}%</div>
                  </>
                )}
              </div>
              <p className="text-[10px] md:text-xs text-gray-500">Inclusive of all taxes</p>
            </div>

            {/* Stock Status */}
            {product.stock_quantity > 0 ? (
              <div className="inline-flex items-center gap-2 text-emerald-500 text-xs md:text-sm font-semibold">
                <FaCheck /> In Stock
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 text-red-500 text-xs md:text-sm font-semibold">
                <FaTimes /> Out of Stock
              </div>
            )}

            {/* Prescription Warning */}
            {product.requires_prescription && (
              <div className="flex items-center gap-2.5 bg-amber-50 text-amber-800 p-3.5 rounded-lg text-xs md:text-sm font-medium border-l-4 border-amber-500 shadow-sm">
                <FaExclamationTriangle className="text-amber-500 flex-shrink-0" />
                <span>Prescription Required - Upload valid prescription during checkout</span>
              </div>
            )}

            {/* Key Information */}
            <div className="flex flex-col gap-2 p-4 bg-gray-50 rounded-lg">
              {product.form && (
                <div className="flex gap-3 text-xs md:text-sm">
                  <span className="text-gray-500 min-w-[80px]">Form:</span>
                  <span className="text-gray-900 font-medium">{product.form}</span>
                </div>
              )}
              {product.strength && (
                <div className="flex gap-3 text-xs md:text-sm">
                  <span className="text-gray-500 min-w-[80px]">Strength:</span>
                  <span className="text-gray-900 font-medium">{product.strength}</span>
                </div>
              )}
              {product.pack_size && (
                <div className="flex gap-3 text-xs md:text-sm">
                  <span className="text-gray-500 min-w-[80px]">Pack Size:</span>
                  <span className="text-gray-900 font-medium">{product.pack_size}</span>
                </div>
              )}
            </div>

            {/* Quantity & Add to Cart */}
            {product.stock_quantity > 0 && (
              <div className="flex flex-col gap-4 mt-2">
                <div className="flex items-center gap-4">
                  <label className="text-sm md:text-base font-semibold text-gray-900">Quantity:</label>
                  <div className="flex items-center gap-3 border border-gray-200 rounded-lg p-1.5 bg-white shadow-sm">
                    <button 
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1}
                      className="w-7 h-7 bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded flex items-center justify-center cursor-pointer transition-colors text-xs border-none"
                    >
                      <FaMinus />
                    </button>
                    <span className="text-sm md:text-base font-semibold text-gray-900 min-w-[24px] text-center">{quantity}</span>
                    <button 
                      onClick={() => handleQuantityChange(1)}
                      disabled={quantity >= product.stock_quantity}
                      className="w-7 h-7 bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded flex items-center justify-center cursor-pointer transition-colors text-xs border-none"
                    >
                      <FaPlus />
                    </button>
                  </div>
                </div>

                <button 
                  className="w-full py-3.5 px-7 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white rounded-lg text-sm md:text-base font-bold flex items-center justify-center gap-2.5 cursor-pointer transition-all uppercase tracking-wider shadow-md shadow-green-500/20 active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed border-none mt-2" 
                  onClick={handleAddToCart}
                  disabled={addingToCart}
                >
                  {addingToCart ? (
                    <>
                      <FaSpinner className="animate-spin" /> Adding...
                    </>
                  ) : (
                    <>
                      <FaShoppingCart /> Add to Cart
                    </>
                  )}
                </button>

                {cartCount > 0 && (
                  <button 
                    className="w-full py-3.5 px-7 bg-white hover:bg-green-50 border-2 border-green-500 text-green-500 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center gap-2.5 cursor-pointer transition-all uppercase tracking-wider mt-1 active:translate-y-[1px] shadow-sm shadow-green-500/5" 
                    onClick={() => navigate('/cart')}
                  >
                    <FaShoppingCart />
                    View Cart ({cartCount} {cartCount === 1 ? 'item' : 'items'})
                    <FaArrowRight className="ml-auto" />
                  </button>
                )}
              </div>
            )}

            {/* Delivery Benefits */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5 border-t border-gray-200 mt-4">
              <div className="flex items-start gap-3">
                <FaTruck className="text-lg md:text-xl text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs md:text-sm font-semibold text-gray-900 mb-0.5">Free Delivery</div>
                  <div className="text-[10px] md:text-xs text-gray-500">On orders above ₹500</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FaClock className="text-lg md:text-xl text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs md:text-sm font-semibold text-gray-900 mb-0.5">Delivery in 2-3 Days</div>
                  <div className="text-[10px] md:text-xs text-gray-500">Fast and reliable</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FaShieldAlt className="text-lg md:text-xl text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs md:text-sm font-semibold text-gray-900 mb-0.5">100% Authentic</div>
                  <div className="text-[10px] md:text-xs text-gray-500">All products verified</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Details Accordion */}
        <div className="mb-10 flex flex-col gap-3">
          {/* Description */}
          {product.description && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div 
                className="flex justify-between items-center p-4 md:p-5 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                onClick={() => toggleSection('keyFeatures')}
              >
                <h3 className="text-sm md:text-base font-semibold text-gray-900 m-0">Product Description</h3>
                {expandedSections.keyFeatures ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
              </div>
              {expandedSections.keyFeatures && (
                <div className="px-4 md:px-5 pb-4 md:pb-5 text-gray-600 text-xs md:text-sm leading-relaxed animate-[slideDown_0.3s_ease]">
                  <p>{product.description}</p>
                </div>
              )}
            </div>
          )}

          {/* Product Information */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div 
              className="flex justify-between items-center p-4 md:p-5 cursor-pointer hover:bg-gray-50 transition-colors select-none"
              onClick={() => toggleSection('usage')}
            >
              <h3 className="text-sm md:text-base font-semibold text-gray-900 m-0">Product Information</h3>
              {expandedSections.usage ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
            </div>
            {expandedSections.usage && (
              <div className="px-4 md:px-5 pb-4 md:pb-5 text-gray-600 text-xs md:text-sm leading-relaxed animate-[slideDown_0.3s_ease]">
                <table className="w-full border-collapse">
                  <tbody>
                    {product.form && (
                      <tr className="border-b border-gray-200 last:border-b-0">
                        <td className="py-3 text-gray-500 w-36 font-medium">Form</td>
                        <td className="py-3 text-gray-900 font-semibold">{product.form}</td>
                      </tr>
                    )}
                    {product.strength && (
                      <tr className="border-b border-gray-200 last:border-b-0">
                        <td className="py-3 text-gray-500 w-36 font-medium">Strength</td>
                        <td className="py-3 text-gray-900 font-semibold">{product.strength}</td>
                      </tr>
                    )}
                    {product.manufacturer && (
                      <tr className="border-b border-gray-200 last:border-b-0">
                        <td className="py-3 text-gray-500 w-36 font-medium">Manufacturer</td>
                        <td className="py-3 text-gray-900 font-semibold">{product.manufacturer}</td>
                      </tr>
                    )}
                    {product.pack_size && (
                      <tr className="border-b border-gray-200 last:border-b-0">
                        <td className="py-3 text-gray-500 w-36 font-medium">Pack Size</td>
                        <td className="py-3 text-gray-900 font-semibold">{product.pack_size}</td>
                      </tr>
                    )}
                    {product.storage_instructions && (
                      <tr className="border-b border-gray-200 last:border-b-0">
                        <td className="py-3 text-gray-500 w-36 font-medium">Storage</td>
                        <td className="py-3 text-gray-900 font-semibold">{product.storage_instructions}</td>
                      </tr>
                    )}
                    {product.batch_number && (
                      <tr className="border-b border-gray-200 last:border-b-0">
                        <td className="py-3 text-gray-500 w-36 font-medium">Batch Number</td>
                        <td className="py-3 text-gray-900 font-semibold">{product.batch_number}</td>
                      </tr>
                    )}
                    {product.expiry_date && (
                      <tr className="border-b border-gray-200 last:border-b-0">
                        <td className="py-3 text-gray-500 w-36 font-medium">Expiry Date</td>
                        <td className="py-3 text-gray-900 font-semibold">{new Date(product.expiry_date).toLocaleDateString()}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Similar Products */}
        {relatedProducts.length > 0 && (
          <div className="py-8 border-t border-gray-200 mt-6">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-5">Similar Products</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {relatedProducts.map((item) => (
                <div 
                  key={item.id}
                  className="bg-white border border-gray-200 rounded-xl p-3 cursor-pointer transition-all hover:border-green-500 hover:shadow-md hover:-translate-y-1 flex flex-col justify-between"
                  onClick={() => navigate(`/pharmacy/product/${item.id}`)}
                >
                  <div className="w-full aspect-square bg-gray-50 rounded-lg flex items-center justify-center mb-3 overflow-hidden">
                    {getMedicineImage(item) ? (
                      <img 
                        src={getMedicineImage(item)} 
                        alt={item.name}
                        className="w-full h-full object-contain p-3"
                      />
                    ) : (
                      <FaBox className="text-3xl text-gray-300" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <h4 className="text-xs md:text-sm font-medium text-gray-900 line-clamp-2 leading-tight h-8 md:h-10">{item.name}</h4>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-sm md:text-base font-bold text-gray-900">₹{item.price}</span>
                      {item.mrp && parseFloat(item.mrp) > parseFloat(item.price) && (
                        <span className="text-[10px] md:text-xs text-gray-500 line-through">₹{item.mrp}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reusable Pharmacy Footer */}
      <Footer />

    </div>
  );
};

export default PharmacyProductDetail;