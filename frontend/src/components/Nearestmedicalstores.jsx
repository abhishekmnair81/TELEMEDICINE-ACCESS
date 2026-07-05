import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FaMapPin, FaDirections, FaClock, FaPhone, FaStar,
  FaSync, FaTimes, FaExclamationCircle, FaExternalLinkAlt,
  FaCrosshairs
} from 'react-icons/fa';
import './Nearestmedicalstores.css';

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function formatLastUpdated(date) {
  if (!date) return '';
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 10) return 'Just now';
  if (diff < 60) return `${diff}s ago`;
  return `${Math.floor(diff / 60)}m ago`;
}

function generateMockStores(lat, lng) {
  const pharmacies = [
    { name: 'Rural Pharmacy', rating: 4.5, open: true, phone: '+91 98765 43210', hours: '8AM-10PM' },
    { name: 'MedPlus Pharmacy', rating: 4.3, open: true, phone: '+91 98765 43211', hours: '7AM-11PM' },
    { name: 'Netmeds Store', rating: 4.1, open: false, phone: '+91 98765 43212', hours: '9AM-9PM' },
    { name: '1mg Pharmacy', rating: 4.4, open: true, phone: '+91 98765 43213', hours: '8AM-10PM' },
    { name: 'Wellness Forever', rating: 4.2, open: true, phone: '+91 98765 43214', hours: '8AM-11PM' },
    { name: 'Frank Ross Chemists', rating: 4.0, open: false, phone: '+91 98765 43215', hours: '9AM-9PM' },
    { name: 'Suraksha Diagnostics', rating: 4.6, open: true, phone: '+91 98765 43216', hours: '7AM-10PM' },
    { name: 'Life Pharmacy', rating: 3.9, open: true, phone: '+91 98765 43217', hours: '8AM-9PM' },
  ];
  return pharmacies.map((p, i) => {
    const angle = (i / pharmacies.length) * 2 * Math.PI + Math.random() * 0.5;
    const dist = 0.3 + Math.random() * 2.5;
    const dLat = (dist * Math.cos(angle)) / 111;
    const dLng = (dist * Math.sin(angle)) / (111 * Math.cos((lat * Math.PI) / 180));
    const sLat = lat + dLat, sLng = lng + dLng;
    return {
      id: i,
      ...p,
      lat: sLat,
      lng: sLng,
      distance: getDistanceKm(lat, lng, sLat, sLng),
      directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${sLat},${sLng}&travelmode=driving`
    };
  }).sort((a, b) => a.distance - b.distance);
}

export default function NearestMedicalStores() {
  const [isOpen, setIsOpen] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [stores, setStores] = useState([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [permissionState, setPermissionState] = useState('prompt');
  const [pulseAnim, setPulseAnim] = useState(false);
  const watchIdRef = useRef(null);
  const prevLocRef = useRef(null);

  const fetchNearbyStores = useCallback(async (lat, lng) => {
    setLoadingStores(true);
    try {
      await new Promise(r => setTimeout(r, 900));
      setStores(generateMockStores(lat, lng));
      setLastUpdated(new Date());
      setPulseAnim(true);
      setTimeout(() => setPulseAnim(false), 600);
    } catch {
      setStores([]);
    } finally {
      setLoadingStores(false);
    }
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported.');
      return;
    }
    setTrackingActive(true);
    setLocationError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setPermissionState('granted');
        setLocation({ lat, lng, accuracy });
        const prev = prevLocRef.current;
        if (!prev || getDistanceKm(prev.lat, prev.lng, lat, lng) > 0.05) {
          prevLocRef.current = { lat, lng };
          fetchNearbyStores(lat, lng);
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionState('denied');
          setLocationError('Location access denied. Enable in browser settings.');
        } else {
          setLocationError('Unable to get your location. Please try again.');
        }
        setTrackingActive(false);
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
    );
  }, [fetchNearbyStores]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTrackingActive(false);
  }, []);

  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, [startTracking, stopTracking]);

  const openCount = stores.filter(s => s.open).length;

  return (
    <>
      {/* Floating Action Button */}
      <button
        className={`fixed bottom-7 right-7 w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white flex items-center justify-center z-[998] shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95 group focus:outline-none ${
          pulseAnim ? 'scale-110' : ''
        }`}
        onClick={() => setIsOpen(v => !v)}
        title="Nearest Medical Stores"
      >
        <span className="relative z-10 text-xl group-hover:rotate-12 transition-transform">
          <FaMapPin />
        </span>
        {trackingActive && (
          <div className="absolute inset-0 rounded-full border border-emerald-400/40 animate-fab-ring" />
        )}
        {stores.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white border-2 border-white rounded-full w-5.5 h-5.5 flex items-center justify-center text-[9px] font-black shadow-sm">
            {stores.length}
          </span>
        )}
      </button>

      {/* Main Side Dialog Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-7 w-96 max-h-[75vh] bg-white rounded-3xl shadow-2xl border border-slate-100/80 flex flex-col overflow-hidden z-[999] animate-panel-in max-sm:bottom-20 max-sm:right-4 max-sm:left-4 max-sm:w-auto">
          
          {/* Header Panel */}
          <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-emerald-900 text-white p-5 flex items-start justify-between gap-4 border-b border-emerald-800/30">
            <div className="flex items-center gap-3">
              <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 border-3 border-white/30 transition-all ${
                trackingActive ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-slate-400'
              }`} />
              <div>
                <h3 className="text-sm font-black tracking-tight text-white/95">Nearby Medical Stores</h3>
                <p className="text-[10px] text-emerald-300/80 font-bold uppercase tracking-wider mt-0.5">
                  {!location && !locationError && 'Acquiring GPS Signal...'}
                  {location && lastUpdated && `Updated ${formatLastUpdated(lastUpdated)}`}
                  {location && location.accuracy && ` · ±${Math.round(location.accuracy)}m`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                className="w-8 h-8 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => location && fetchNearbyStores(location.lat, location.lng)}
                disabled={loadingStores || !location}
                title="Refresh"
              >
                <FaSync className={`text-xs ${loadingStores ? 'animate-spin' : ''}`} />
              </button>
              <button
                className="w-8 h-8 rounded-full border border-white/20 bg-white/10 hover:bg-rose-600/90 text-white flex items-center justify-center transition-colors"
                onClick={() => setIsOpen(false)}
                title="Close"
              >
                <FaTimes className="text-xs" />
              </button>
            </div>
          </div>

          {/* Subtitle status bar */}
          <div className={`flex items-center gap-2 px-5 py-2.5 text-[11px] font-extrabold ${
            trackingActive
              ? 'bg-emerald-500/10 text-emerald-800 border-b border-emerald-500/10'
              : 'bg-slate-100 text-slate-500 border-b border-slate-200'
          }`}>
            <FaCrosshairs className="text-xs flex-shrink-0" />
            <span className="flex-1">
              {trackingActive ? `Live tracking ON · ${openCount} store${openCount !== 1 ? 's' : ''} open now` : 'Tracking paused'}
            </span>
            {!trackingActive && permissionState !== 'denied' && (
              <button
                className="bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-wide cursor-pointer transition-colors"
                onClick={startTracking}
              >
                Restart
              </button>
            )}
          </div>

          {/* Scrollable list container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 nms-stores-scrollbar bg-slate-50/50">
            
            {/* Permission Denied state */}
            {permissionState === 'denied' && (
              <div className="flex flex-col items-center text-center p-6 space-y-3 text-slate-500">
                <FaExclamationCircle className="text-3xl text-rose-500" />
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">Location Access Denied</h4>
                <p className="text-xs font-medium leading-relaxed">Please enable browser location permissions to discover nearby stores.</p>
                <button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider cursor-pointer shadow-md transition-all active:scale-[0.98]"
                  onClick={startTracking}
                >
                  Try Again
                </button>
              </div>
            )}

            {/* General Location Error */}
            {locationError && permissionState !== 'denied' && (
              <div className="flex flex-col items-center text-center p-6 space-y-3 text-slate-500">
                <FaExclamationCircle className="text-3xl text-amber-500 animate-bounce" />
                <p className="text-xs font-bold leading-relaxed text-slate-700">{locationError}</p>
                <button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider cursor-pointer shadow-md transition-all active:scale-[0.98]"
                  onClick={startTracking}
                >
                  Retry Connection
                </button>
              </div>
            )}

            {/* GPS Signal Acquisition */}
            {!location && !locationError && (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center space-y-4">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-500/40 animate-radar-ring" />
                  <div className="absolute inset-2 rounded-full border-2 border-teal-500/30 animate-radar-ring animate-radar-ring--2" />
                  <div className="absolute inset-4 rounded-full border-2 border-emerald-500/20 animate-radar-ring animate-radar-ring--3" />
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 relative z-10 text-lg">
                    <FaMapPin className="animate-bounce" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 uppercase tracking-wide">Acquiring GPS Signal...</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">Checking satellite signals & coordinates</p>
                </div>
              </div>
            )}

            {/* Stores Loading skeleton */}
            {location && loadingStores && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="p-4 border border-slate-100 rounded-2xl bg-white space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="h-4 bg-slate-200 rounded w-1/3 animate-shimmer" />
                      <div className="h-4 bg-slate-200 rounded-full w-12 animate-shimmer" />
                    </div>
                    <div className="flex gap-4">
                      <div className="h-3 bg-slate-100 rounded w-16 animate-shimmer" />
                      <div className="h-3 bg-slate-100 rounded w-16 animate-shimmer" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="h-8 bg-slate-50 border border-slate-100 rounded-xl animate-shimmer" />
                      <div className="h-8 bg-slate-50 border border-slate-100 rounded-xl animate-shimmer" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Stores List */}
            {location && !loadingStores && stores.length > 0 && (
              <div className="space-y-3.5">
                {stores.map((store, idx) => (
                  <div
                    key={store.id}
                    className={`p-4 border rounded-2xl transition-all duration-200 ${
                      store.open
                        ? 'bg-white border-slate-100 hover:border-emerald-300 hover:shadow-lg hover:shadow-slate-100/80 hover:translate-x-0.5'
                        : 'bg-slate-50/70 border-slate-100/50 opacity-70'
                    }`}
                  >
                    {/* Rank & Store Name */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-5.5 h-5.5 rounded-lg bg-emerald-50 text-[10px] font-black text-emerald-700 uppercase">
                          #{idx + 1}
                        </span>
                        <h5 className="text-xs font-black text-slate-800 truncate max-w-[190px] tracking-tight">{store.name}</h5>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        store.open
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {store.open ? 'Open' : 'Closed'}
                      </span>
                    </div>

                    {/* Metadata indicators */}
                    <div className="flex items-center gap-4 mt-2.5 text-xs text-slate-500 font-semibold">
                      <div className="flex items-center gap-1 text-emerald-600 font-bold">
                        <FaMapPin className="text-[10px]" />
                        <span>{formatDistance(store.distance)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-amber-500">
                        <FaStar className="text-[10px]" />
                        <span>{store.rating.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400">
                        <FaClock className="text-[10px]" />
                        <span>{store.hours}</span>
                      </div>
                    </div>

                    {/* Store buttons */}
                    <div className="grid grid-cols-2 gap-2 mt-3.5">
                      <button
                        onClick={() => window.open(store.directionsUrl, '_blank', 'noopener')}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-extrabold shadow-sm shadow-emerald-600/5 transition-all hover:shadow-md hover:shadow-emerald-600/10 active:scale-[0.98]"
                      >
                        <FaDirections className="text-[10px]" />
                        <span>Directions</span>
                      </button>
                      <button
                        onClick={() => window.open(`tel:${store.phone}`)}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-extrabold transition-all hover:border-slate-300 active:scale-[0.98]"
                      >
                        <FaPhone className="text-[10px] text-slate-400" />
                        <span>Call Store</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {location && !loadingStores && stores.length === 0 && !locationError && (
              <div className="flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xl">
                  <FaMapPin />
                </div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">No Stores Found</h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">No medical stores detected within 3km of your location.</p>
                <button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider cursor-pointer shadow-md transition-all active:scale-[0.98]"
                  onClick={() => fetchNearbyStores(location.lat, location.lng)}
                >
                  Search Again
                </button>
              </div>
            )}
          </div>

          {/* Panel Footer bar */}
          {location && (
            <div className="bg-slate-50 border-t border-slate-100 p-4 flex items-center justify-between text-[10px] font-black text-slate-400 tracking-wide uppercase">
              <div className="flex items-center gap-1.5">
                <FaCrosshairs className="text-slate-400" />
                <span>{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span>
              </div>
              <a
                href={`https://www.google.com/maps/search/pharmacy/@${location.lat},${location.lng},15z`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <span>View all on Maps</span>
                <FaExternalLinkAlt className="text-[8px]" />
              </a>
            </div>
          )}
        </div>
      )}
    </>
  );
}