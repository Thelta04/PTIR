import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, Bell, Target, ChevronLeft, Star, Clock, Flag, X, MapPin, Car } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MapaPedido from '../../components/MapaPedido';
import { cancelTrip, listTrips, clientAcceptTrip, getRouteGeometry, getTripDriverLocation, startTripPayment, getTripPaymentStatus, rateTrip, listRatings } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { decodePolyline } from '../../utils/map';
import ConfirmationModal from '../../components/ConfirmationModal';
import ProfileModal from '../../components/ProfileModal';
import RatingModal from '../../components/RatingModal';
import './client.css';

export default function ClientTrip() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const queryParams = new URLSearchParams(location.search);
  const tripIdFromUrl = queryParams.get('trip_id');

  const [tripId, setTripId] = useState(location.state?.tripId || (tripIdFromUrl ? parseInt(tripIdFromUrl, 10) : null));
  const origem = location.state?.origem;
  const destino = location.state?.destino;

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const activeTripRef = useRef(null);
  const [status, setStatus] = useState('searching'); // 'searching', 'accepted', 'waiting_pickup', 'in_progress', 'waiting_payment', 'paid'
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [isPaidPanelClosed, setIsPaidPanelClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPaymentButtonDisabled, setIsPaymentButtonDisabled] = useState(false);

  const [driverPos, setDriverPos] = useState(null);
  const [driverRating, setDriverRating] = useState('N/A');
  const [driverRatingCount, setDriverRatingCount] = useState(0);
  const [routeCoords, setRouteCoords] = useState([]);
  const [eta, setEta] = useState(null);
  const lastFetchedRouteKey = useRef('');

  useEffect(() => {
    activeTripRef.current = activeTrip;
  }, [activeTrip]);

  const simplifyAddress = (addr) => {
    if (!addr || addr === 'Current Location' || addr === 'Localização Atual') return addr;
    const parts = addr.split(',').map(p => p.trim());
    const streetPrefixes = ['Rua', 'Avenida', 'Av.', 'Travessa', 'Tv.', 'Praça', 'Largo', 'Estrada', 'Azinhaga', 'Caminho', 'Beco', 'Calçada'];
    let streetIdx = -1;
    for (let i = 0; i < Math.min(parts.length, 3); i++) {
      if (streetPrefixes.some(prefix => parts[i].toLowerCase().startsWith(prefix.toLowerCase()))) {
        streetIdx = i;
        break;
      }
    }
    if (streetIdx === -1 && parts.length > 2 && /^\d/.test(parts[1])) streetIdx = 2;
    if (streetIdx === -1) streetIdx = 0;
    let street = parts[streetIdx];
    if (streetIdx > 0 && /^\d/.test(parts[streetIdx - 1])) street = `${parts[streetIdx - 1]} ${street}`;
    const freguesia = parts[streetIdx + 1] || '';
    const concelho = parts[streetIdx + 2] || '';
    return [street, freguesia, concelho].filter(Boolean).join(', ');
  };

  const parseCoords = (coords) => {
    if (!coords) return null;
    const [lat, lon] = coords.split(',').map(Number);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return { lat, lon };
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

  // Modal State
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
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

  // Recover tripId or redirect
  useEffect(() => {
    if (!tripId) {
      const recoverTrip = async () => {
        try {
          const { data } = await listTrips();
          const mine = data.filter(t =>
            t.client_id === user.id &&
            ['PENDING', 'DRIVER_ACCEPTED', 'CLIENT_ACCEPTED', 'IN_PROGRESS', 'WAITING_PAYMENT', 'PAID'].includes(t.status)
          );
          if (mine.length > 0) {
            setTripId(mine[0].id);
          } else {
            navigate('/client');
          }
        } catch (err) {
          navigate('/client');
        }
      };
      recoverTrip();
    }
  }, [tripId, navigate, user.id]);

  // Polling for trip status
  useEffect(() => {
    let interval;
    if (tripId) {
      const fetchData = async () => {
        try {
          const { data } = await listTrips();
          const updatedTrip = data.find(t => t.id === tripId);

          if (updatedTrip) {
            setActiveTrip(updatedTrip);
            if (updatedTrip.status === 'DRIVER_ACCEPTED') {
              setStatus('accepted');
            } else if (updatedTrip.status === 'CLIENT_ACCEPTED') {
              setStatus('waiting_pickup');
            } else if (updatedTrip.status === 'IN_PROGRESS') {
              setStatus('in_progress');
            } else if (updatedTrip.status === 'WAITING_PAYMENT') {
              setStatus('waiting_payment');
            } else if (updatedTrip.status === 'PAID') {
              setStatus('paid');
            } else if (updatedTrip.status === 'COMPLETED') {
              setIsRatingModalOpen(true);
            } else if (updatedTrip.status === 'CANCELED') {
              navigate('/client');
            }
          }
        } catch (err) {
          console.error('Polling error:', err);
        } finally {
          setLoading(false);
        }
      };

      fetchData(); // Initial fetch
      interval = setInterval(fetchData, 3000);
    }
    return () => clearInterval(interval);
  }, [tripId, navigate]);

  const handleStripePayment = async () => {
    try {
      const successUrl = `${window.location.origin}/client/trip?trip_id=${tripId}&payment_success=true&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${window.location.origin}/client/trip?trip_id=${tripId}&payment_cancel=true`;

      const { data } = await startTripPayment(tripId, successUrl, cancelUrl);
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      console.error('Stripe error:', err);
      alert(err.response?.data?.error || 'Erro ao iniciar pagamento. Verifique se as chaves do Stripe estão configuradas no backend.');
    }
  };

  // Handle return from Stripe
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const sessionId = query.get('session_id');
    const isSuccess = query.get('payment_success');

    if (sessionId && isSuccess && tripId) {
      setIsPaymentButtonDisabled(true);
      setTimeout(() => setIsPaymentButtonDisabled(false), 5000);

      const verifyPayment = async () => {
        try {
          const { data } = await getTripPaymentStatus(tripId, sessionId);
          if (data.paid) {
            // Clear URL params to stop verifying, let polling show the PAID screen
            navigate(location.pathname, { replace: true, state: { ...location.state, tripId } });
          }
        } catch (err) {
          console.error('Payment verification error:', err);
        }
      };
      verifyPayment();
    }
  }, [location.search, tripId, navigate]);

  const handleCancel = async () => {
    if (tripId) {
      const isSearching = status === 'searching';
      showConfirm(
        isSearching ? 'Cancelar Pedido?' : 'Recusar Motorista?',
        isSearching 
          ? 'Tem a certeza que deseja cancelar o seu pedido de viagem?' 
          : 'Tem a certeza que deseja recusar este motorista? A sua viagem será cancelada.',
        async () => {
          try {
            await cancelTrip(tripId);
            navigate('/client');
          } catch (error) {
            console.error("Error canceling trip:", error);
            alert("Erro ao cancelar viagem.");
          }
        }
      );
    } else {
      navigate('/client');
    }
  };

  const handleClientAccept = async () => {
    if (!tripId) return;

    showConfirm(
      'Confirmar Motorista?',
      'Deseja aceitar este motorista para a sua viagem?',
      async () => {
        try {
          await clientAcceptTrip(tripId);
          setStatus('waiting_pickup');
        } catch (err) {
          alert('Erro ao aceitar viagem');
        }
      }
    );
  };

  const handleRate = async (score) => {
    if (score > 0) {
      try {
        await rateTrip(tripId, score);
      } catch (err) {
        console.error('Error rating trip:', err);
      }
    }
    setIsRatingModalOpen(false);
    navigate('/client');
  };

  useEffect(() => {
    if (!tripId || !['accepted', 'waiting_pickup'].includes(status)) {
      setDriverPos(null);
      if (status !== 'in_progress') setEta(null);
      return undefined;
    }

    let isMounted = true;
    const fetchDriverLocation = async () => {
      try {
        const { data } = await getTripDriverLocation(tripId);
        if (isMounted && data.available) {
          setDriverPos({ lat: data.lat, lon: data.lon });
        } else if (isMounted) {
          setDriverPos(null);
          setEta(null);
          setRouteCoords([]);
        }
      } catch (err) {
        if (isMounted) {
          setDriverPos(null);
          setEta(null);
          setRouteCoords([]);
        }
      }
    };

    fetchDriverLocation();
    const intervalId = setInterval(fetchDriverLocation, 5000);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [tripId, status]);

  useEffect(() => {
    const fetchRoute = async () => {
      if (driverPos && activeTrip && (status === 'accepted' || status === 'waiting_pickup')) {
        const routeKey = `pickup-${status}-${driverPos.lat},${driverPos.lon}`;
        if (lastFetchedRouteKey.current === routeKey) return;

        try {
          const originStr = `${driverPos.lat},${driverPos.lon}`;
          const destStr = activeTrip.originCoords;
          const { data } = await getRouteGeometry(originStr, destStr);
          if (data.geometry) {
            setRouteCoords(decodePolyline(data.geometry));
          } else if (data.is_fallback) {
            // Straight line fallback
            const destCoords = activeTrip.originCoords.split(',').map(Number);
            setRouteCoords([[driverPos.lat, driverPos.lon], [destCoords[0], destCoords[1]]]);
          }
          lastFetchedRouteKey.current = routeKey;
          if (data.duration) {
            setEta(Math.round(data.duration / 60));
          }
        } catch (err) {
          console.error('Error fetching driver route:', err);
        }
      } else if (status === 'in_progress' && activeTrip) {
        const routeKey = `trip-${activeTrip.id}`;
        if (lastFetchedRouteKey.current === routeKey) return;

        // Trip route (Origin to Destination)
        try {
          const { data } = await getRouteGeometry(activeTrip.originCoords, activeTrip.destCoords);
          if (data.geometry) {
            setRouteCoords(decodePolyline(data.geometry));
          } else if (data.is_fallback) {
            const o = activeTrip.originCoords.split(',').map(Number);
            const d = activeTrip.destCoords.split(',').map(Number);
            setRouteCoords([[o[0], o[1]], [d[0], d[1]]]);
          }
          lastFetchedRouteKey.current = routeKey;
          if (data.duration) {
            setEta(Math.round(data.duration / 60));
          }
          setDriverPos(null);
        } catch (err) {
          console.error('Error fetching trip route:', err);
        }
      }
    };
    fetchRoute();
  }, [driverPos, activeTrip, status]);

  const handleMenuClick = (path) => {
    setIsMenuOpen(false);
    if (path) navigate(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    if (activeTrip?.driver_id) {
      const fetchDriverRating = async () => {
        try {
          const { data } = await listRatings(activeTrip.driver_id);
          if (data.length > 0) {
            const sum = data.reduce((acc, r) => acc + r.score, 0);
            setDriverRating((sum / data.length).toFixed(1));
            setDriverRatingCount(data.length);
          } else {
            setDriverRating('N/A');
            setDriverRatingCount(0);
          }
        } catch (err) {
          console.error('Error fetching driver ratings:', err);
        }
      };
      fetchDriverRating();
    }
  }, [activeTrip?.driver_id]);

  const translateEngine = (engine) => {
    if (!engine) return 'Elétrico';
    const mapping = {
      'Electric': 'Elétrico',
      'Gasoline': 'Gasolina',
      'Diesel': 'Diesel',
      'Hybrid': 'Híbrido'
    };
    return mapping[engine] || engine;
  };

  const mapOrigem = origem || parseCoords(activeTrip?.originCoords);
  const mapDestino = destino || parseCoords(activeTrip?.destCoords);
  const driverDistanceKm = driverPos && mapOrigem
    ? haversine(driverPos.lat, driverPos.lon, mapOrigem.lat, mapOrigem.lon).toFixed(1)
    : null;
  const canPayActiveTrip = activeTrip && activeTrip.client_id === user?.id;

  const renderStatusPanel = () => {
    if (loading) return null;

    switch (status) {
      case 'accepted':
        return (
          <div className="status-panel accepted">
            <div className="driver-header-info">
              <div className="driver-avatar">
                <img src={`/PFPs/${activeTrip?.driver_pfp || 1}.jpg`} alt="Driver" />
              </div>
              <div className="driver-details">
                <h2>{activeTrip?.driver_name || 'Motorista'}</h2>
                <div className="rating">
                  <Star size={14} fill="#f1af3d" color="#f1af3d" />
                  <span>{driverRating} ({driverRatingCount})</span>
                </div>
              </div>
            </div>

            <div className="car-details">
              <div className="car-text">
                <strong>{activeTrip?.taxi_brand || 'Tesla'} {activeTrip?.taxi_model || 'Model 3'}</strong>
                <span>{activeTrip?.taxi_plate || 'AA-00-BB'}</span>
              </div>
              <div className="car-icon">
                <Car size={32} color="#f1cf58" />
              </div>
            </div>

            <div className="trip-specs" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              padding: '15px 0',
              borderTop: '1px solid #f0f0f0',
              textAlign: 'center'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px' }}>Distância</span>
                <span style={{ fontSize: '1.1rem', color: '#000', fontWeight: '700' }}>
                  {driverDistanceKm ? `${driverDistanceKm} km` : '--'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px' }}>Chegada</span>
                <span style={{ fontSize: '1.1rem', color: '#000', fontWeight: '700' }}>
                  {eta !== null ? `${eta} min` : '--'}
                </span>
              </div>
            </div>

            <div className="trip-specs" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '10px',
              padding: '15px 0',
              borderBottom: '1px solid #f0f0f0',
              textAlign: 'center'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px' }}>Conforto</span>
                <span style={{ fontSize: '1.1rem', color: '#000', fontWeight: '700' }}>{activeTrip?.comfort_level === 'luxury' ? 'Luxo' : 'Básico'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px' }}>Motor</span>
                <span style={{ fontSize: '1.1rem', color: '#000', fontWeight: '700' }}>{activeTrip?.taxi_engine === "combustion" ? "Combustão" : 'Elétrico'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px' }}>Lugares</span>
                <span style={{ fontSize: '1.1rem', color: '#000', fontWeight: '700' }}>{activeTrip?.taxi_passengers || activeTrip?.num_passengers}</span>
              </div>
            </div>

            <div className="trip-route-summary" style={{ fontSize: '1.05rem', color: '#333', margin: '15px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6', flexShrink: 0, marginTop: '6px' }}></div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px', marginBottom: '2px' }}>Origem</span>
                  <span style={{ fontWeight: '500', lineHeight: '1.3' }}>
                    {simplifyAddress(activeTrip?.originAddress)}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }}>
                  <MapPin size={16} fill="#ef4444" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px', marginBottom: '2px' }}>Destino</span>
                  <span style={{ fontWeight: '500', lineHeight: '1.3' }}>
                    {simplifyAddress(activeTrip?.destAddress)}
                  </span>
                </div>
              </div>
            </div>

            <div className="price-display-banner" style={{
              background: '#fdf2b3',
              padding: '12px',
              borderRadius: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '15px'
            }}>
              <span style={{ fontWeight: '700', color: '#856404', textTransform: 'uppercase', fontSize: '0.85rem' }}>Preço</span>
              <span style={{ fontWeight: '900', fontSize: '1.4rem', color: '#000' }}>€{activeTrip?.price}</span>
            </div>

            <div className="panel-actions">
              <button className="panel-btn panel-btn--refuse" onClick={handleCancel}>
                Recusar
              </button>
              <button className="panel-btn panel-btn--accept" onClick={handleClientAccept}>
                Aceitar
              </button>
            </div>
          </div>
        );

      case 'waiting_pickup':
        return (
          <div className="status-panel waiting-pickup">
            <h2 className="panel-title" style={{ textAlign: 'center', width: '100%' }}>O motorista está a caminho</h2>

            {eta !== null && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontWeight: '700',
                fontSize: '1.2rem',
                margin: '10px 0'
              }}>
                <Clock size={20} />
                Chega em {eta} min
              </div>
            )}

            <div className="trip-progress-container" style={{ margin: '30px 10px', position: 'relative' }}>
              <div style={{ height: '4px', width: '100%', background: '#e0e0e0', borderRadius: '2px', position: 'relative' }}>
                <motion.div
                  animate={{ width: ['0%', '100%', '0%'] }}
                  transition={{ repeat: Infinity, duration: 16, ease: "linear" }}
                  style={{
                    height: '100%',
                    background: '#f1cf58',
                    borderRadius: '2px',
                    position: 'relative'
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    right: '-12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#000'
                  }}>
                    <motion.div
                      animate={{ scaleX: [1, 1, -1, -1] }}
                      transition={{ repeat: Infinity, duration: 16, times: [0, 0.499, 0.5, 1], ease: "linear" }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#000" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.6 2 12.3 2 13v3c0 .6.4 1 1 1h2m14 0c0 1.1-.9 2-2 2s-2-.9-2-2 1.1-2 2-2 2 .9 2 2zM7 17c0 1.1-.9 2-2 2s-2-.9-2-2 1.1-2 2-2 2 .9 2 2z"/></svg>
                    </motion.div>
                  </div>
                </motion.div>
              </div>
            </div>

            <div className="driver-mini-card" style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gridTemplateRows: 'auto auto',
              gap: '4px 12px',
              alignItems: 'center',
              padding: '12px 16px'
            }}>
              <img
                src={`/PFPs/${activeTrip?.driver_pfp || 1}.jpg`}
                alt="Driver"
                className="user-pfp-small"
                style={{ width: '44px', height: '44px', gridRow: 'span 2' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: '2' }}>
                <strong style={{ fontSize: '0.95rem' }}>{activeTrip?.driver_name}</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', color: '#f1af3d', fontWeight: 'bold' }}>
                  <Star size={10} fill="#f1af3d" color="#f1af3d" />
                  {driverRating} ({driverRatingCount})
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: '2' }}>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>{activeTrip?.taxi_brand} {activeTrip?.taxi_model}</span>
                <span className="plate-badge" style={{ margin: 0 }}>{activeTrip?.taxi_plate}</span>
              </div>
            </div>
          </div>
        );

      case 'in_progress':
        return (
          <div className="status-panel in-progress">
            <h2 className="panel-title" style={{ textAlign: 'center', width: '100%' }}>Viagem em curso</h2>

            {eta !== null && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                color: '#000',
                fontWeight: '700',
                fontSize: '1.2rem',
                margin: '10px 0'
              }}>
                <Target size={20} />
                Destino em {eta} min
              </div>
            )}

            <div className="trip-progress-container" style={{ margin: '30px 20px 30px 10px', position: 'relative' }}>
              <div style={{ height: '4px', width: '100%', background: '#e0e0e0', borderRadius: '2px', position: 'relative' }}>
                <motion.div
                  animate={{ width: ['0%', '100%'] }}
                  transition={{ repeat: Infinity, duration: 16, ease: "linear" }}
                  style={{
                    height: '100%',
                    background: '#f1cf58',
                    borderRadius: '2px',
                    position: 'relative',
                    zIndex: 2
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    right: '-12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#000'
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#000" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.6 2 12.3 2 13v3c0 .6.4 1 1 1h2m14 0c0 1.1-.9 2-2 2s-2-.9-2-2 1.1-2 2-2 2 .9 2 2zM7 17c0 1.1-.9 2-2 2s-2-.9-2-2 1.1-2 2-2 2 .9 2 2z"/></svg>
                  </div>
                </motion.div>
                
                <div style={{
                  position: 'absolute',
                  right: '-18px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 1
                }}>
                  <Flag size={20} color="#000" />
                </div>
              </div>
            </div>

            <p style={{ textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>A caminho do seu destino...</p>

            <div className="driver-mini-card" style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gridTemplateRows: 'auto auto',
              gap: '4px 12px',
              alignItems: 'center',
              padding: '12px 16px'
            }}>
              <img
                src={`/PFPs/${activeTrip?.driver_pfp || 1}.jpg`}
                alt="Driver"
                className="user-pfp-small"
                style={{ width: '48px', height: '48px', gridRow: 'span 2' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: '2' }}>
                <strong style={{ fontSize: '1rem' }}>{activeTrip?.driver_name}</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#f1af3d', fontWeight: 'bold' }}>
                  <Star size={12} fill="#f1af3d" color="#f1af3d" />
                  {driverRating} ({driverRatingCount})
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: '2' }}>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>{activeTrip?.taxi_brand} {activeTrip?.taxi_model}</span>
                <span className="plate-badge" style={{ margin: 0 }}>{activeTrip?.taxi_plate}</span>
              </div>
            </div>
          </div>
        );

      case 'paid':
        if (isPaidPanelClosed) return null;
        return (
          <div className="status-panel paid" style={{ textAlign: 'center', position: 'relative' }}>
            <button 
              onClick={() => {
                setIsPaidPanelClosed(true);
                setIsRatingModalOpen(true);
              }}
              aria-label="Fechar"
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                borderRadius: '50%'
              }}
            >
              <X size={20} />
            </button>
            <div className="success-icon" style={{ fontSize: '3rem', marginBottom: '10px' }}>🎉</div>
            <h2 className="panel-title">Obrigada por viajar com a TUXY!</h2>
            <p style={{ color: '#666', marginBottom: '15px' }}>O seu pagamento foi recebido com sucesso.</p>
            <p style={{ color: '#666', marginBottom: '20px' }}>O motorista está a emitir a sua fatura.</p>
          </div>
        );

      case 'waiting_payment':
        return (
          <div className="status-panel waiting-payment" style={{ textAlign: 'center' }}>
            <h2 className="panel-title">Viagem Concluída</h2>
            <p style={{ color: '#666', marginBottom: '15px' }}>Obrigado por viajar com a TUXY!</p>

            <div className="payment-summary" style={{
              background: '#f9f9f9',
              padding: '20px',
              borderRadius: '16px',
              border: '2px solid #f1cf58',
              marginBottom: '20px',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontWeight: '600' }}>Preço Final:</span>
                <span style={{ fontWeight: '800', fontSize: '1.2rem' }}>€{activeTrip?.price}</span>
              </div>
              <div style={{ fontSize: '0.9rem', color: '#666', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div><strong>De:</strong> {simplifyAddress(activeTrip?.originAddress)}</div>
                <div><strong>Para:</strong> {simplifyAddress(activeTrip?.destAddress)}</div>
              </div>
            </div>

            {canPayActiveTrip ? (
              <div className="payment-actions" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  className="panel-btn panel-btn--accept"
                  onClick={handleStripePayment}
                  disabled={isPaymentButtonDisabled}
                  style={{ 
                    width: '100%', 
                    height: 'auto', 
                    padding: '18px 0', 
                    fontSize: '1.1rem',
                    opacity: isPaymentButtonDisabled ? 0.6 : 1,
                    cursor: isPaymentButtonDisabled ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isPaymentButtonDisabled ? 'A VERIFICAR...' : 'Pagar Viagem'}
                </button>
              </div>
            ) : (
              <p style={{ color: '#666', margin: 0 }}>
                Apenas o cliente desta viagem pode efetuar o pagamento.
              </p>
            )}
          </div>
        );

      default:
        return (
          <div className="status-panel searching">
            <h2 className="panel-title">A procurar um motorista...</h2>
            <div className="pulse-loader">
              <div className="pulse-ring"></div>
            </div>
            <button className="panel-btn panel-btn--cancel" onClick={handleCancel}>
              Cancelar
            </button>
          </div>
        );
    }
  };

  return (
    <div className="client-layout">
      <header className="client-header">
        <button className="menu-btn" aria-label="Abrir menu" onClick={() => setIsMenuOpen(true)}>
          <Menu size={24} color="#000" aria-hidden="true" />
        </button>

        <div className="client-brand" onClick={() => navigate('/client')} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: '8px', height: '40px', alignItems: 'center' }}>
            <img src="/icon_small.png" alt="TUXY Icon" style={{ width: '28px', height: '28px' }} />
            <h1 className="client-brand-name" style={{ margin: 0, lineHeight: 1 }}>TUXY</h1>
          </div>
        </div>

        <div
          className="user-name-container"
          onClick={() => setIsProfileModalOpen(true)}
          style={{ cursor: 'pointer', gap: '4px' }}
        >
          <div style={{ height: '40px', display: 'flex', alignItems: 'center' }}>
            <img
              src={`/PFPs/${user?.profile_pic || 1}.jpg`}
              alt="Profile"
              className="user-pfp-small"
              style={{ margin: 0 }}
            />
          </div>
          <span className="user-name-text" style={{ fontSize: '0.85rem', fontWeight: 'bold', lineHeight: 1, height: '14px', display: 'flex', alignItems: 'center' }}>{user?.name?.split(' ')[0]}</span>
        </div>
      </header>

      <main className="client-main-content">
        <div className="map-wrapper">
          <MapaPedido
            origem={mapOrigem}
            destino={mapDestino}
            onEscolherPonto={() => { }}
            routeCoords={routeCoords}
            carPos={driverPos}
            isInProgress={status === 'in_progress'}
          />
        </div>

        {/* Dynamic Status Panel */}
        <section className="trip-status-overlay">
          {renderStatusPanel()}
        </section>

      </main>

      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              className="drawer-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
            />
            <motion.aside
              className="drawer-menu"
              role="dialog"
              aria-modal="true"
              aria-labelledby="drawer-title"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
            >
              <div className="drawer-header">
                <h2 id="drawer-title" className="drawer-title" style={{ margin: 0, fontSize: '1.2rem' }}>Menu</h2>
                <button className="drawer-close" aria-label="Fechar menu" onClick={() => setIsMenuOpen(false)}>
                  <ChevronLeft size={24} aria-hidden="true" />
                </button>
              </div>

              <nav className="drawer-nav">
                <button className="drawer-link drawer-link--active" onClick={() => handleMenuClick('/client')}>
                  Início
                </button>
                <button className="drawer-link" onClick={() => handleMenuClick('/client/scheduled')}>
                  Agendar Viagens
                </button>
                <button className="drawer-link" onClick={() => handleMenuClick('/client/history')}>
                  Histórico
                </button>
                <button className="drawer-link" onClick={() => handleMenuClick('/client/invoices')}>
                  Faturas
                </button>
              </nav>

              <div className="drawer-footer">
                <button className="drawer-logout" onClick={handleLogout}>
                  Terminar Sessão
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onCancel={closeModal}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        forcedType="CLIENT"
      />
      <RatingModal
        isOpen={isRatingModalOpen}
        onClose={() => handleRate(0)}
        onRate={handleRate}
        driverName={activeTrip?.driver_name || 'Motorista'}
      />
    </div>
  );
}
