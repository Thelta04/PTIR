import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { motion } from 'framer-motion';
import { MapPin, Navigation, CheckCircle, Clock } from 'lucide-react';
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
  getPricing
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
  html: `<div style="color: #333;"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="1"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.6 2 12.3 2 13v3c0 .6.4 1 1 1h2m14 0c0 1.1-.9 2-2 2s-2-.9-2-2 1.1-2 2-2 2 .9 2 2zM7 17c0 1.1-.9 2-2 2s-2-.9-2-2 1.1-2 2-2 2 .9 2 2z"/></svg></div>`,
  className: 'custom-car',
  iconSize: [48, 48],
  iconAnchor: [24, 24],
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

export default function DriverHomeView() {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const activeTripRef = useRef(null);
  const lastFetchedRouteKey = useRef('');
  const [eta, setEta] = useState(null);

  useEffect(() => {
    activeTripRef.current = activeTrip;
  }, [activeTrip]);
  const [routeCoords, setRouteCoords] = useState([]);
  const [driverLoc] = useState({ lat: 38.7115, lon: -9.1360 }); // Mocked near client origin
  const [shiftDuration, setShiftDuration] = useState('');
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
    onConfirm: () => {},
  });

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
        ['DRIVER_ACCEPTED', 'CLIENT_ACCEPTED', 'IN_PROGRESS', 'WAITING_PAYMENT'].includes(t.status)
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
        setActiveTrip(myActive);
        setTrips([]); // Don't show other pending trips
      } else if (activeTripRef.current && activeTripRef.current.status === 'CANCELED') {
        // Keep the canceled trip in state so the driver can click "Continuar"
        setTrips([]);
      } else {
        setActiveTrip(null);
        setRouteCoords([]);
        setEta(null);
        const { data: pending } = await listPendingTrips(user.id, driverLoc.lat, driverLoc.lon);
        setTrips(pending);
      }
    } catch (err) {
      console.error('Error fetching driver home data:', err);
    }
  };

  const handleAccept = async (trip) => {
    if (!activeShift) {
      alert('Você precisa estar em um turno ativo para aceitar viagens.');
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
          alert('Erro ao aceitar viagem.');
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
          alert('Erro ao iniciar viagem.');
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
          alert('Erro ao concluir viagem.');
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

  return (
    <div className="driver-home-container">
      {activeShift && (
        <div className="shift-status-bar">
          <Clock size={18} />
          <span>Turno em curso: {shiftDuration} decorridos</span>
        </div>
      )}
      
      <div className="map-full">
        <MapContainer center={[driverLoc.lat, driverLoc.lon]} zoom={14} zoomControl={false} style={{ height: '100%', width: '100%', zIndex: 0 }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />

          <Marker position={[driverLoc.lat, driverLoc.lon]} icon={carIcon}>
            <Popup>Você está aqui</Popup>
          </Marker>

          {activeTrip ? (
            <>
              {/* Pickup location marker (hide if trip is in progress) */}
              {activeTrip.status !== 'IN_PROGRESS' && activeTrip.originCoords && (
                <Marker position={activeTrip.originCoords.split(',').map(Number)} icon={createIcon('#ef4444')}>
                  <Popup>Recolha: {activeTrip.originAddress}</Popup>
                </Marker>
              )}
              {/* Destination location marker (only if in progress) */}
              {activeTrip.status === 'IN_PROGRESS' && activeTrip.destCoords && (
                <Marker position={activeTrip.destCoords.split(',').map(Number)} icon={createIcon('#10b981')}>
                  <Popup>Destino: {activeTrip.destAddress}</Popup>
                </Marker>
              )}
              {/* Route line */}
              {routeCoords.length > 0 && (
                <Polyline positions={routeCoords} color="#3b82f6" weight={5} opacity={0.7} />
              )}
            </>
          ) : (
            trips.map((trip, index) => {
              if (!trip.originCoords) return null;
              const [tLat, tLon] = trip.originCoords.split(',').map(Number);
              if (isNaN(tLat) || isNaN(tLon)) return null;
              return (
                <Marker key={trip.id} position={[tLat, tLon]} icon={createIcon(pinColors[index % pinColors.length])}>
                  <Popup>{trip.client_name}</Popup>
                </Marker>
              );
            })
          )}
        </MapContainer>
      </div>

      {activeTrip ? (
        <div className="active-trip-permanent-bar">
          <div className="active-bar-content">
            <h3 className="active-client-name">{activeTrip.client_name}</h3>
            
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
                <div className="waiting-msg">Aguardando cliente...</div>
              ) : activeTrip.status === 'WAITING_PAYMENT' ? (
                <div className="waiting-msg" style={{ background: '#fdf2b3', color: '#856404' }}>
                  Aguardando Pagamento...
                </div>
              ) : activeTrip.status === 'CLIENT_ACCEPTED' ? (
                <button className="btn-pickup btn-full" onClick={handlePickup}>
                  Recolher Passageiro
                </button>
              ) : (
                <button className="btn-complete btn-full" onClick={handleComplete}>
                  Concluir Viagem
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <motion.div
          className="bottom-sheet draggable-sheet"
          initial="closed"
          animate={sheetState}
          variants={sheetVariants}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.1}
          onDragEnd={(e, info) => {
            if (info.offset.y < -30) setSheetState('open');
            else if (info.offset.y > 30) setSheetState('closed');
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
                    <div className="card-icon" style={{ color }}>
                      <MapPin size={24} fill="currentColor" />
                    </div>
                    <div className="card-info">
                      <div className="card-top">
                        <span className="passenger-name">{trip.client_name} - {dist}km de si</span>
                      </div>
                      <div className="card-bottom">
                        <span className="passenger-address">{simplifyAddress(trip.originAddress)}</span>
                        <span className="trip-distance">{trip.kilometers}km</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      )}

      <ConfirmationModal 
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onCancel={closeModal}
      />
    </div>
  );
}

