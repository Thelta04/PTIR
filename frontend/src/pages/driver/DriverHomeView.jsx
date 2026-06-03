import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, CheckCircle, Clock, Square } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ConfirmationModal from '../../components/ConfirmationModal';
import {
  listPendingTrips,
  listShifts,
  acceptTrip,
  listTrips,
  pickupTrip,
  completeTrip,
  getRouteGeometry,
  getPricing,
  updateDriverLocation,
  emitInvoice,
  endShift,
  cancelTrip
} from '../../api/client';
import { calculateEstimatedPrice } from '../../utils/pricing';
import { getCoordsFromAddress } from '../../components/geocoding';
import { decodePolyline } from '../../utils/map';
import 'leaflet/dist/leaflet.css';

// Custom icons using standard markers or SVG
const createIcon = (color) => new L.DivIcon({
  html: `<div style="color: ${color};"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="white"/></svg></div>`,
  className: 'custom-pin',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const carIcon = new L.DivIcon({
  html: `
    <div aria-label="Localização do táxi" title="Localização do táxi" style="
      background-color: #111827; 
      color: #f0c14b; 
      border-radius: 50%; 
      width: 40px; 
      height: 40px; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      border: 2px solid #fff;
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.92 5.01C18.72 4.42 18.16 4 17.5 4h-11c-.66 0-1.21.42-1.42 1.01L3 11v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 15c-.83 0-1.5-.67-1.5-1.5S5.67 12 6.5 12s1.5.67 1.5 1.5S7.33 15 6.5 15zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 10l1.5-4.5h11L19 10H5z" />
        <path d="M8 3h8v2H8z" />
      </svg>
    </div>
  `,
  className: 'custom-car-marker',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const pinColors = ['#ef4444', '#facc15', '#f97316']; // Red, Yellow, Orange

const simplifyAddress = (addr) => {
  if (!addr || addr === 'Current Location') return addr;
  const parts = addr.split(',').map(p => p.trim());

  // Portuguese street prefixes to identify the main street part
  const streetPrefixes = ['Rua', 'Avenida', 'Av.', 'Travessa', 'Tv.', 'Praça', 'Largo', 'Estrada', 'Azinhaga', 'Caminho', 'Beco', 'Calçada'];

  let streetIdx = -1;
  // Look for the street name in the first 3 parts (skipping POI name if present)
  for (let i = 0; i < Math.min(parts.length, 3); i++) {
    if (streetPrefixes.some(prefix => parts[i].toLowerCase().startsWith(prefix.toLowerCase()))) {
      streetIdx = i;
      break;
    }
  }

  // Fallback: if we couldn't find a prefix, check if part 1 is a number and part 2 is the street
  if (streetIdx === -1 && parts.length > 2 && /^\d/.test(parts[1])) {
    streetIdx = 2;
  }

  // Final fallback to part 0
  if (streetIdx === -1) streetIdx = 0;

  let street = parts[streetIdx];
  // If the previous part is a building number, include it
  if (streetIdx > 0 && /^\d/.test(parts[streetIdx - 1])) {
    street = `${parts[streetIdx - 1]} ${street}`;
  }

  // Freguesia is usually the next part, Concelho the one after
  const freguesia = parts[streetIdx + 1] || '';
  const concelho = parts[streetIdx + 2] || '';

  return [street, freguesia, concelho].filter(Boolean).join(', ');
};

const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const MapController = ({ activeTrip, routeCoords, driverLoc }) => {
  const map = useMap();

  useEffect(() => {
    if (activeTrip && (activeTrip.status === 'CLIENT_ACCEPTED' || activeTrip.status === 'IN_PROGRESS')) {
      if (routeCoords && routeCoords.length > 0) {
        try {
          const bounds = L.latLngBounds(routeCoords);
          map.fitBounds(bounds, { padding: [50, 50], animate: true });
        } catch (e) {
          console.error("Error fitting bounds", e);
        }
      }
    } else if (!activeTrip && driverLoc) {
      try {
        map.setView([driverLoc.lat, driverLoc.lon], 14, { animate: true });
      } catch (e) { }
    }
  }, [activeTrip?.status, routeCoords, map]);

  return null;
};

const playNewTripAlert = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const audioContext = new AudioContext();
    const playTone = (frequency, delay) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + delay);
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + delay + 0.22);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(audioContext.currentTime + delay);
      oscillator.stop(audioContext.currentTime + delay + 0.24);
    };

    playTone(880, 0);
    playTone(1175, 0.26);
    setTimeout(() => audioContext.close(), 700);
  } catch (err) {
    console.error('Error playing new trip alert:', err);
  }
};

