import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Bell, Search, MapPin, ChevronLeft, Target } from 'lucide-react';
import MapaPedido from '../../components/MapaPedido';
import { getAddressFromCoords } from '../../components/geocoding';
import './client.css';
import './map-background.css';

export default function ClientMain() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [currentView, setCurrentView] = useState('initial'); // 'initial', 'selection', 'searching'
  const [searchValue, setSearchValue] = useState('');

  const [origin_address, setOriginAddress] = useState('');
  const [dest_address, setDestinationAddress] = useState('');
  const [dateTime, setDateTime] = useState('');

  const [num_passengers, setPassengers] = useState(1);
  const [comfort_level, setComfort] = useState('Basic');
  const [engine, setEngine] = useState('Fuel');
  const [status, setState] = useState('PENDING');

  const [origem, setOrigem] = useState(null);
  const [destino, setDestino] = useState(null);
  const [selectingFor, setSelectingFor] = useState(null);

  // Set current location as default origin on mount
  useEffect(() => {
    handleUseCurrentLocation();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login-client');
  };

  const handleMenuClick = (path) => {
    setIsMenuOpen(false);
    if (path) navigate(path);
  };

  async function handleEscolherPonto(ponto) {
    if (!selectingFor) return;

    const address = await getAddressFromCoords(ponto.lat, ponto.lon);

    if (selectingFor === 'origin') {
      setOrigem(ponto);
      setOriginAddress(address);
    } else if (selectingFor === 'destination') {
      setDestino(ponto);
      setDestinationAddress(address);
      setSearchValue(address);
    }
    
    setSelectingFor(null);
  }

  const handleProceedToSelection = () => {
    // Basic validation
    if (!origin_address && !origem) {
      alert('Please specify an origin.');
      return;
    }
    if (!dest_address && !destino && !searchValue) {
      alert('Please specify a destination.');
      return;
    }

    // Ensure state matches what's in the text inputs if they were typed manually
    if (!destino && searchValue) {
      setDestinationAddress(searchValue);
    }

    setShowMoreOptions(false);
    setCurrentView('selection');
  };

  const handleConfirmSchedule = () => {
    if (!dateTime) {
      alert('Please select a date and time for your scheduled ride.');
      return;
    }
    setCurrentView('searching');
    setState('PENDING');
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const ponto = { lat: latitude, lon: longitude };
        const address = await getAddressFromCoords(latitude, longitude);
        
        setOrigem(ponto);
        setOriginAddress(address);
      },
      (error) => {
        alert('Unable to retrieve your location: ' + error.message);
      }
    );
  };

  const renderSearchPanel = () => {
    switch (currentView) {
      case 'searching':
        return (
          <div className="waiting-view">
            <h2 className="waiting-title">Looking for a driver...</h2>
            <button
              className="search-btn search-btn--primary waiting-cancel-btn"
              onClick={() => {
                setCurrentView('initial');
                setState('CANCELLED');
              }}
            >
              Cancel
            </button>
          </div>
        );

      case 'selection':
        return (
          <div className="selection-view">
            <div className="view-header">
              <button
                className="back-btn"
                onClick={() => setCurrentView('initial')}
                title="Back"
              >
                <ChevronLeft size={24} />
              </button>
              <h2 className="view-title">When would you like to go?</h2>
            </div>
            
            <div className="form-group" style={{ width: '100%' }}>
              <input
                type="datetime-local"
                className="timestamp-input"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
              />
            </div>

            <div className="selection-options">
              <button
                className="search-btn search-btn--primary"
                onClick={handleConfirmSchedule}
              >
                Schedule
              </button>
              <button
                className="search-btn search-btn--primary"
                onClick={() => {
                  setDateTime(''); 
                  setCurrentView('searching');
                  setState('PENDING');
                }}
              >
                Ride Now
              </button>
            </div>
          </div>
        );

      default:
        return !showMoreOptions ? (
          <>
            <div className="search-input-wrapper">
              <div style={{ position: 'relative', flex: 1 }}>
                <Search className="search-icon" size={18} />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Where would you like to go?"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
              </div>
              <button
                className={`pinpoint-btn ${selectingFor === 'destination' ? 'active' : ''}`}
                onClick={() => setSelectingFor(selectingFor === 'destination' ? null : 'destination')}
                title="Select destination on map"
              >
                <MapPin size={24} />
              </button>
            </div>

            <div className="search-actions">
              <button
                className="search-btn search-btn--secondary"
                onClick={() => setShowMoreOptions(true)}
              >
                More Options
              </button>

              <button
                className="search-btn search-btn--primary"
                onClick={handleProceedToSelection}
              >
                See Routes
              </button>
            </div>
          </>
        ) : (
          <div className="more-options-form">
            <div className="form-group">
              <label>Enter origin:</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Rua das Oliveiras, Campo Grande"
                  value={origin_address}
                  onChange={(e) => setOriginAddress(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  className={`pinpoint-btn pinpoint-btn--small ${selectingFor === 'origin' ? 'active' : ''}`}
                  onClick={() => setSelectingFor(selectingFor === 'origin' ? null : 'origin')}
                  title="Select origin on map"
                >
                  <MapPin size={20} />
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Enter destination:</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Avenida Dos Campos, Saldanha"
                  value={dest_address}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  className={`pinpoint-btn pinpoint-btn--small ${selectingFor === 'destination' ? 'active' : ''}`}
                  onClick={() => setSelectingFor(selectingFor === 'destination' ? null : 'destination')}
                  title="Select destination on map"
                >
                  <MapPin size={20} />
                </button>
              </div>
            </div>

            <div className="search-actions">
              <button
                className="search-btn search-btn--cancel"
                onClick={() => setShowMoreOptions(false)}
              >
                Cancel
              </button>

              <button
                className="search-btn search-btn--primary"
                onClick={handleProceedToSelection}
              >
                Request Tuxy
              </button>
            </div>
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
          onEscolherPonto={handleEscolherPonto}
        />
      </div>

      <section className="search-panel">
        {renderSearchPanel()}
      </section>

      <button
        className="gps-btn"
        onClick={handleUseCurrentLocation}
        title="Use current location"
      >
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
); }