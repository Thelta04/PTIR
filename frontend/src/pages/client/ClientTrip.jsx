import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, Bell, Target, ChevronLeft, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MapaPedido from '../../components/MapaPedido';
import { cancelTrip, listTrips, clientAcceptTrip } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import './client.css';

export default function ClientTrip() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { tripId, origem, destino } = location.state || {};

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [status, setStatus] = useState('searching'); // 'searching', 'accepted', 'in_progress'

  // If no trip state, redirect back
  useEffect(() => {
    if (!location.state || !tripId) {
      navigate('/client');
    }
  }, [location.state, navigate, tripId]);

  // Polling for trip status
  useEffect(() => {
    let interval;
    if (tripId) {
      interval = setInterval(async () => {
        try {
          const { data } = await listTrips();
          const updatedTrip = data.find(t => t.id === tripId);

          if (updatedTrip) {
            setActiveTrip(updatedTrip);
            if (updatedTrip.status === 'DRIVER_ACCEPTED') {
              setStatus('accepted');
            } else if (updatedTrip.status === 'CLIENT_ACCEPTED' || updatedTrip.status === 'IN_PROGRESS') {
              setStatus('in_progress');
            } else if (updatedTrip.status === 'CANCELED' || updatedTrip.status === 'COMPLETED') {
              navigate('/client');
            }
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [tripId, navigate]);

  const handleCancel = async () => {
    if (tripId) {
      try {
        await cancelTrip(tripId);
        navigate('/client');
      } catch (error) {
        console.error("Error canceling trip:", error);
        alert("Failed to cancel trip.");
      }
    } else {
      navigate('/client');
    }
  };

  const handleClientAccept = async () => {
    if (!tripId) return;
    try {
      await clientAcceptTrip(tripId);
      setStatus('in_progress');
    } catch (err) {
      alert('Error accepting trip');
    }
  };

  const handleMenuClick = (path) => {
    setIsMenuOpen(false);
    if (path) navigate(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/login-client');
  };

  const renderStatusPanel = () => {
    switch (status) {
      case 'accepted':
        return (
          <div className="status-panel accepted">
            <div className="driver-header-info">
              <div className="driver-avatar">
                <img src="https://via.placeholder.com/60" alt="Driver" />
              </div>
              <div className="driver-details">
                <h3>{activeTrip?.driver_name || 'Motorista'}</h3>
                <div className="rating">
                  <Star size={14} fill="#f1af3d" color="#f1af3d" />
                  <span>4.9 (531)</span>
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

      case 'in_progress':
        return (
          <div className="status-panel in-progress">
            <h2 className="panel-title">Viagem em curso</h2>
            <p>O seu motorista está a caminho!</p>
            <div className="driver-mini-card">
              <span className="car-emoji">🚗</span>
              <strong>{activeTrip?.driver_name}</strong>
              <span className="plate-badge">{activeTrip?.taxi_plate}</span>
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

        <button className="bell-btn">
          <Bell size={24} color="#000" />
        </button>
      </header>

      <main className="client-main-content">
        <div className="map-wrapper">
          <MapaPedido
            origem={origem}
            destino={destino}
            onEscolherPonto={() => {}} 
          />
        </div>

        {/* Dynamic Status Panel */}
        <section className="trip-status-overlay">
          {renderStatusPanel()}
        </section>

        <button className="gps-btn" title="Use current location">
          <Target size={24} color="#000" />
        </button>
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
                <button className="drawer-link" onClick={() => handleMenuClick('/client')}>
                  Request Trip
                </button>
                <button className="drawer-link" onClick={() => handleMenuClick('/client')}>
                  Reservations
                </button>
                <button className="drawer-link" onClick={() => handleMenuClick('/client')}>
                  History
                </button>
              </nav>

              <div className="drawer-footer">
                <button className="drawer-logout" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

