import { useState, useRef, useCallback } from 'react';
import {
  FaRobot, FaEdit, FaUpload, FaImage, FaTimes, FaChevronLeft,
  FaChevronRight, FaTrash, FaPlus, FaSpinner, FaCheckCircle,
  FaExclamationTriangle, FaMagic, FaPills, FaBox, FaTag,
  FaDollarSign, FaWarehouse, FaCalendar, FaClipboardList,
  FaStethoscope, FaThermometerHalf, FaCamera, FaFileAlt,
  FaChartBar, FaSave, FaBolt
} from 'react-icons/fa';
import './AddMedicineWithAI.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
const MEDIA_BASE_URL = process.env.REACT_APP_MEDIA_URL || 'http://localhost:8000';
const resolveImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  return `${MEDIA_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};


const useMedicineImageAI = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);

  const analyzeImage = useCallback(async (imageFile, onFieldsExtracted) => {
    if (!imageFile) return;
    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const token =
        localStorage.getItem('accessToken') ||
        sessionStorage.getItem('accessToken');

      const response = await fetch(`${API_BASE}/medicines/analyze-image/`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to analyze image');

      if (result.success && result.data) {
        setAnalysisResult(result);
        if (onFieldsExtracted) onFieldsExtracted(result.data);
      } else {
        setError(result.error || 'Could not extract data from image');
      }
    } catch (err) {
      setError(err.message || 'Failed to analyze image');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setAnalysisResult(null);
    setError(null);
    setIsAnalyzing(false);
  }, []);

  return { isAnalyzing, analysisResult, error, analyzeImage, reset };
};


const MEDICINE_CATEGORIES = [
  'medicines', 'prescription_drugs', 'otc_medicines',
  'antibiotics', 'painkillers', 'vitamins', 'ayurvedic', 'homeopathy',
];

const normalizeMedicineForm = (formStr, category) => {
  if (!formStr) return '';
  const s = formStr.toLowerCase().trim();

  const isMedCategory = MEDICINE_CATEGORIES.includes(category?.toLowerCase());
  if (!isMedCategory) return '';

  if (s.includes('tablet')) return 'tablet';
  if (s.includes('capsule')) return 'capsule';
  if (s.includes('syrup') || s.includes('suspension')) return 'syrup';
  if (s.includes('injection') || s.includes('vial') || s.includes('ampoule')) return 'injection';
  if (s.includes('cream')) return 'cream';
  if (s.includes('ointment')) return 'ointment';
  if (s.includes('drop')) return 'drops';
  if (s.includes('powder') || s.includes('granules') || s.includes('sachet')) return 'powder';
  if (s.includes('spray')) return 'spray';
  if (s.includes('inhaler')) return 'inhaler';
  if (s.includes('patch')) return 'patch';
  if (s.includes('gel')) return 'gel';
  if (s.includes('lotion')) return 'lotion';
  return '';
};

const ALL_CATEGORIES = [
  { group: '💊 Medicines', options: [
    { value: 'medicines', label: 'General Medicines' },
    { value: 'prescription_drugs', label: 'Prescription Drugs' },
    { value: 'otc_medicines', label: 'OTC Medicines' },
    { value: 'antibiotics', label: 'Antibiotics' },
    { value: 'painkillers', label: 'Painkillers' },
    { value: 'vitamins', label: 'Vitamins & Supplements' },
    { value: 'ayurvedic', label: 'Ayurvedic' },
    { value: 'homeopathy', label: 'Homeopathic' },
  ]},
  { group: '🩺 Medical Devices', options: [
    { value: 'thermometers', label: 'Thermometers' },
    { value: 'bp_monitors', label: 'BP Monitors' },
    { value: 'glucometers', label: 'Glucometers' },
    { value: 'pulse_oximeters', label: 'Pulse Oximeters' },
    { value: 'nebulizers', label: 'Nebulizers' },
  ]},
  { group: '🩹 First Aid & Surgical', options: [
    { value: 'bandages', label: 'Bandages & Dressings' },
    { value: 'antiseptics', label: 'Antiseptics' },
    { value: 'first_aid_kits', label: 'First Aid Kits' },
    { value: 'syringes', label: 'Syringes & Needles' },
    { value: 'gloves', label: 'Medical Gloves' },
  ]},
  { group: '👶 Baby Care', options: [
    { value: 'diapers', label: 'Diapers' },
    { value: 'baby_food', label: 'Baby Food & Formula' },
    { value: 'baby_wipes', label: 'Baby Wipes' },
  ]},
  { group: '🧴 Personal Care', options: [
    { value: 'sanitizers', label: 'Sanitizers & Disinfectants' },
    { value: 'masks', label: 'Face Masks' },
    { value: 'cotton', label: 'Cotton & Cotton Buds' },
  ]},
  { group: '📦 Other', options: [
    { value: 'diabetic_supplies', label: 'Diabetic Care' },
    { value: 'other', label: 'Other' },
  ]},
];

const EMPTY_FORM = {
  name: '', generic_name: '', manufacturer: '', brand: '',
  category: '', form: '', strength: '', price: '', mrp: '',
  stock_quantity: '0', requires_prescription: false,
  description: '', pack_size: '', storage_instructions: 'room_temp',
  expiry_date: '', batch_number: '',
  composition: '', side_effects: '', contraindications: '',
};

const MAX_IMAGES = 10;


const AddMedicineWithAI = ({ onSave, onCancel, editingProduct = null }) => {
  const fileInputRef = useRef(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [aiUrlInput, setAiUrlInput] = useState('');
  const [mode, setMode] = useState('ai');

  const [form, setForm] = useState(() =>
    editingProduct
      ? {
          name: editingProduct.name || '',
          generic_name: editingProduct.generic_name || '',
          manufacturer: editingProduct.manufacturer || '',
          brand: editingProduct.brand || '',
          category: editingProduct.category || '',
          form: editingProduct.form || '',
          strength: editingProduct.strength || '',
          price: editingProduct.price || '',
          mrp: editingProduct.mrp || editingProduct.price || '',
          stock_quantity: editingProduct.stock_quantity || '0',
          requires_prescription: editingProduct.requires_prescription || false,
          description: editingProduct.description || '',
          pack_size: editingProduct.pack_size || '',
          storage_instructions: editingProduct.storage_instructions || 'room_temp',
          expiry_date: editingProduct.expiry_date || '',
          batch_number: editingProduct.batch_number || '',
          composition: editingProduct.composition || '',
          side_effects: editingProduct.side_effects || '',
          contraindications: editingProduct.contraindications || '',
        }
      : { ...EMPTY_FORM }
  );

  const [aiFilledFields, setAiFilledFields] = useState(new Set());
  const [images, setImages] = useState(() => {
    if (editingProduct) {
      const existing = [];
      if (editingProduct.images && editingProduct.images.length > 0) {
        editingProduct.images.forEach(img => {
          existing.push({
            file: null,
            preview: img.image_url || img.image,
            isExisting: true,
            isUrl: !img.image,
            id: img.id
          });
        });
      } else if (editingProduct.image_url || editingProduct.image) {
        existing.push({
          file: null,
          preview: editingProduct.image_url || editingProduct.image,
          isExisting: true,
          isUrl: !editingProduct.image
        });
      }
      return existing;
    }
    return [];
  });
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const { isAnalyzing, analysisResult, error: aiError, analyzeImage, reset: resetAI } = useMedicineImageAI();

  const isMedicine = MEDICINE_CATEGORIES.includes(form.category?.toLowerCase());

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const setField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };


  const handleLocalFileSelect = (e) => {
    const files = Array.from(e.target.files);
    addLocalFiles(files);
  };

  const addLocalFiles = (files) => {
    if (images.length + files.length > MAX_IMAGES) {
      showToast(`Maximum ${MAX_IMAGES} images allowed`, 'error');
      return;
    }

    const newImages = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      isExisting: false,
      isUrl: false
    }));

    setImages(prev => [...prev, ...newImages]);
    showToast(`Added ${files.length} image(s)`, 'success');
  };


  const handleAIUrlAnalyze = async () => {
    const url = aiUrlInput.trim();
    if (!url || !/^https?:\/\//.test(url)) {
      showToast('Please enter a valid image URL starting with http:// or https://', 'error');
      return;
    }


    if (images.length < MAX_IMAGES) {
      setImages(prev => [...prev, { file: null, preview: url, isExisting: false, isUrl: true }]);
    }

    try {

      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], 'ai-image.jpg', { type: blob.type || 'image/jpeg' });
      await handleAIImageSelect(file);
    } catch {
      showToast('Could not fetch the image from that URL. Please try another link.', 'error');
    }
  };

  const handleAIImageSelect = async (file) => {
    if (!file) return;
    await analyzeImage(file, (data) => {
      const mapping = {
        name: data.name,
        generic_name: data.generic_name,
        manufacturer: data.manufacturer,
        brand: data.brand,
        category: data.category,
        form: normalizeMedicineForm(data.form, data.category),
        strength: data.strength,
        price: data.price?.toString(),
        mrp: data.mrp?.toString(),
        description: data.description,
        pack_size: data.pack_size,
        composition: data.composition,
        side_effects: data.side_effects,
        contraindications: data.contraindications,
        requires_prescription: data.requires_prescription,
      };
      const filled = new Set();
      const updates = {};
      Object.entries(mapping).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          updates[key] = val;
          filled.add(key);
        }
      });
      setForm(prev => ({ ...prev, ...updates }));
      setAiFilledFields(filled);
      showToast(`✨ AI filled ${filled.size} fields automatically!`, 'success');
    });
  };

  const addImageUrl = (url) => {
    if (!url || !/^https?:\/\//.test(url)) {
      showToast('Please enter a valid image URL starting with http://', 'error');
      return;
    }
    if (images.length >= MAX_IMAGES) {
      showToast(`Maximum ${MAX_IMAGES} images allowed`, 'error');
      return;
    }
    setImages(prev => [...prev, { file: null, preview: url, isExisting: false, isUrl: true }]);
    setImageUrlInput('');
    showToast('Image URL added!', 'success');
  };

  const removeImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setCurrentIdx(prev => Math.min(prev, Math.max(0, images.length - 2)));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);


    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
      if (files.length > 0) {
        addLocalFiles(files);

        if (mode === 'ai' && !isAnalyzing && !analysisResult) {
          handleAIImageSelect(files[0]);
        }
      } else {
        showToast('Please drop image files', 'error');
      }
    } else {

      const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      if (url && /^https?:\/\//.test(url)) {
        addImageUrl(url);
      } else {
        showToast('Drop image files or URLs here', 'info');
      }
    }
  };


  const handleSave = async () => {
    if (!form.name?.trim()) return showToast('Product name is required', 'error');
    if (!form.category) return showToast('Category is required', 'error');
    if (isMedicine && !form.form) return showToast('Medicine form is required', 'error');

    const price = parseFloat(form.price);
    const mrp = parseFloat(form.mrp || form.price);
    const stock = parseInt(form.stock_quantity || 0);

    if (isNaN(price) || price <= 0) return showToast('Valid selling price is required', 'error');
    if (isNaN(mrp) || mrp <= 0) return showToast('Valid MRP is required', 'error');
    if (price > mrp) return showToast('Selling price cannot exceed MRP', 'error');
    if (isNaN(stock) || stock < 0) return showToast('Valid stock quantity is required', 'error');

    setIsSaving(true);
    setUploadProgress(10);

    try {
      const payload = {
        ...form,
        price: price.toFixed(2),
        mrp: mrp.toFixed(2),
        stock_quantity: stock.toString(),
        requires_prescription: Boolean(form.requires_prescription),
      };

      const newFiles = images.filter(img => !img.isExisting && !img.isUrl).map(img => img.file);
      const imageUrls = images.filter(img => img.isUrl).map(img => img.preview);
      if (imageUrls.length > 0) payload.image_urls = imageUrls;

      const interval = setInterval(() => {
        setUploadProgress(p => p < 85 ? p + 10 : p);
      }, 150);

      if (onSave) {
        await onSave(payload, newFiles, (p) => setUploadProgress(p));
      }

      clearInterval(interval);
      setUploadProgress(100);
      showToast(editingProduct ? 'Product updated successfully!' : 'Product added successfully!', 'success');


      setTimeout(() => {
        setIsSaving(false);
        setUploadProgress(0);
        if (!editingProduct) {
          setForm({ ...EMPTY_FORM });
          setImages([]);
          setAiFilledFields(new Set());
          resetAI();
        }
      }, 800);
    } catch (err) {
      setIsSaving(false);
      setUploadProgress(0);
      showToast(err.message || 'Failed to save product', 'error');
    }
  };

  const getFieldClassName = (isAI) => {
    return `w-full px-4 py-2.5 border rounded-xl text-sm transition-all duration-200 outline-none ${
      isAI
        ? 'border-emerald-400 bg-emerald-50/15 text-slate-800 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 pr-16 font-medium shadow-sm shadow-emerald-50/30'
        : 'border-slate-200 bg-white text-slate-900 focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500'
    }`;
  };


  return (
    <div className="flex flex-col h-full max-h-[90vh] md:max-h-[85vh] w-full max-w-4xl bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-100 relative">
      {}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[99999] flex items-center gap-2.5 px-5 py-3.5 rounded-2xl shadow-xl border text-sm font-bold transition-all duration-300 animate-bounce ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          {toast.type === 'success' ? (
            <FaCheckCircle className="text-emerald-500 text-lg flex-shrink-0" />
          ) : toast.type === 'error' ? (
            <FaExclamationTriangle className="text-rose-500 text-lg flex-shrink-0" />
          ) : (
            <FaBolt className="text-blue-500 text-lg flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50/40 via-teal-50/10 to-transparent sticky top-0 z-20">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <FaPills className="text-xl animate-float-y" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">{editingProduct ? 'Edit Product Catalog' : 'Add New Product'}</h2>
            <p className="text-xs text-slate-400 font-medium">Configure categories, details, and price catalog</p>
          </div>
        </div>

        {}
        <div className="flex p-1 bg-slate-100 rounded-xl gap-1 w-full sm:w-auto shadow-inner">
          <button
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
              mode === 'ai'
                ? 'bg-white text-emerald-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => setMode('ai')}
          >
            <FaRobot className="text-sm" /> AI Auto-Fill
          </button>
          <button
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
              mode === 'manual'
                ? 'bg-white text-emerald-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => setMode('manual')}
          >
            <FaEdit className="text-sm" /> Manual entry
          </button>
        </div>
      </div>

      {}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 ami-form-scrollbar">
        {}
        {mode === 'ai' && (
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-transparent border border-emerald-500/10 rounded-2xl p-5 animate-ai-glow">
            {}
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <FaMagic className="text-sm animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">AI Product Data Extraction</h3>
                <p className="text-xs text-slate-400 font-medium">Extract product attributes automatically from labels/images</p>
              </div>
            </div>

            {}
            <div className="flex flex-col sm:flex-row gap-2.5 items-center w-full relative">
              <input
                type="url"
                value={aiUrlInput}
                onChange={e => setAiUrlInput(e.target.value)}
                placeholder="Paste medicine image URL (https://...)"
                className="w-full sm:flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 text-sm outline-none transition-all shadow-inner"
                onKeyDown={e => e.key === 'Enter' && handleAIUrlAnalyze()}
              />
              <button
                onClick={handleAIUrlAnalyze}
                disabled={isAnalyzing || !aiUrlInput.trim()}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-slate-200 disabled:to-slate-200 text-white disabled:text-slate-400 rounded-xl text-xs font-black shadow-md shadow-emerald-600/10 disabled:shadow-none transition-all active:scale-[0.98]"
              >
                {isAnalyzing ? <FaSpinner className="animate-spin text-sm" /> : <FaMagic />}
                <span>{isAnalyzing ? 'Analyzing...' : 'Auto-Fill'}</span>
              </button>
            </div>

            {}
            {isAnalyzing && (
              <div className="absolute inset-0 bg-white/95 z-10 flex flex-col items-center justify-center gap-3">
                <div className="scan-indicator" />
                <div className="w-10 h-10 border-3 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-800">Processing label data...</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Downloading and reading text fields using Vision AI</p>
                </div>
              </div>
            )}

            {}
            {analysisResult && (
              <div className="mt-4 p-4 bg-emerald-50/30 border border-emerald-100/50 rounded-xl flex flex-col items-center text-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
                  <FaCheckCircle className="text-base" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 uppercase tracking-wide">Analysis Complete!</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{aiFilledFields.size} fields have been populated automatically.</p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center max-w-lg mt-1">
                  {Array.from(aiFilledFields).map(f => (
                    <span key={f} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100/60 border border-emerald-200/50 text-emerald-700 rounded-full text-[10px] font-extrabold uppercase tracking-wide">
                      <FaMagic className="text-[8px]" /> {f.replace('_', ' ')}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => { resetAI(); setAiFilledFields(new Set()); setAiUrlInput(''); }}
                  className="mt-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-white border border-emerald-200 px-3.5 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors shadow-sm"
                >
                  Clear & Scan New Image
                </button>
              </div>
            )}

            {}
            {aiError && (
              <div className="mt-3 flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-bold">
                <FaExclamationTriangle className="text-base flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold uppercase tracking-wide">Analysis Failed</p>
                  <p className="text-rose-500 font-medium mt-0.5">{aiError}</p>
                </div>
              </div>
            )}

            {}
            {!analysisResult && !aiError && !isAnalyzing && (
              <p className="mt-3 text-[10px] font-medium text-slate-400 flex items-center gap-1.5 justify-center sm:justify-start">
                <FaBolt className="text-emerald-500" />
                <span>Tip: Drag & drop image files directly onto the preview area to run AI analysis!</span>
              </p>
            )}
          </div>
        )}

        {}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <FaCamera className="text-teal-600" /> Image Gallery
                </span>
                <span className="bg-slate-200/80 px-2 py-0.5 rounded-full text-[10px] font-black">{images.length} / {MAX_IMAGES}</span>
              </div>

              {images.length > 0 ? (
                <div className="space-y-3">
                  {}
                  <div
                    className={`relative aspect-square w-full rounded-xl overflow-hidden bg-white border border-slate-200 transition-all ${
                      isDragging ? 'border-emerald-500 bg-emerald-50/15' : ''
                    } group`}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                  >
                    <img
                      src={resolveImageUrl(images[currentIdx]?.preview)}
                      alt="Product item"
                      className="w-full h-full object-contain"
                      onError={e => {
                        e.target.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><rect width=%22200%22 height=%22200%22 fill=%22%23f8fafc%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23cbd5e1%22 font-size=%2214%22 dy=%22.3em%22>No Preview Available</text></svg>';
                      }}
                    />

                    {}
                    {images.length > 1 && (
                      <>
                        <button
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-800 flex items-center justify-center shadow-md border border-slate-100 text-xs transition-transform active:scale-90"
                          onClick={() => setCurrentIdx(i => (i - 1 + images.length) % images.length)}
                        >
                          <FaChevronLeft />
                        </button>
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-800 flex items-center justify-center shadow-md border border-slate-100 text-xs transition-transform active:scale-90"
                          onClick={() => setCurrentIdx(i => (i + 1) % images.length)}
                        >
                          <FaChevronRight />
                        </button>
                      </>
                    )}

                    {}
                    <span className="absolute bottom-2 left-1/2 -translate-y-0 -translate-x-1/2 px-2.5 py-1 bg-black/60 text-white rounded-full text-[10px] font-black tracking-wide">
                      {currentIdx + 1} / {images.length}
                    </span>

                    {}
                    <button
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-md border border-rose-500/20 text-xs transition-all active:scale-95 opacity-0 group-hover:opacity-100"
                      onClick={() => removeImage(currentIdx)}
                    >
                      <FaTrash />
                    </button>
                  </div>

                  {}
                  <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
                    {images.map((img, idx) => (
                      <div
                        key={idx}
                        className={`relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                          idx === currentIdx ? 'border-emerald-500 scale-[1.03] shadow-sm' : 'border-slate-200 hover:border-slate-300'
                        }`}
                        onClick={() => setCurrentIdx(idx)}
                      >
                        <img
                          src={resolveImageUrl(img.preview)}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                        <button
                          className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[8px] border border-rose-500/20"
                          onClick={e => { e.stopPropagation(); removeImage(idx); }}
                        >
                          <FaTimes />
                        </button>
                      </div>
                    ))}

                    {images.length < MAX_IMAGES && (
                      <div
                        onClick={() => fileInputRef.current.click()}
                        className="w-12 h-12 flex-shrink-0 rounded-lg border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 flex flex-col items-center justify-center gap-0.5 cursor-pointer text-emerald-600 transition-colors"
                      >
                        <FaPlus className="text-xs" />
                        <span className="text-[7px] font-black uppercase">Add</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all bg-slate-100/50 hover:bg-slate-100 ${
                    isDragging ? 'border-emerald-500 bg-emerald-50/15' : 'border-slate-300'
                  }`}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current.click()}
                >
                  <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center mx-auto mb-2.5 text-xl">
                    <FaImage />
                  </div>
                  <p className="text-xs font-bold text-slate-700">Drop files or click here</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Supports image files & drag-and-drop</p>
                </div>
              )}

              {}
              <div className="space-y-2 pt-1 border-t border-slate-200/50">
                {images.length < MAX_IMAGES && (
                  <div className="flex gap-1.5 items-center w-full">
                    <input
                      type="url"
                      value={imageUrlInput}
                      onChange={e => setImageUrlInput(e.target.value)}
                      placeholder="Add Image URL (https://...)"
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                      onKeyDown={e => e.key === 'Enter' && addImageUrl(imageUrlInput)}
                    />
                    <button
                      onClick={() => addImageUrl(imageUrlInput)}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                    >
                      <FaPlus className="text-[8px]" />
                    </button>
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-extrabold transition-all shadow-sm"
                >
                  <FaUpload className="text-[10px] text-slate-400" /> Select From Device
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  accept="image/*"
                  onChange={handleLocalFileSelect}
                />
              </div>
            </div>
          </div>

          {}
          <div className="lg:col-span-8 space-y-6">

            {}
            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm border-b border-slate-100 pb-2.5">
                <FaBox className="text-teal-600 text-xs" />
                <span>General Information</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {}
                <Field label="Category *" icon={<FaTag />} aiField={aiFilledFields.has('category')} full>
                  <select
                    value={form.category}
                    onChange={e => setField('category', e.target.value)}
                    className={getFieldClassName(aiFilledFields.has('category'))}
                  >
                    <option value="">Select category</option>
                    {ALL_CATEGORIES.map(grp => (
                      <optgroup key={grp.group} label={grp.group}>
                        {grp.options.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {aiFilledFields.has('category') && <AIBadge />}
                </Field>

                {}
                <Field label="Product Name *" icon={<FaBox />} aiField={aiFilledFields.has('name')}>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setField('name', e.target.value)}
                    placeholder="Enter product name"
                    className={getFieldClassName(aiFilledFields.has('name'))}
                  />
                  {aiFilledFields.has('name') && <AIBadge />}
                </Field>

                {}
                <Field
                  label={isMedicine ? 'Manufacturer' : 'Brand'}
                  icon={<FaTag />}
                  aiField={aiFilledFields.has(isMedicine ? 'manufacturer' : 'brand')}
                >
                  <input
                    type="text"
                    value={isMedicine ? form.manufacturer : form.brand}
                    onChange={e => setField(isMedicine ? 'manufacturer' : 'brand', e.target.value)}
                    placeholder={isMedicine ? 'Manufacturer name' : 'Brand name'}
                    className={getFieldClassName(aiFilledFields.has(isMedicine ? 'manufacturer' : 'brand'))}
                  />
                  {aiFilledFields.has(isMedicine ? 'manufacturer' : 'brand') && <AIBadge />}
                </Field>

                {}
                {isMedicine && (
                  <Field label="Generic Name" icon={<FaPills />} aiField={aiFilledFields.has('generic_name')} full>
                    <input
                      type="text"
                      value={form.generic_name}
                      onChange={e => setField('generic_name', e.target.value)}
                      placeholder="Generic / chemical composition name"
                      className={getFieldClassName(aiFilledFields.has('generic_name'))}
                    />
                    {aiFilledFields.has('generic_name') && <AIBadge />}
                  </Field>
                )}
              </div>
            </div>

            {}
            {isMedicine && (
              <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm border-b border-slate-100 pb-2.5">
                  <FaClipboardList className="text-teal-600 text-xs" />
                  <span>Medicine Specifications</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {}
                  <Field label="Form *" icon={<FaPills />} aiField={aiFilledFields.has('form')}>
                    <select
                      value={form.form}
                      onChange={e => setField('form', e.target.value)}
                      className={getFieldClassName(aiFilledFields.has('form'))}
                    >
                      <option value="">Select form</option>
                      {['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'powder', 'gel', 'patch'].map(f => (
                        <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                      ))}
                    </select>
                    {aiFilledFields.has('form') && <AIBadge />}
                  </Field>

                  {}
                  <Field label="Strength / Dosage" icon={<FaChartBar />} aiField={aiFilledFields.has('strength')}>
                    <input
                      type="text"
                      value={form.strength}
                      onChange={e => setField('strength', e.target.value)}
                      placeholder="e.g. 500mg, 10ml"
                      className={getFieldClassName(aiFilledFields.has('strength'))}
                    />
                    {aiFilledFields.has('strength') && <AIBadge />}
                  </Field>
                </div>
              </div>
            )}

            {}
            {!isMedicine && (
              <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm border-b border-slate-100 pb-2.5">
                  <FaStethoscope className="text-teal-600 text-xs" />
                  <span>Device Specifications</span>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <Field label="Type / Model" icon={<FaStethoscope />}>
                    <input
                      type="text"
                      value={form.form}
                      onChange={e => setField('form', e.target.value)}
                      placeholder="e.g. Digital, Disposable, Manual"
                      className={getFieldClassName(false)}
                    />
                  </Field>
                </div>
              </div>
            )}

            {}
            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm border-b border-slate-100 pb-2.5">
                <FaDollarSign className="text-teal-600 text-xs" />
                <span>Price & Catalog Catalog</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {}
                <Field label="MRP (₹) *" icon={<FaDollarSign />} aiField={aiFilledFields.has('mrp')}>
                  <input
                    type="number"
                    step="0.01"
                    value={form.mrp}
                    onChange={e => setField('mrp', e.target.value)}
                    placeholder="Maximum retail price"
                    className={getFieldClassName(aiFilledFields.has('mrp'))}
                  />
                  {aiFilledFields.has('mrp') && <AIBadge />}
                </Field>

                {}
                <Field label="Selling Price (₹) *" icon={<FaDollarSign />} aiField={aiFilledFields.has('price')}>
                  <input
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={e => setField('price', e.target.value)}
                    placeholder="Pharmacist sale price"
                    className={getFieldClassName(aiFilledFields.has('price'))}
                  />
                  {aiFilledFields.has('price') && <AIBadge />}
                </Field>

                {}
                <Field label="Stock Quantity *" icon={<FaWarehouse />}>
                  <input
                    type="number"
                    value={form.stock_quantity}
                    onChange={e => setField('stock_quantity', e.target.value)}
                    placeholder="Available count"
                    className={getFieldClassName(false)}
                  />
                </Field>
              </div>
            </div>

            {}
            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm border-b border-slate-100 pb-2.5">
                <FaCalendar className="text-teal-600 text-xs" />
                <span>Inventory Details & Expiry</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {}
                <Field label="Pack Size" icon={<FaBox />} aiField={aiFilledFields.has('pack_size')}>
                  <input
                    type="text"
                    value={form.pack_size}
                    onChange={e => setField('pack_size', e.target.value)}
                    placeholder="e.g. 10 tablets, 100ml bottle"
                    className={getFieldClassName(aiFilledFields.has('pack_size'))}
                  />
                  {aiFilledFields.has('pack_size') && <AIBadge />}
                </Field>

                {}
                <Field label="Batch Number" icon={<FaCalendar />}>
                  <input
                    type="text"
                    value={form.batch_number}
                    onChange={e => setField('batch_number', e.target.value)}
                    placeholder="Batch code / lot no."
                    className={getFieldClassName(false)}
                  />
                </Field>

                {}
                <Field label="Expiry Date" icon={<FaCalendar />}>
                  <input
                    type="date"
                    value={form.expiry_date}
                    onChange={e => setField('expiry_date', e.target.value)}
                    className={getFieldClassName(false)}
                  />
                </Field>
              </div>
            </div>

            {}
            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm border-b border-slate-100 pb-2.5">
                <FaThermometerHalf className="text-teal-600 text-xs" />
                <span>Storage & Prescriptions</span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {}
                {isMedicine && (
                  <Field label="Storage Condition" icon={<FaThermometerHalf />}>
                    <select
                      value={form.storage_instructions}
                      onChange={e => setField('storage_instructions', e.target.value)}
                      className={getFieldClassName(false)}
                    >
                      <option value="room_temp">🌡️ Room Temperature</option>
                      <option value="cool_place">❄️ Cool Place (&lt;25°C)</option>
                      <option value="refrigerated">🧊 Refrigerated (2-8°C)</option>
                      <option value="frozen">🧊 Frozen</option>
                    </select>
                  </Field>
                )}

                {}
                {isMedicine && (
                  <label className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 hover:bg-slate-100/70 rounded-xl cursor-pointer transition-colors w-full select-none mt-1">
                    <input
                      type="checkbox"
                      checked={form.requires_prescription}
                      onChange={e => setField('requires_prescription', e.target.checked)}
                      className="w-5 h-5 checkbox-anim rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 accent-emerald-600 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                        <FaFileAlt className="text-emerald-500" /> Requires Prescription
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5">Patients must upload doctor prescription to purchase</span>
                    </div>
                  </label>
                )}
              </div>
            </div>

            {}
            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm border-b border-slate-100 pb-2.5">
                <FaClipboardList className="text-teal-600 text-xs" />
                <span>Description & Active Ingredients</span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {}
                <Field label="Description" icon={<FaClipboardList />} aiField={aiFilledFields.has('description')} full>
                  <textarea
                    value={form.description}
                    onChange={e => setField('description', e.target.value)}
                    placeholder="Enter product description, uses, directions, warning labels..."
                    rows={3}
                    className={getFieldClassName(aiFilledFields.has('description'))}
                    style={{ resize: 'vertical' }}
                  />
                  {aiFilledFields.has('description') && <AIBadge />}
                </Field>

                {}
                {isMedicine && (
                  <>
                    {}
                    <Field label="Composition" icon={<FaPills />} aiField={aiFilledFields.has('composition')} full>
                      <textarea
                        value={form.composition}
                        onChange={e => setField('composition', e.target.value)}
                        placeholder="Enter active chemical composition details (e.g. Paracetamol 500mg)..."
                        rows={2}
                        className={getFieldClassName(aiFilledFields.has('composition'))}
                        style={{ resize: 'vertical' }}
                      />
                      {aiFilledFields.has('composition') && <AIBadge />}
                    </Field>

                    {}
                    <Field label="Side Effects" icon={<FaExclamationTriangle />} aiField={aiFilledFields.has('side_effects')} full>
                      <textarea
                        value={form.side_effects}
                        onChange={e => setField('side_effects', e.target.value)}
                        placeholder="Potential side effects related to this drug..."
                        rows={2}
                        className={getFieldClassName(aiFilledFields.has('side_effects'))}
                        style={{ resize: 'vertical' }}
                      />
                      {aiFilledFields.has('side_effects') && <AIBadge />}
                    </Field>

                    {}
                    <Field label="Contraindications" icon={<FaExclamationTriangle />} aiField={aiFilledFields.has('contraindications')} full>
                      <textarea
                        value={form.contraindications}
                        onChange={e => setField('contraindications', e.target.value)}
                        placeholder="When this product should not be consumed (contraindications)..."
                        rows={2}
                        className={getFieldClassName(aiFilledFields.has('contraindications'))}
                        style={{ resize: 'vertical' }}
                      />
                      {aiFilledFields.has('contraindications') && <AIBadge />}
                    </Field>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {}
      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 z-20">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-1.5">
            <span className="flex items-center gap-1.5">
              <FaSpinner className="animate-spin text-emerald-500" />
              <span>Uploading product data and images...</span>
            </span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {}
      <div className="flex items-center justify-between gap-4 p-5 border-t border-slate-100 bg-slate-50/50 sticky bottom-0 z-20">
        <div>
          {aiFilledFields.size > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 rounded-full text-[10px] font-black uppercase tracking-wide shadow-sm">
              <FaMagic className="animate-bounce" />
              <span>{aiFilledFields.size} fields filled by AI</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-extrabold transition-all hover:shadow-sm"
            >
              <FaTimes /> Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!form.name || !form.category || !form.price || !form.stock_quantity || isSaving}
            className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-slate-200 disabled:to-slate-200 text-white disabled:text-slate-400 rounded-xl text-xs font-black shadow-md shadow-emerald-600/10 disabled:shadow-none transition-all active:scale-[0.98]`}
          >
            {isSaving ? (
              <FaSpinner className="animate-spin" />
            ) : (
              <FaSave />
            )}
            <span>{isSaving ? 'Saving...' : editingProduct ? 'Update Product' : 'Add Product'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};


const AIBadge = () => (
  <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2.5 py-1 bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-full text-[10px] font-black pointer-events-none shadow-sm shadow-emerald-100/10">
    <FaMagic className="text-[8px] animate-pulse" /> AI
  </span>
);

const Field = ({ label, icon, children, full, aiField }) => (
  <div className={`flex flex-col gap-1.5 ${full ? 'col-span-full' : ''}`}>
    <label className="flex items-center gap-1.5 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
      {icon && <span className="text-slate-400">{icon}</span>}
      <span>{label}</span>
      {aiField && (
        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-black rounded-full shadow-sm shadow-emerald-500/10 tracking-wide animate-pulse">
          ✨ AI
        </span>
      )}
    </label>
    <div className="relative w-full">
      {children}
    </div>
  </div>
);

export default AddMedicineWithAI;