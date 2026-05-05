import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, Bell, Target, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MapaPedido from '../../components/MapaPedido';
import { cancelTrip } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import './client.css';

export default function ClientTrip() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { tripId, origem, destino } = location.state || {};

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // If no trip state, redirect back
  useEffect(() => {
    if (!location.state) {
      navigate('/client');
    }
  }, [location.state, navigate]);

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

  const handleMenuClick = (path) => {
    setIsMenuOpen(false);
    if (path) navigate(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/login-client');
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
            onEscolherPonto={() => {}} // Disable picking on this view
          />
        </div>

        {/* Searching Panel at the top */}
        <div className="searching-panel">
          <h2 className="searching-text">A procurar um motorista...</h2>
          <button className="cancel-trip-btn" onClick={handleCancel}>
            Cancelar
          </button>
        </div>

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
