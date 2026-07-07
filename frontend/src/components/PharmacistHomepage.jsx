import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaPills, FaSearch, FaPhone, FaClock,
  FaCheckCircle, FaShieldAlt,
  FaChevronRight, FaStethoscope,
  FaBoxOpen, FaSignOutAlt, FaHome,
  FaCog, FaTimes, FaBox, FaChartLine, FaBell,
  FaCalendar, FaWarehouse, FaDollarSign,
  FaArrowUp, FaArrowDown, FaFire, FaBolt,
  FaSyringe, FaFirstAid, FaBaby,
  FaFlask, FaVial, FaPrescriptionBottle, FaTrash, FaEdit, FaExclamationTriangle,
  FaMedkit
} from 'react-icons/fa';
import { authAPI, pharmacyAPI } from '../services/api';
import AddMedicineWithAI from './AddMedicineWithAI';
import Footer from "./Footer";
import './PharmacistHomepage.css';

const PharmacistHomepage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [loading, setLoading] = useState(false);


  const [dashboardData, setDashboardData] = useState(null);


  const activeTab = 'medicines';
  const [medicines, setMedicines] = useState([]);
  const [otherProducts, setOtherProducts] = useState([]);


  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);


  const [, setProductForm] = useState({
    name: '',
    generic_name: '',
    manufacturer: '',
    brand: '',
    category: 'antibiotics',
    form: 'tablet',
    strength: '',
    price: '',
    mrp: '',
    stock_quantity: '0',
    requires_prescription: false,
    description: '',
    pack_size: '',
    storage_instructions: 'room_temp',
    expiry_date: '',
    batch_number: '',
  });


  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [medicinesData, otherProductsData] = await Promise.all([
          pharmacyAPI.getMedicinesOnly(),
          pharmacyAPI.getOtherProductsOnly()
        ]);
        setMedicines(medicinesData || []);
        setOtherProducts(otherProductsData || []);


        const allProducts = [...(medicinesData || []), ...(otherProductsData || [])];
        const alerts = [];
        allProducts.forEach((p, idx) => {
          if (p.stock_quantity <= 50 && p.stock_quantity > 0) {
            alerts.push({
              id: `stock-${p.id || idx}`,
              message: `Low stock: ${p.name} (${p.stock_quantity} left)`,
              type: 'warning',
              time: 'Just now'
            });
          } else if (p.stock_quantity === 0) {
            alerts.push({
              id: `stock-out-${p.id || idx}`,
              message: `Out of stock: ${p.name}`,
              type: 'error',
              time: 'Just now'
            });
          }

          if (p.expiry_date) {
            const expDate = new Date(p.expiry_date);
            const today = new Date();
            const diffTime = expDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays <= 0) {
              alerts.push({
                id: `exp-expired-${p.id || idx}`,
                message: `Expired: ${p.name}`,
                type: 'error',
                time: 'Immediate'
              });
            } else if (diffDays <= 90) {
              alerts.push({
                id: `exp-soon-${p.id || idx}`,
                message: `Expiring soon: ${p.name} (${diffDays} days)`,
                type: 'warning',
                time: 'Immediate'
              });
            }
          }
        });
        setNotifications(alerts.slice(0, 15));

      } catch (error) {
        console.error('[PharmacistHomepage] Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const checkUser = () => {
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          setIsLoadingUser(false);
          return true;
        } catch (error) {
          console.error('[PharmacistHomepage] Error parsing user:', error);
          return false;
        }
      }
      return false;
    };

    if (checkUser()) return;

    const timer1 = setTimeout(() => {
      if (checkUser()) return;
    }, 100);

    const timer2 = setTimeout(() => {
      checkUser();
    }, 200);

    const handleStorageChange = () => {
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          setIsLoadingUser(false);
        } catch (error) {
          console.error('[PharmacistHomepage] Error parsing user on storage change:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (isLoadingUser) return;

    if (!user) {
      navigate('/auth?type=pharmacist&view=login');
      return;
    }

    if (user.user_type !== 'pharmacist') {
      alert('Access Denied: This page is only accessible to pharmacists.');
      if (user.user_type === 'patient') {
        navigate('/');
      } else if (user.user_type === 'doctor') {
        navigate('/doctor-dashboard');
      } else {
        navigate('/');
      }
    } else {
      loadDashboard(user.id);
    }
  }, [user, isLoadingUser, navigate]);

  const loadDashboard = async (pharmacistId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/pharmacy/dashboard/?pharmacist_id=${pharmacistId}`);
      const data = await response.json();
      if (data.success) {
        setDashboardData(data.dashboard);
      }
    } catch (error) {
      console.error('[PharmacistHomepage] Error loading dashboard:', error);
    }
  };

  const medicineCategories = [
    {
      icon: <FaPills />,
      name: 'Prescription Medicines',
      path: '/pharmacy/medicines?type=prescription',
      gradient: 'linear-gradient(135deg, #15803d, #15803d)',
      items: ['Antibiotics', 'Painkillers', 'Anti-inflammatory']
    },
    {
      icon: <FaPrescriptionBottle />,
      name: 'OTC Medicines',
      path: '/pharmacy/medicines?type=otc',
      gradient: 'linear-gradient(135deg, #2563eb, #3b82f6)',
      items: ['Cough Syrup', 'Antacids', 'Pain Relief']
    },
    {
      icon: <FaFlask />,
      name: 'Ayurvedic',
      path: '/pharmacy/medicines?type=ayurvedic',
      gradient: 'linear-gradient(135deg, #15803d, #15803d)',
      items: ['Herbal Medicines', 'Natural Supplements']
    },
    {
      icon: <FaVial />,
      name: 'Homeopathic',
      path: '/pharmacy/medicines?type=homeopathy',
      gradient: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
      items: ['Dilutions', 'Tablets', 'Ointments']
    },
  ];

  const otherCategories = [
    {
      icon: <FaStethoscope />,
      name: 'Medical Devices',
      path: '/pharmacy/devices',
      gradient: 'linear-gradient(135deg, #d97706, #fbbf24)',
      items: ['BP Monitors', 'Glucometers', 'Thermometers']
    },
    {
      icon: <FaFirstAid />,
      name: 'First Aid',
      path: '/pharmacy/first-aid',
      gradient: 'linear-gradient(135deg, #dc2626, #f87171)',
      items: ['Bandages', 'Antiseptics', 'First Aid Kits']
    },
    {
      icon: <FaSyringe />,
      name: 'Surgical Items',
      path: '/pharmacy/surgical',
      gradient: 'linear-gradient(135deg, #db2777, #f472b6)',
      items: ['Syringes', 'Gloves', 'Surgical Masks']
    },
    {
      icon: <FaBaby />,
      name: 'Baby Care',
      path: '/pharmacy/baby-care',
      gradient: 'linear-gradient(135deg, #0891b2, #22d3ee)',
      items: ['Diapers', 'Baby Food', 'Baby Wipes']
    },
  ];

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/pharmacy/search?q=${encodeURIComponent(searchQuery)}&tab=${activeTab}`);
    }
  };

  const handleLogout = () => {
    authAPI.logout();
    setUser(null);
    navigate('/');
  };

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

  const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-5 right-5 z-[5000] px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-black uppercase tracking-wider transition-all duration-300 transform translate-y-0 ${
      type === 'success'
        ? 'bg-emerald-500 text-white shadow-emerald-500/10'
        : type === 'error'
          ? 'bg-rose-500 text-white shadow-rose-500/10'
          : 'bg-slate-800 text-white'
    }`;
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  };

  const handleAddProduct = (type = 'medicines') => {
    setEditingProduct(null);
    const defaultCategory = type === 'medicines' ? 'antibiotics' : 'thermometers';

    setProductForm({
      name: '',
      generic_name: '',
      manufacturer: '',
      brand: '',
      category: defaultCategory,
      form: 'tablet',
      strength: '',
      price: '',
      mrp: '',
      stock_quantity: '0',
      requires_prescription: false,
      description: '',
      pack_size: '',
      storage_instructions: 'room_temp',
      expiry_date: '',
      batch_number: '',
    });
    setShowProductModal(true);
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      generic_name: product.generic_name || '',
      manufacturer: product.manufacturer || '',
      brand: product.brand || '',
      category: product.category,
      form: product.form || '',
      strength: product.strength || '',
      price: product.price,
      mrp: product.mrp || product.price,
      stock_quantity: product.stock_quantity,
      requires_prescription: product.requires_prescription || false,
      description: product.description || '',
      pack_size: product.pack_size || '',
      storage_instructions: product.storage_instructions || '',
      expiry_date: product.expiry_date || '',
      batch_number: product.batch_number || '',
    });
    setShowProductModal(true);
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm('⚠️ Are you sure you want to delete this product?')) {
      try {
        await pharmacyAPI.deleteMedicine(productId);
        showToast('✅ Product deleted successfully!', 'success');

        const allProducts = await pharmacyAPI.getAllMedicines();
        const medicineCategoriesList = [
          'medicines', 'prescription_drugs', 'otc_medicines',
          'antibiotics', 'painkillers', 'vitamins', 'ayurvedic', 'homeopathy'
        ];

        setMedicines(allProducts.filter(p => medicineCategoriesList.includes(p.category?.toLowerCase())));
        setOtherProducts(allProducts.filter(p => !medicineCategoriesList.includes(p.category?.toLowerCase())));

        if (user) {
          loadDashboard(user.id);
        }
      } catch (error) {
        console.error('Error deleting product:', error);
        showToast('❌ Error deleting product', 'error');
      }
    }
  };

  const renderDashboardStats = () => {
    if (!dashboardData) return null;

    const lowStockCount = [...medicines, ...otherProducts].filter(p => p.stock_quantity > 0 && p.stock_quantity <= 50).length;

    const stats = [
      {
        icon: <FaBoxOpen />,
        value: dashboardData.inventory.total_products,
        label: 'Total Products',
        subtext: 'All categories',
        trend: '+12%',
        trendUp: true,
        color: '#16a34a',
      },
      {
        icon: <FaExclamationTriangle />,
        value: lowStockCount,
        label: 'Low Stock Items',
        subtext: 'Needs restocking',
        trend: '-8%',
        trendUp: false,
        color: '#f59e0b',
      },
      {
        icon: <FaCalendar />,
        value: dashboardData.inventory.expiring_soon_count,
        label: 'Expiring Soon',
        subtext: 'Within 90 days',
        trend: '+5%',
        trendUp: false,
        color: '#dc2626',
      },
      {
        icon: <FaDollarSign />,
        value: `₹${dashboardData.revenue.today.toFixed(2)}`,
        label: "Today's Revenue",
        subtext: `₹${dashboardData.revenue.week.toFixed(2)} this week`,
        trend: '+18%',
        trendUp: true,
        color: '#0070cd',
      }
    ];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
          >
            <div className="flex justify-between items-start mb-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                style={{ color: stat.color, backgroundColor: `${stat.color}15` }}
              >
                {stat.icon}
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                stat.trendUp
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/20'
              }`}>
                {stat.trendUp ? <FaArrowUp /> : <FaArrowDown />}
                <span>{stat.trend}</span>
              </span>
            </div>
            <div className="space-y-1 relative z-10">
              <h3 className="text-2xl font-black tracking-tight" style={{ color: stat.color }}>{stat.value}</h3>
              <p className="text-xs font-black text-slate-800 dark:text-slate-200">{stat.label}</p>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">{stat.subtext}</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1.5" style={{ backgroundColor: stat.color }} />
          </div>
        ))}
      </div>
    );
  };

  const renderProductModal = () => {
    if (!showProductModal) return null;

    const handleAISave = async (payload, imageFiles, onProgress) => {
      try {
        if (editingProduct) {
          if (imageFiles && imageFiles.length > 0) {
            await pharmacyAPI.updateMedicineWithImages(
              editingProduct.id,
              payload,
              imageFiles,
              onProgress
            );
          } else {
            await pharmacyAPI.updateMedicine(editingProduct.id, payload);
          }
          showToast(`✅ "${payload.name}" updated successfully!`, 'success');
        } else {
          if (imageFiles && imageFiles.length > 0) {
            await pharmacyAPI.createMedicineWithImages(
              payload,
              imageFiles,
              onProgress
            );
          } else {
            await pharmacyAPI.createMedicine(payload);
          }
          showToast(`✅ "${payload.name}" added successfully!`, 'success');
        }

        const allProducts = await pharmacyAPI.getAllMedicines();
        const medicineCats = [
          'medicines', 'prescription_drugs', 'otc_medicines',
          'antibiotics', 'painkillers', 'vitamins', 'ayurvedic', 'homeopathy'
        ];
        setMedicines(allProducts.filter(p => medicineCats.includes(p.category?.toLowerCase())));
        setOtherProducts(allProducts.filter(p => !medicineCats.includes(p.category?.toLowerCase())));

        if (user) loadDashboard(user.id);
        setShowProductModal(false);
        setEditingProduct(null);

      } catch (error) {
        console.error('[handleAISave] Error:', error);
        throw error;
      }
    };

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => { setShowProductModal(false); setEditingProduct(null); }}>
        <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800/80 overflow-hidden animate-modal-in" onClick={(e) => e.stopPropagation()}>
          <AddMedicineWithAI
            editingProduct={editingProduct}
            onSave={handleAISave}
            onCancel={() => { setShowProductModal(false); setEditingProduct(null); }}
          />
        </div>
      </div>
    );
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
          <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600 text-3xl">
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
          {product.expiry_date && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-800/85 backdrop-blur-sm text-slate-100 shadow-sm">
              <FaCalendar className="text-[8px]" /> Exp: {new Date(product.expiry_date).toLocaleDateString()}
            </span>
          )}
        </div>

        {user && user.user_type === 'pharmacist' && (
          <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleEditProduct(product)}
              className="w-8 h-8 rounded-full bg-white/95 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white text-slate-700 dark:text-slate-350 flex items-center justify-center text-xs shadow transition-all hover:scale-105 cursor-pointer border-none"
              title="Edit"
            >
              <FaEdit />
            </button>
            <button
              onClick={() => handleDeleteProduct(product.id)}
              className="w-8 h-8 rounded-full bg-white/95 dark:bg-slate-800 hover:bg-rose-500 hover:text-white text-slate-700 dark:text-slate-350 flex items-center justify-center text-xs shadow transition-all hover:scale-105 cursor-pointer border-none"
              title="Delete"
            >
              <FaTrash />
            </button>
          </div>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div className="space-y-1">
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">{product.category}</span>
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 leading-snug line-clamp-1">{product.name}</h3>
          {product.generic_name && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold italic line-clamp-1">{product.generic_name}</p>
          )}
          {product.manufacturer && (
            <p className="text-[10px] text-slate-450 dark:text-slate-400 font-semibold flex items-center gap-1">
              <FaBox className="text-[8px] text-emerald-500" /> {product.manufacturer}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50 dark:border-slate-700/60">
          <div className="flex flex-col">
            <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Price</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">₹{parseFloat(product.price).toFixed(2)}</span>
          </div>
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-50 dark:bg-slate-900/50 text-slate-650 dark:text-slate-450">
            <FaWarehouse className="text-[8px]" /> Stock: {product.stock_quantity}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen font-sans bg-slate-50/50 text-slate-800 transition-colors duration-300">
      {}
      <div className="bg-green-600 text-white py-2.5 text-xs font-bold shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><FaPhone className="text-[10px]" /> Emergency support: 108</span>
            <span className="flex items-center gap-1.5"><FaClock className="text-[10px]" /> 24/7 Pharmacy Service</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
            <FaMedkit /> Complete Medical Shop Solution
          </div>
        </div>
      </div>

      {}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-sm transition-colors">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => navigate('/pharmacy-home')}>
            <div className="w-12 h-12 rounded-2xl bg-green-600 flex items-center justify-center text-white text-xl shadow-md shadow-green-600/20 relative">
              <FaPills />
              <div className="absolute inset-0 bg-green-600 rounded-2xl blur-lg opacity-20 -z-10 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-green-600">
                PharmaCare
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Medical Shop Management</p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex-1 max-w-lg w-full relative flex items-center">
            <FaSearch className="absolute left-4 text-slate-400 text-sm" />
            <input
              type="text"
              placeholder="Search medicines, devices, supplies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-24 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all font-semibold placeholder:text-slate-400/80"
            />
            <button
              type="submit"
              className="absolute right-2 px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all border-none cursor-pointer"
            >
              Search
            </button>
          </form>

          <div className="flex items-center gap-3.5 self-end md:self-auto">
            {user && user.user_type === 'pharmacist' && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleAddProduct('medicines')}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm border-none cursor-pointer transition-all hover:-translate-y-0.5"
                >
                  <FaPills className="text-[10px]" /> <span>Add Medicine</span>
                </button>
                <button
                  onClick={() => handleAddProduct('other')}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm border-none cursor-pointer transition-all hover:-translate-y-0.5"
                >
                  <FaStethoscope className="text-[10px]" /> <span>Add Product</span>
                </button>
              </div>
            )}

            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-colors flex items-center justify-center text-sm border-none cursor-pointer relative"
              >
                <FaBell />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white">
                    {notifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-modal-in">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Notifications</h3>
                    <button
                      onClick={() => setNotifications([])}
                      className="text-[10px] font-black text-emerald-600 hover:underline border-none bg-transparent cursor-pointer"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 nms-stores-scrollbar">
                    {notifications.length > 0 ? (
                      notifications.map(notif => (
                        <div key={notif.id} className="p-4 flex gap-3 hover:bg-slate-50/50 transition-colors">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                            notif.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                            notif.type === 'error' ? 'bg-rose-50 text-rose-605' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {notif.type === 'success' ? <FaCheckCircle /> : notif.type === 'error' ? <FaTimes /> : <FaExclamationTriangle />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-700 leading-normal">{notif.message}</p>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1 block">{notif.time}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-xs font-semibold text-slate-400">
                        No active notifications
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {user ? (
              <div
                className="relative"
                onMouseEnter={() => setShowProfileDropdown(true)}
                onMouseLeave={() => setShowProfileDropdown(false)}
              >
                <div className="w-10 h-10 rounded-full bg-green-600 text-white font-black flex items-center justify-center cursor-pointer shadow-sm hover:scale-105 transition-all select-none">
                  {user.first_name.charAt(0)}
                </div>

                {showProfileDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-modal-in">
                    <div className="p-4 bg-slate-50 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-green-600 text-white font-black flex items-center justify-center text-lg select-none">
                        {user.first_name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-slate-800 truncate">{user.first_name} {user.last_name}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Pharmacist</p>
                      </div>
                    </div>
                    <div className="h-px bg-slate-100" />
                    <div className="p-2 space-y-1">
                      <button
                        onClick={() => navigate('/pharmacist-dashboard')}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-600 hover:text-emerald-600 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
                      >
                        <FaHome className="text-slate-400" /> Dashboard
                      </button>
                      <button
                        onClick={() => navigate('/pharmacy/inventory')}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-600 hover:text-emerald-600 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
                      >
                        <FaWarehouse className="text-slate-400" /> Inventory
                      </button>
                      <button
                        onClick={() => navigate('/pharmacy-home')}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-600 hover:text-emerald-600 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
                      >
                        <FaCog className="text-slate-400" /> Settings
                      </button>
                    </div>
                    <div className="h-px bg-slate-100 dark:bg-slate-700" />
                    <div className="p-2">
                      <button
                        className="w-full text-left px-3 py-2 bg-rose-50 hover:bg-rose-100/70 text-rose-605 rounded-lg text-xs font-black flex items-center gap-2 border-none cursor-pointer transition-colors"
                        onClick={handleLogout}
                      >
                        <FaSignOutAlt /> Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all border-none cursor-pointer"
                onClick={() => navigate('/auth?type=pharmacist&view=login')}
              >
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      {}
      {user && user.user_type === 'pharmacist' && dashboardData && (
        <section className="py-10 bg-slate-100/50 dark:bg-slate-900/40 transition-colors">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Dashboard Overview</h2>
                <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 font-bold mt-0.5">Track your medical shop performance metrics</p>
              </div>
              <button
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm border-none cursor-pointer transition-all hover:-translate-y-0.5"
                onClick={() => navigate('/pharmacist-dashboard')}
              >
                <FaChartLine className="text-[10px]" /> <span>Full Dashboard</span>
              </button>
            </div>
            {renderDashboardStats()}
          </div>
        </section>
      )}

      {}
      <section className="bg-gradient-to-b from-green-50/10 via-white to-white dark:from-slate-900/20 dark:via-slate-950 dark:to-slate-950 py-16 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 space-y-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-500 text-white rounded-full text-[10px] font-black uppercase tracking-wider animate-bounce">
              <FaFire /> Complete Medical Shop Solution
            </span>
            <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              Manage Your <br />
              <span className="text-green-600 dark:text-green-400">
                Medical Shop Inventory
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-400 dark:text-slate-500 font-medium leading-relaxed max-w-xl">
              Comprehensive inventory management for medicines, medical devices, surgical items, and all healthcare products. Keep track of stock levels, expirations, and sales in real-time.
            </p>

            <div className="flex gap-4 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs font-black text-green-600 dark:text-green-400 uppercase tracking-wider">
                <FaCheckCircle className="text-[10px]" />
                <span>{medicines.length} Medicines</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-black text-green-600 dark:text-green-400 uppercase tracking-wider">
                <FaCheckCircle className="text-[10px]" />
                <span>{otherProducts.length} Other Products</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-black text-green-600 dark:text-green-400 uppercase tracking-wider">
                <FaShieldAlt className="text-[10px]" />
                <span>Batch Tracking</span>
              </span>
            </div>

            <div className="flex gap-3">
              <button
                className="px-6 py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-green-500/10 active:scale-[0.98] transition-all border-none cursor-pointer"
                onClick={() => handleAddProduct('medicines')}
              >
                <FaPills className="text-[10px]" /> Add Medicine
              </button>
              <button
                className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all border-none cursor-pointer"
                onClick={() => handleAddProduct('other')}
              >
                <FaStethoscope className="text-[10px]" /> Add Product
              </button>
            </div>
          </div>

          <div className="flex-1 w-full flex items-center justify-center">
            <div className="relative w-72 h-72 sm:w-80 sm:h-80 bg-gradient-to-br from-emerald-100 to-teal-50 dark:from-emerald-950/20 dark:to-slate-800/20 rounded-full flex items-center justify-center">
              <div className="absolute -top-4 left-6 bg-white dark:bg-slate-850 px-4 py-3 rounded-2xl shadow-md border border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200 select-none hover:scale-105 transition-all">
                <FaPills className="text-emerald-500 text-base" />
                <span>Medicines</span>
              </div>
              <div className="absolute bottom-6 -left-6 bg-white dark:bg-slate-850 px-4 py-3 rounded-2xl shadow-md border border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200 select-none hover:scale-105 transition-all">
                <FaFirstAid className="text-rose-500 text-base" />
                <span>First Aid</span>
              </div>
              <div className="absolute right-0 top-1/3 bg-white dark:bg-slate-850 px-4 py-3 rounded-2xl shadow-md border border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200 select-none hover:scale-105 transition-all">
                <FaStethoscope className="text-blue-500 text-base" />
                <span>Devices</span>
              </div>
              <div className="w-48 h-48 rounded-full border border-emerald-500/10 dark:border-emerald-500/5 animate-ping absolute" />
              <FaWarehouse className="text-8xl text-emerald-500/40 dark:text-emerald-500/20" />
            </div>
          </div>
        </div>
      </section>

      {}
      <section className="py-12 bg-emerald-50/20 dark:bg-slate-900/20 transition-colors border-t border-slate-100 dark:border-slate-800/30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <FaPills className="text-emerald-600" />
              <span>Medicine Categories</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 font-bold mt-0.5">Browse all types of pharmaceutical products</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {medicineCategories.map((cat, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
                onClick={() => navigate(cat.path)}
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg" style={{ background: cat.gradient }}>
                  {cat.icon}
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 transition-colors">{cat.name}</h3>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {cat.items.map((item, i) => (
                      <span key={i} className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 px-2 py-0.5 rounded-full font-bold">{item}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {}
      <section className="py-12 bg-white dark:bg-slate-950 transition-colors border-t border-slate-100 dark:border-slate-800/30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <FaStethoscope className="text-blue-500" />
              <span>Medical Products & Supplies</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 font-bold mt-0.5">Devices, surgical items, and healthcare essentials</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {otherCategories.map((cat, idx) => (
              <div
                key={idx}
                className="bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-850 rounded-3xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
                onClick={() => navigate(cat.path)}
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg" style={{ background: cat.gradient }}>
                  {cat.icon}
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-205 group-hover:text-emerald-600 transition-colors">{cat.name}</h3>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {cat.items.map((item, i) => (
                      <span key={i} className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold">{item}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading shop catalogue...</p>
        </div>
      ) : (
        <>
          {}
          {medicines.length > 0 && (
            <section className="py-12 bg-emerald-50/20 dark:bg-slate-900/20 transition-colors border-t border-slate-100 dark:border-slate-800/30">
              <div className="max-w-7xl mx-auto px-4">
                <div className="flex items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                      <FaPills className="text-emerald-600" />
                      <span>Medicines ({medicines.length})</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 font-bold mt-0.5">Pharmaceutical products and medications</p>
                  </div>
                  <a href="/pharmacy/medicines" className="inline-flex items-center gap-1 text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider hover:underline transition-all">
                    <span>View All Medicines</span> <FaChevronRight className="text-[10px]" />
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {medicines.slice(0, 8).map(renderProductCard)}
                </div>
              </div>
            </section>
          )}

          {}
          {otherProducts.length > 0 && (
            <section className="py-12 bg-white dark:bg-slate-950 transition-colors border-t border-slate-105 dark:border-slate-800/30">
              <div className="max-w-7xl mx-auto px-4">
                <div className="flex items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                      <FaStethoscope className="text-blue-500" />
                      <span>Medical Products & Supplies ({otherProducts.length})</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 font-bold mt-0.5">Devices, surgical items, and healthcare essentials</p>
                  </div>
                  <a href="/pharmacy/products" className="inline-flex items-center gap-1 text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider hover:underline transition-all">
                    <span>View All Products</span> <FaChevronRight className="text-[10px]" />
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {otherProducts.slice(0, 8).map(renderProductCard)}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      <Footer />

      {}
      {renderProductModal()}
    </div>
  );
};

export default PharmacistHomepage;