export default function DriverHomeView({ onNavigate }) {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const activeTripRef = useRef(null);
  const lastFetchedRouteKey = useRef('');
  const [eta, setEta] = useState(null);
  const driverLocRef = useRef(null);
  const lastLocationPublishRef = useRef(0);
  const knownPendingTripIdsRef = useRef(new Set());
  const hasLoadedPendingTripsRef = useRef(false);
  const notifiedDriverTripEventsRef = useRef(new Set());

  useEffect(() => {
    activeTripRef.current = activeTrip;
  }, [activeTrip]);
  const [routeCoords, setRouteCoords] = useState([]);
  const [driverLoc, setDriverLoc] = useState(null);

  useEffect(() => {
    driverLocRef.current = driverLoc;
  }, [driverLoc]);

  // Driver Accepted Timeout Logic
  const [driverAcceptCountdown, setDriverAcceptCountdown] = useState(60);

  const handleAutoCancel = async () => {
    if (!activeTripRef.current) return;
    try {
      await cancelTrip(activeTripRef.current.id);
      showToast('A viagem foi cancelada automaticamente (tempo de espera esgotado).');
      fetchData();
    } catch (err) {
      console.error('Error auto-canceling trip:', err);
    }
  };

  useEffect(() => {
    let timer;
    if (activeTrip && activeTrip.status === 'DRIVER_ACCEPTED') {
      timer = setInterval(() => {
        setDriverAcceptCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleAutoCancel();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setDriverAcceptCountdown(60);
    }
    return () => clearInterval(timer);
  }, [activeTrip?.status, activeTrip?.id]);

  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const nextLoc = {
            lat: position.coords.latitude,
            lon: position.coords.longitude
          };
          setDriverLoc(nextLoc);

          const now = Date.now();
          if (now - lastLocationPublishRef.current > 5000) {
            lastLocationPublishRef.current = now;
            updateDriverLocation(nextLoc.lat, nextLoc.lon).catch((err) => {
              console.error('Error publishing driver location:', err);
            });
          }
        },
        (error) => {
          console.error("Error getting driver location:", error);
          // Fallback if denied or error
          setDriverLoc(prev => {
            const fallbackLoc = prev || { lat: 38.7115, lon: -9.1360 };
            updateDriverLocation(fallbackLoc.lat, fallbackLoc.lon).catch((err) => {
              console.error('Error publishing fallback driver location:', err);
            });
            return fallbackLoc;
          });
        },
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      setDriverLoc({ lat: 38.7115, lon: -9.1360 });
    }
  }, []);

  useEffect(() => {
    if (!driverLoc) return undefined;

    const intervalId = setInterval(() => {
      updateDriverLocation(driverLoc.lat, driverLoc.lon).catch((err) => {
        console.error('Error refreshing driver location:', err);
      });
    }, 10000);

    return () => clearInterval(intervalId);
  }, [driverLoc]);
  const [shiftDuration, setShiftDuration] = useState('');
  const [isShiftEnded, setIsShiftEnded] = useState(false);
  const [pricingConfig, setPricingConfig] = useState(null);

  // Calculate target for active trip display
  const targetCoordsStr = activeTrip ? (
    (activeTrip.status === 'IN_PROGRESS' || activeTrip.status === 'CANCELED')
      ? activeTrip.destCoords
      : activeTrip.originCoords
  ) : null;
  const targetAddress = activeTrip ? (
    (activeTrip.status === 'IN_PROGRESS' || activeTrip.status === 'CANCELED')
      ? activeTrip.destAddress
      : activeTrip.originAddress
  ) : '';

  const distanceToTarget = (targetCoordsStr && driverLoc) ? (() => {
    const [tLat, tLon] = targetCoordsStr.split(',').map(Number);
    return haversine(driverLoc.lat, driverLoc.lon, tLat, tLon).toFixed(1);
  })() : '0.0';

  // Modal State
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const showDriverTripToast = (eventKey, message) => {
    if (notifiedDriverTripEventsRef.current.has(eventKey)) return;
    notifiedDriverTripEventsRef.current.add(eventKey);
    showToast(message);
  };

  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

  const showConfirm = (title, message, onConfirm) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        closeModal();
      }
    });
  };

  // Sheet states: 'closed' (peek), 'open' (expanded)
  const [sheetState, setSheetState] = useState('closed');

  const handleAcknowledgeRefusal = () => {
    setActiveTrip(null);
    setRouteCoords([]);
    setEta(null);
    fetchData();
  };

  const fetchData = async () => {
    try {
      if (!pricingConfig) {
        const { data: p } = await getPricing();
        setPricingConfig(p);
      }

      const { data: shifts } = await listShifts(user.id);
      const active = shifts.find(s => s.real_interval && !s.real_interval.end_time);
      setActiveShift(active);

      // Check for active trip assigned to this driver
      const { data: allTrips } = await listTrips();
      let myActive = allTrips.find(t =>
        t.driver_id === user.id &&
        ['DRIVER_ACCEPTED', 'CLIENT_ACCEPTED', 'IN_PROGRESS', 'WAITING_PAYMENT', 'PAID'].includes(t.status)
      );

      // If no active trip, but we HAD one, check if it was canceled
      if (!myActive && activeTripRef.current && activeTripRef.current.status !== 'CANCELED') {
        const justCanceled = allTrips.find(t => t.id === activeTripRef.current.id && t.status === 'CANCELED');
        if (justCanceled) {
          myActive = justCanceled;
        }
      }

      if (myActive) {
        // If transitioning from no trip to an active trip, we might want to open it once
        if (!activeTripRef.current) {
          setSheetState('open');
        }
        if (myActive.status === 'CLIENT_ACCEPTED') {
          showDriverTripToast(
            `client-confirmed-${myActive.id}`,
            'O cliente confirmou o motorista. Pode ir recolher o passageiro.'
          );
        } else if (myActive.status === 'PAID') {
          showDriverTripToast(
            `client-paid-${myActive.id}`,
            'O cliente efetuou o pagamento. Já pode emitir a fatura.'
          );
        }
        setActiveTrip(myActive);
        setTrips([]); // Don't show other pending trips
      } else if (activeTripRef.current && activeTripRef.current.status === 'CANCELED') {
        // Keep the canceled trip in state so the driver can click "Continuar"
        setTrips([]);
      } else {
        setActiveTrip(null);
        setRouteCoords([]);
        setEta(null);
        const loc = driverLocRef.current || { lat: 0.0, lon: 0.0 };
        const { data: pending } = await listPendingTrips(user.id, loc.lat, loc.lon);
        const pendingIds = new Set(pending.map((trip) => trip.id));
        const hasNewPendingTrip = pending.some((trip) => !knownPendingTripIdsRef.current.has(trip.id));

        if (hasLoadedPendingTripsRef.current && hasNewPendingTrip) {
          playNewTripAlert();
        }

        knownPendingTripIdsRef.current = pendingIds;
        hasLoadedPendingTripsRef.current = true;
        setTrips(pending);
      }
    } catch (err) {
      console.error('Error fetching driver home data:', err);
    }
  };

  const handleAccept = async (trip) => {
    if (!activeShift) {
      showToast('Você precisa estar em um turno ativo para aceitar viagens.');
      return;
    }

    const now = new Date();
    let over8h = false;
    let passedScheduled = false;

    if (activeShift.real_interval?.start_time) {
      const start = new Date(activeShift.real_interval.start_time);
      const diff = now - start;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours >= 8) over8h = true;
    }

    if (activeShift.scheduled_interval?.end_time) {
      if (now >= new Date(activeShift.scheduled_interval.end_time)) {
        passedScheduled = true;
      }
    }

    if (over8h || passedScheduled) {
      showToast('Não é possível aceitar nova viagem. O turno expirou ou excedeu 8h.');
      return;
    }

    let distFromDriver = '?';
    if (trip.originCoords) {
      const [tLat, tLon] = trip.originCoords.split(',').map(Number);
      if (!isNaN(tLat) && !isNaN(tLon)) {
        distFromDriver = haversine(driverLoc.lat, driverLoc.lon, tLat, tLon).toFixed(1);
      }
    }

    // Fetch actual percurso metrics from ORS since trip might have 0 in DB
    let tripKm = trip.kilometers || 0;
    let tripPrice = trip.price || 0;

    // Use a fresh fetch if pricingConfig is missing
    let currentPricing = pricingConfig;
    if (!currentPricing) {
      try {
        const { data: p } = await getPricing();
        currentPricing = p;
        setPricingConfig(p);
      } catch (e) { console.error("Failed to fetch pricing for modal", e); }
    }

    let startCoords = trip.originCoords;
    let endCoords = trip.destCoords;

    // Fallback: if coords are missing in DB, try to geocode the addresses now
    if (!startCoords && trip.originAddress) {
      try {
        const c = await getCoordsFromAddress(trip.originAddress);
        if (c) startCoords = `${c.lat},${c.lon}`;
      } catch (e) { console.error("Geocoding origin failed", e); }
    }
    if (!endCoords && trip.destAddress) {
      try {
        const c = await getCoordsFromAddress(trip.destAddress);
        if (c) endCoords = `${c.lat},${c.lon}`;
      } catch (e) { console.error("Geocoding destination failed", e); }
    }

    if (startCoords && endCoords) {
      try {
        const { data: routeData } = await getRouteGeometry(startCoords, endCoords);
        // Backend RouteGeometryView returns distance in METERS and duration in SECONDS
        if (routeData.distance !== undefined) {
          tripKm = (Number(routeData.distance) / 1000).toFixed(1);
        }
        if (routeData.duration !== undefined && currentPricing) {
          // calculateEstimatedPrice expects minutes
          tripPrice = calculateEstimatedPrice(routeData.duration / 60, trip.comfort_level, currentPricing);
        }
      } catch (e) {
        console.error("Error fetching trip metrics for modal:", e);
      }
    }

    showConfirm(
      'Aceitar Viagem?',
      <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
          <img 
            src={`/PFPs/${trip.client_pfp || 1}.jpg`} 
            alt={trip.client_name} 
            style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e5e7eb' }} 
          />
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#1f2937' }}>{trip.client_name}</div>
            <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>Cliente</div>
          </div>
        </div>
        <div><strong>De:</strong> {simplifyAddress(trip.originAddress)}</div>
        <div><strong>Para:</strong> {simplifyAddress(trip.destAddress)}</div>
        <hr style={{ border: '0', borderTop: '1px dashed #eee', margin: '5px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Distância até si:</span>
          <strong>{distFromDriver} km</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Percurso:</span>
          <strong>{tripKm} km</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', marginTop: '5px', color: '#000' }}>
          <span>Preço:</span>
          <strong>€{Number(tripPrice).toFixed(2)}</strong>
        </div>
      </div>,
      async () => {
        try {
          await acceptTrip(trip.id, user.id, activeShift.id);
          fetchData();
        } catch (err) {
          console.error('Error accepting trip:', err);
          showToast('Erro ao aceitar viagem.');
        }
      }
    );
  };

  const handlePickup = async () => {
    if (!activeTrip) return;

    showConfirm(
      'Iniciar Viagem?',
      'O passageiro já entrou no veículo?',
      async () => {
        try {
          await pickupTrip(activeTrip.id);
          fetchData();
        } catch (err) {
          console.error('Error picking up client:', err);
          showToast('Erro ao iniciar viagem.');
        }
      }
    );
  };

  const handleComplete = async () => {
    if (!activeTrip) return;

    showConfirm(
      'Terminar Viagem?',
      'Chegou ao destino final?',
      async () => {
        try {
          await completeTrip(activeTrip.id);
          fetchData();
        } catch (err) {
          console.error('Error completing trip:', err);
          showToast('Erro ao concluir viagem.');
        }
      }
    );
  };

  const handleEmitInvoice = async () => {
    if (!activeTrip) return;
    try {
      await emitInvoice(activeTrip.id);
      fetchData();
    } catch (err) {
      console.error('Error emitting invoice:', err);
      showToast('Erro ao emitir fatura.');
    }
  };

  const handleEndShift = () => {
    if (!activeShift) return;
    showConfirm(
      'Terminar Turno',
      'Deseja terminar o seu turno atual?',
      async () => {
        try {
          await endShift(activeShift.id);
          fetchData();
          if (onNavigate) onNavigate('shifts');
        } catch (err) {
          console.error('Error ending shift:', err);
          showToast('Erro ao terminar turno.');
        }
      }
    );
  };

  useEffect(() => {
    if (user?.id) {
      fetchData();
      // Poll every 5 seconds for updates (e.g. client accepted)
      const intervalId = setInterval(fetchData, 5000);
      return () => clearInterval(intervalId);
    }
  }, [user]);

  // Timer for active shift duration
  useEffect(() => {
    let timer;
    if (activeShift?.real_interval?.start_time) {
      const updateTimer = () => {
        const start = new Date(activeShift.real_interval.start_time);
        const now = new Date();
        const diff = now - start;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setShiftDuration(`${hours}h ${minutes}m`);

        let ended = false;
        if (hours >= 8) {
          ended = true;
        } else if (activeShift.scheduled_interval?.end_time) {
          ended = now >= new Date(activeShift.scheduled_interval.end_time);
        }
        setIsShiftEnded(ended);
      };
      updateTimer();
      timer = setInterval(updateTimer, 60000);
    } else {
      setShiftDuration('');
    }
    return () => clearInterval(timer);
  }, [activeShift]);

  // Fetch route geometry when active trip changes
  useEffect(() => {
    const fetchRoute = async () => {
      if (!activeTrip) {
        setRouteCoords([]);
        lastFetchedRouteKey.current = '';
        return;
      }

      let origin, dest;
      let type = '';
      if (activeTrip.status === 'CLIENT_ACCEPTED') {
        // Route to the client
        origin = `${driverLoc.lat},${driverLoc.lon}`;
        dest = activeTrip.originCoords;
        type = 'to-client';
      } else if (activeTrip.status === 'IN_PROGRESS') {
        // Route to destination
        origin = `${driverLoc.lat},${driverLoc.lon}`;
        dest = activeTrip.destCoords;
        type = 'to-dest';
      }

      if (origin && dest) {
        const routeKey = `${type}-${activeTrip.id}-${origin}-${dest}`;
        if (lastFetchedRouteKey.current === routeKey) return;

        try {
          const { data } = await getRouteGeometry(origin, dest);
          if (data.geometry) {
            setRouteCoords(decodePolyline(data.geometry));
          } else if (data.is_fallback) {
            const o = origin.split(',').map(Number);
            const d = dest.split(',').map(Number);
            setRouteCoords([[o[0], o[1]], [d[0], d[1]]]);
          }
          if (data.duration) {
            setEta(Math.round(data.duration / 60));
          }
          lastFetchedRouteKey.current = routeKey;
        } catch (err) {
          console.error('Error fetching route:', err);
        }
      }
    };
    fetchRoute();
  }, [activeTrip, driverLoc]);

  const sheetVariants = {
    closed: { y: 'calc(100% - 160px)' },
    open: { y: '15%' },
  };

  if (!driverLoc) {
    return (
      <div className="driver-home-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '20px' }}>
        <h2 style={{ color: '#555' }}>A obter localização...</h2>
        <div className="pulse-loader"><div className="pulse-ring"></div></div>
      </div>
    );
  }

  return (
    <div className="driver-home-container">
      {activeShift ? (
        <div className="shift-status-bar" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: isShiftEnded ? '#10b981' : undefined,
          color: isShiftEnded ? 'white' : undefined
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isShiftEnded ? <CheckCircle size={18} /> : <Clock size={18} />}
            <span>
              {isShiftEnded ? 'O turno terminou!' : `Turno em curso: ${shiftDuration} decorridos`}
            </span>
          </div>
          <button
            onClick={handleEndShift}
            disabled={!!activeTrip}
            style={{
              background: activeTrip ? '#ccc' : (isShiftEnded ? 'rgba(255,255,255,0.2)' : '#b91c1c'),
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              color: activeTrip ? '#888' : 'white',
              cursor: activeTrip ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isShiftEnded ? <CheckCircle size={14} /> : <Square size={14} />}
            {isShiftEnded ? 'Concluir' : 'Terminar'}
          </button>
        </div>
      ) : (
        <div className="shift-status-bar" style={{ backgroundColor: '#b91c1c', color: 'white', justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} />
            <span>Não está num turno</span>
          </div>
          <button
            onClick={() => onNavigate && onNavigate('shifts')}
            style={{
              background: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              color: '#b91c1c',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Consultar Turnos
          </button>
        </div>
      )}

      <div className="map-full">
        <MapContainer center={[driverLoc.lat, driverLoc.lon]} zoom={14} zoomControl={false} style={{ height: '100%', width: '100%', zIndex: 0 }}>
          {/* BACKUP: OSM HOT (Humanitarian) - Good contrast but has electrical lines
          <TileLayer
            url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team hosted by OpenStreetMap France'
            maxZoom={19}
          />
          */}
          <TileLayer
            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            attribution="&copy; Google Maps"
            maxZoom={20}
          />
          <Marker position={[driverLoc.lat, driverLoc.lon]} icon={carIcon} title="Você está aqui" alt="Você está aqui">
            <Popup>Você está aqui</Popup>
          </Marker>

          {activeTrip ? (
            <>
              {/* Pickup location marker (hide if trip is in progress) */}
              {activeTrip.status !== 'IN_PROGRESS' && activeTrip.originCoords && (
                <Marker position={activeTrip.originCoords.split(',').map(Number)} icon={createIcon('#ef4444')} title={`Recolha: ${activeTrip.originAddress}`} alt={`Recolha: ${activeTrip.originAddress}`}>
                  <Popup>Recolha: {activeTrip.originAddress}</Popup>
                </Marker>
              )}
              {/* Destination location marker (only if in progress) */}
              {activeTrip.status === 'IN_PROGRESS' && activeTrip.destCoords && (
                <Marker position={activeTrip.destCoords.split(',').map(Number)} icon={createIcon('#10b981')} title={`Destino: ${activeTrip.destAddress}`} alt={`Destino: ${activeTrip.destAddress}`}>
                  <Popup>Destino: {activeTrip.destAddress}</Popup>
                </Marker>
              )}
              {/* Route line */}
              {routeCoords.length > 0 && (
                <Polyline positions={routeCoords} color="#3b82f6" weight={5} opacity={0.7} />
              )}
            </>
          ) : activeShift ? (
            trips.map((trip, index) => {
              if (!trip.originCoords) return null;
              const [tLat, tLon] = trip.originCoords.split(',').map(Number);
              if (isNaN(tLat) || isNaN(tLon)) return null;
              return (
                <Marker key={trip.id} position={[tLat, tLon]} icon={createIcon(pinColors[index % pinColors.length])} title={trip.client_name} alt={trip.client_name}>
                  <Popup>{trip.client_name}</Popup>
                </Marker>
              );
            })
          ) : null}
        </MapContainer>
      </div>

      {activeTrip ? (
        <div className="active-trip-permanent-bar">
          <div className="active-bar-content">
            <h2 className="active-client-name">{activeTrip.client_name}</h2>

            <div className="active-stats-row">
              <div className="stat-item">
                <Navigation size={18} />
                <span>{distanceToTarget} km</span>
              </div>
              <div className="stat-item">
                <Clock size={18} />
                <span>{eta || '--'} min</span>
              </div>
            </div>

            <div className="active-destination">
              <MapPin size={18} className="text-green" />
              <span>{simplifyAddress(targetAddress)}</span>
            </div>

            <div className="active-bar-actions">
              {activeTrip.status === 'CANCELED' ? (
                <button className="btn-pickup btn-full" onClick={handleAcknowledgeRefusal}>
                  Viagem Cancelada - Continuar
                </button>
              ) : activeTrip.status === 'DRIVER_ACCEPTED' ? (
                <div className="waiting-msg">
                  Aguardando cliente... ({driverAcceptCountdown}s)
                </div>
              ) : activeTrip.status === 'WAITING_PAYMENT' ? (
                <div className="waiting-msg" style={{ background: '#fdf2b3', color: '#856404' }}>
                  Aguardando Pagamento...
                </div>
              ) : activeTrip.status === 'PAID' ? (
                <button className="btn-complete btn-full" onClick={handleEmitInvoice}>
                  Emitir Fatura
                </button>
              ) : activeTrip.status === 'CLIENT_ACCEPTED' ? (
                <button className="btn-pickup btn-full" onClick={handlePickup}>
                  Passageiro Recolhido
                </button>
              ) : (
                <button className="btn-complete btn-full" onClick={handleComplete}>
                  Concluir Viagem
                </button>
              )}
            </div>
          </div>
        </div>
      ) : activeShift ? (
        <motion.div
          className="bottom-sheet draggable-sheet"
          initial="closed"
          animate={sheetState}
          variants={sheetVariants}
          drag="y"
          dragConstraints={{ top: -100, bottom: 100 }}
          dragElastic={0.8}
          onDragEnd={(e, info) => {
            if (info.offset.y < -50) setSheetState('open');
            else if (info.offset.y > 50) setSheetState('closed');
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        >
          <div className="sheet-handle-wrapper" onClick={() => setSheetState(sheetState === 'open' ? 'closed' : 'open')}>
            <div className="sheet-handle"></div>
          </div>

          <div className="sheet-header">
            <h2 className="sheet-title">Escolher Passageiro</h2>
          </div>

          <div className="passenger-list">
            {trips.length === 0 ? (
              <div className="no-trips">Nenhuma viagem pendente encontrada.</div>
            ) : (
              trips.map((trip, index) => {
                let dist = '?';
                if (trip.originCoords) {
                  const [tLat, tLon] = trip.originCoords.split(',').map(Number);
                  if (!isNaN(tLat) && !isNaN(tLon)) {
                    dist = haversine(driverLoc.lat, driverLoc.lon, tLat, tLon).toFixed(1);
                  }
                }
                const color = pinColors[index % pinColors.length];

                return (
                  <div key={trip.id} className="passenger-card" onClick={() => handleAccept(trip)}>
                    <div className="card-info">
                      <div className="card-top">
                        <div className="passenger-name-group">
                          <MapPin size={22} fill="currentColor" style={{ color, flexShrink: 0 }} />
                          <span className="passenger-name">{trip.client_name}</span>
                        </div>
                        <div className="card-badges">
                          <span className="driver-dist">a {dist}km</span>
                          <div className="trip-distance-badge">
                            <Navigation size={12} />
                            <span>Percurso: {trip.kilometers}km</span>
                          </div>
                        </div>
                      </div>
                      <div className="card-route">
                        <div className="route-point">
                          <span className="route-label">Recolha:</span>
                          <span className="route-address" title={trip.originAddress}>{simplifyAddress(trip.originAddress)}</span>
                        </div>
                        <div className="route-point">
                          <span className="route-label">Destino:</span>
                          <span className="route-address" title={trip.destAddress}>{simplifyAddress(trip.destAddress)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      ) : null}

      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onCancel={closeModal}
      />

      <AnimatePresence>
        {toastMsg && (
          <motion.div
            className="client-trip-toast"
            initial={{ opacity: 0, y: -12, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -12, x: '-50%' }}
            transition={{ duration: 0.18 }}
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
