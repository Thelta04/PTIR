import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { listPendingTrips, listShifts, acceptTrip } from '../../api/client';
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

export default function DriverHomeView() {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [driverLoc] = useState({ lat: 38.7115, lon: -9.1360 }); // Mocked near client origin

  // Sheet states: 'closed' (peek), 'open' (expanded)
  const [sheetState, setSheetState] = useState('closed');

  const fetchData = async () => {
    try {
      const { data: shifts } = await listShifts(user.id);
      const active = shifts.find(s => s.real_interval && !s.real_interval.end_time);
      setActiveShift(active);

      const { data: pending } = await listPendingTrips(user.id, driverLoc.lat, driverLoc.lon);
      setTrips(pending);
    } catch (err) {
      console.error('Error fetching driver home data:', err);
    }
  };

  const handleAccept = async (tripId) => {
    if (!activeShift) {
      alert('Você precisa estar em um turno ativo para aceitar viagens.');
      return;
    }
    try {
      await acceptTrip(tripId, user.id, activeShift.id);
      alert('Viagem aceita com sucesso!');
      fetchData();
    } catch (err) {
      console.error('Error accepting trip:', err);
      alert('Erro ao aceitar viagem.');
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user]);

  const sheetVariants = {
    closed: { y: 'calc(100% - 160px)' }, // Peeks 160px instead of 100px
    open: { y: '15%' }, // Expanded
  };

  return (
    <div className="driver-home-container">
      <div className="map-full">
        <MapContainer center={[driverLoc.lat, driverLoc.lon]} zoom={14} zoomControl={false} style={{ height: '100%', width: '100%', zIndex: 0 }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />

          <Marker position={[driverLoc.lat, driverLoc.lon]} icon={carIcon}>
            <Popup>Você está aqui</Popup>
          </Marker>

          {trips.map((trip, index) => {
            if (!trip.originCoords) return null;
            const [tLat, tLon] = trip.originCoords.split(',').map(Number);
            if (isNaN(tLat) || isNaN(tLon)) return null;
            return (
              <Marker key={trip.id} position={[tLat, tLon]} icon={createIcon(pinColors[index % pinColors.length])}>
                <Popup>{trip.client_name}</Popup>
              </Marker>
            );
          })}
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
    </div>
  );
}
