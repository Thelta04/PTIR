import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, Bell, Target, ChevronLeft, Star, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MapaPedido from '../../components/MapaPedido';
import { cancelTrip, listTrips, clientAcceptTrip, getRouteGeometry, startTripPayment, getTripPaymentStatus, rateTrip, listRatings } from '../../api/client';
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
  const [loading, setLoading] = useState(true);

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
      alert('Erro ao iniciar pagamento. Verifique se as chaves do Stripe estão configuradas no backend.');
    }
  };

  // Handle return from Stripe
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const sessionId = query.get('session_id');
    const isSuccess = query.get('payment_success');

    if (sessionId && isSuccess && tripId) {
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
      showConfirm(
        'Recusar Motorista?',
        'Tem a certeza que deseja recusar este motorista? A sua viagem será cancelada.',
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
          setStatus('in_progress');
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

  // Driver location updates from backend would be handled here
  // (Requires real-time socket or polling endpoint, currently missing in API)
  useEffect(() => {
    // Left intentionally blank to enforce the removal of mockup
  }, [status, activeTrip, driverPos]);

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
                <h3>{activeTrip?.driver_name || 'Motorista'}</h3>
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
              <div className="car-icon">🚗</div>
            </div>

            <div className="trip-specs" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '10px',
              padding: '15px 0',
              borderTop: '1px solid #f0f0f0',
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
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', flexShrink: 0, marginTop: '6px' }}></div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px', marginBottom: '2px' }}>Origem</span>
                  <span style={{ fontWeight: '500', lineHeight: '1.3' }}>
                    {simplifyAddress(activeTrip?.originAddress)}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', flexShrink: 0, marginTop: '6px' }}></div>
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

            <div className="trip-progress-pulse" style={{ margin: '20px 0', padding: '0 5px' }}>
              <motion.div
                animate={{
                  opacity: [0.3, 1, 0.3],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 3,
                  ease: "easeInOut"
                }}
                style={{
                  height: '8px',
                  width: '100%',
                  background: '#f1cf58',
                  borderRadius: '4px',
                  boxShadow: '0 0 10px rgba(241, 207, 88, 0.2)'
                }}
              />
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

            <div className="trip-progress-pulse" style={{ margin: '20px 0', padding: '0 5px' }}>
              <motion.div
                animate={{
                  opacity: [0.3, 1, 0.3],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 3,
                  ease: "easeInOut"
                }}
                style={{
                  height: '8px',
                  width: '100%',
                  background: '#f1cf58',
                  borderRadius: '4px',
                  boxShadow: '0 0 10px rgba(241, 207, 88, 0.2)'
                }}
              />
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
        return (
          <div className="status-panel paid" style={{ textAlign: 'center' }}>
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

            <div className="payment-actions" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                className="panel-btn panel-btn--accept"
                onClick={handleStripePayment}
                style={{ width: '100%', height: 'auto', padding: '18px 0', fontSize: '1.1rem' }}
              >
                PAGAR COM STRIPE
              </button>
            </div>
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
        <button className="menu-btn" onClick={() => setIsMenuOpen(true)}>
          <Menu size={24} color="#000" />
        </button>

        <div className="client-brand">
          <span className="client-brand-name">TUXY</span>
        </div>

        <div
          className="user-name-container"
          onClick={() => setIsProfileModalOpen(true)}
          style={{ cursor: 'pointer' }}
        >
          <span className="user-name-text">{user?.name?.split(' ')[0]}</span>
          <img
            src={`/PFPs/${user?.profile_pic || 1}.jpg`}
            alt="Profile"
            className="user-pfp-small"
          />
        </div>
      </header>

      <main className="client-main-content">
        <div className="map-wrapper">
          <MapaPedido
            origem={origem}
            destino={destino}
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
            <motion.div
              className="drawer-menu"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
            >
              <div className="drawer-header">
                <span className="drawer-title">Menu</span>
                <button className="drawer-close" onClick={() => setIsMenuOpen(false)}>
                  <ChevronLeft size={24} />
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
              </nav>

              <div className="drawer-footer">
                <button className="drawer-logout" onClick={handleLogout}>
                  Terminar Sessão
                </button>
              </div>
            </motion.div>
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
