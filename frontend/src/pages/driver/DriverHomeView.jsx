import { useState, useEffect } from 'react';
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
  getRouteGeometry 
} from '../../api/client';
import 'leaflet/dist/leaflet.css';

// Custom icons using standard markers or SVG
const createIcon = (color) => new L.DivIcon({
  html: `<div style="color: ${color};"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="white"/></svg></div>`,
  className: 'custom-pin',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const carIcon = new L.DivIcon({
  html: `<div style="color: #333;"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="1"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.6 2 12.3 2 13v3c0 .6.4 1 1 1h2m14 0c0 1.1-.9 2-2 2s-2-.9-2-2 1.1-2 2-2 2 .9 2 2zM7 17c0 1.1-.9 2-2 2s-2-.9-2-2 1.1-2 2-2 2 .9 2 2z"/></svg></div>`,
  className: 'custom-car',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const pinColors = ['#ef4444', '#facc15', '#f97316']; // Red, Yellow, Orange

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

const decodePolyline = (encoded) => {
  if (!encoded) return [];
  let poly = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push([lat / 1e5, lng / 1e5]);
  }
  return poly;
};

export default function DriverHomeView() {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [driverLoc] = useState({ lat: 38.7115, lon: -9.1360 }); // Mocked near client origin
  const [shiftDuration, setShiftDuration] = useState('');

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

  const fetchData = async () => {
    try {
      const { data: shifts } = await listShifts(user.id);
      const active = shifts.find(s => s.real_interval && !s.real_interval.end_time);
      setActiveShift(active);

      // Check for active trip assigned to this driver
      const { data: allTrips } = await listTrips();
      const myActive = allTrips.find(t => 
        t.driver_id === user.id && 
        ['CLIENT_ACCEPTED', 'IN_PROGRESS'].includes(t.status)
      );

      if (myActive) {
        setActiveTrip(myActive);
        setTrips([]); // Don't show other pending trips
        setSheetState('open');
      } else {
        setActiveTrip(null);
        setRouteCoords([]);
        const { data: pending } = await listPendingTrips(user.id, driverLoc.lat, driverLoc.lon);
        setTrips(pending);
      }
    } catch (err) {
      console.error('Error fetching driver home data:', err);
    }
  };

  const handleAccept = async (tripId) => {
    if (!activeShift) {
      alert('Você precisa estar em um turno ativo para aceitar viagens.');
      return;
    }

    showConfirm(
      'Aceitar Viagem?',
      'Deseja aceitar este pedido de viagem?',
      async () => {
        try {
          await acceptTrip(tripId, user.id, activeShift.id);
          alert('Viagem aceita com sucesso! Aguarde a confirmação do passageiro.');
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
        return;
      }
      
      let origin, dest;
      if (activeTrip.status === 'CLIENT_ACCEPTED') {
        // Route to the client
        origin = `${driverLoc.lat},${driverLoc.lon}`;
        dest = activeTrip.originCoords;
      } else if (activeTrip.status === 'IN_PROGRESS') {
        // Route to destination
        origin = `${driverLoc.lat},${driverLoc.lon}`;
        dest = activeTrip.destCoords;
      }

      if (origin && dest) {
        try {
          const { data } = await getRouteGeometry(origin, dest);
          if (data.geometry) {
            setRouteCoords(decodePolyline(data.geometry));
          }
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
              {/* Pickup location marker */}
              {activeTrip.originCoords && (
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
          <h2 className="sheet-title">
            {activeTrip ? 'Viagem Ativa' : 'Escolher Passageiro'}
          </h2>
        </div>

        <div className="passenger-list">
          {activeTrip ? (
            <div className="active-trip-card">
              <div className="card-info">
                <div className="card-top">
                  <span className="passenger-name">{activeTrip.client_name}</span>
                  <span className="trip-status-badge">
                    {activeTrip.status === 'CLIENT_ACCEPTED' ? 'A caminho' : 'Em curso'}
                  </span>
                </div>
                <div className="card-bottom">
                  <div className="address-item">
                    <MapPin size={16} className="text-red" />
                    <span>{activeTrip.originAddress}</span>
                  </div>
                  {activeTrip.status === 'IN_PROGRESS' && (
                    <div className="address-item">
                      <Navigation size={16} className="text-green" />
                      <span>{activeTrip.destAddress}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="active-trip-actions">
                {activeTrip.status === 'CLIENT_ACCEPTED' ? (
                  <button className="btn-pickup" onClick={handlePickup}>
                    <Navigation size={20} />
                    Recolher Passageiro
                  </button>
                ) : (
                  <button className="btn-complete" onClick={handleComplete}>
                    <CheckCircle size={20} />
                    Concluir Viagem
                  </button>
                )}
              </div>
            </div>
          ) : trips.length === 0 ? (
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
                <div key={trip.id} className="passenger-card" onClick={() => handleAccept(trip.id)}>
                  <div className="card-icon" style={{ color }}>
                    <MapPin size={24} fill="currentColor" />
                  </div>
                  <div className="card-info">
                    <div className="card-top">
                      <span className="passenger-name">{trip.client_name} - {dist}km de si</span>
                    </div>
                    <div className="card-bottom">
                      <span className="passenger-address">{trip.originAddress}</span>
                      <span className="trip-distance">{trip.kilometers}km</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>

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

