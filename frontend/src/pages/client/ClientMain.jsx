import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { createTrip, listTrips, clientAcceptTrip, cancelTrip } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Bell, Search, MapPin, ChevronLeft, Target, Plus, Minus } from 'lucide-react';
import MapaPedido from '../../components/MapaPedido';
import { getAddressFromCoords, getCoordsFromAddress } from '../../components/geocoding';
import './client.css';
import '../../components/map-background.css';

export default function ClientMain() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [currentView, setCurrentView] = useState('initial'); // 'initial', 'selection', 'searching'
  const [searchValue, setSearchValue] = useState('');

  const [origin_address, setOriginAddress] = useState('');
  const [dest_address, setDestinationAddress] = useState('');
  const [dateTime, setDateTime] = useState('');

  const [num_passengers, setPassengers] = useState(1);
  const [comfort_level, setComfort] = useState('basic');
  const [activeTrip, setActiveTrip] = useState(null);

  const [origem, setOrigem] = useState(null);
  const [destino, setDestino] = useState(null);
  const [selectingFor, setSelectingFor] = useState(null);

  const handleUseCurrentLocation = () => {
    // MOCKED LOCATIONS for testing
    const originCoords = { lat: 38.7111, lon: -9.1368 };
    const destCoords = { lat: 38.7369, lon: -9.1427 };

    // Set Origin
    getAddressFromCoords(originCoords.lat, originCoords.lon).then(address => {
      setOrigem(originCoords);
      setOriginAddress(address);
    });

    // Set Destination automatically for easier testing
    getAddressFromCoords(destCoords.lat, destCoords.lon).then(address => {
      setDestino(destCoords);
      setDestinationAddress(address);
      setSearchValue(address);
    });
  };


  const checkActiveTrip = async () => {
    try {
      const { data } = await listTrips();
      // Filter active trips for this client
      const mine = data.filter(t =>
        t.client_id === user.id &&
        ['PENDING', 'DRIVER_ACCEPTED', 'CLIENT_ACCEPTED', 'IN_PROGRESS'].includes(t.status)
      );

      if (mine.length > 0) {
        const trip = mine[0];
        setActiveTrip(trip);
        if (trip.status === 'PENDING') {
          setCurrentView('searching');
        } else if (trip.status === 'DRIVER_ACCEPTED') {
          setCurrentView('accepted');
        } else if (trip.status === 'CLIENT_ACCEPTED' || trip.status === 'IN_PROGRESS') {
          setCurrentView('in_progress');
        }
      }
    } catch (err) {
      console.error('Error checking active trip:', err);
    }
  };

  // Set current location as default origin on mount and check for active trips
  useEffect(() => {
    handleUseCurrentLocation();
    checkActiveTrip();
  }, []);

  // Polling for trip status
  useEffect(() => {
    let interval;
    if (activeTrip && (currentView === 'searching' || currentView === 'accepted')) {
      interval = setInterval(async () => {
        try {
          const { data } = await listTrips();
          const updatedTrip = data.find(t => t.id === activeTrip.id);

          if (updatedTrip) {
            setActiveTrip(updatedTrip);
            if (updatedTrip.status === 'DRIVER_ACCEPTED' && currentView === 'searching') {
              setCurrentView('accepted');
            } else if ((updatedTrip.status === 'CLIENT_ACCEPTED' || updatedTrip.status === 'IN_PROGRESS') && currentView === 'accepted') {
              setCurrentView('in_progress');
            } else if (updatedTrip.status === 'CANCELED' || updatedTrip.status === 'COMPLETED') {
              setActiveTrip(null);
              setCurrentView('initial');
            }
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [activeTrip, currentView]);

  const handleSearchAddress = async (type) => {
    const addressToSearch = type === 'origin' ? origin_address : (type === 'destination' ? dest_address : searchValue);
    if (!addressToSearch) return;

    const coords = await getCoordsFromAddress(addressToSearch);
    if (coords) {
      const ponto = { lat: coords.lat, lon: coords.lon };
      if (type === 'origin') {
        setOrigem(ponto);
        setOriginAddress(coords.display_name);
      } else {
        setDestino(ponto);
        setDestinationAddress(coords.display_name);
        setSearchValue(coords.display_name);
      }
    } else {
      alert('Address not found');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login-client');
  };

  const handleMenuClick = (path) => {
    setIsMenuOpen(false);
    if (path) navigate(path);
  };

  async function handleEscolherPonto(ponto) {
    const address = await getAddressFromCoords(ponto.lat, ponto.lon);

    if (selectingFor) {
      if (selectingFor === 'origin') {
        setOrigem(ponto);
        setOriginAddress(address);
      } else if (selectingFor === 'destination') {
        setDestino(ponto);
        setDestinationAddress(address);
        setSearchValue(address);
      }
      setSelectingFor(null);
    } else if (!showMoreOptions && currentView === 'initial') {
      // Main view behavior: clicking map sets destination automatically
      setDestino(ponto);
      setDestinationAddress(address);
      setSearchValue(address);
    }
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
    if (searchValue && dest_address !== searchValue) {
      setDestinationAddress(searchValue);
    }

    // Also sync origin_address if we are in more options but didn't search
    // (though usually origin_address state is updated on every keystroke)

    setShowMoreOptions(false);
    setCurrentView('selection');
  };

  const handleConfirmSchedule = () => {
    if (!dateTime) {
      alert('Please select a date and time for your scheduled ride.');
      return;
    }
    handleConfirmRide();
  };

  const handleConfirmRide = async () => {
    try {
      const { data } = await createTrip({
        client_id: user.id,
        originAddress: origin_address,
        destAddress: dest_address || searchValue,
        comfort_level,
        num_passengers,
        scheduled_time: dateTime ? new Date(dateTime).toISOString() : null,
      });
      setActiveTrip(data);
      setCurrentView('searching');
    } catch (error) {
      const errorData = error.response?.data;
      let errorMsg = error.message;

      if (errorData) {
        if (typeof errorData === 'object') {
          errorMsg = Object.entries(errorData)
            .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
            .join('\n');
        } else if (typeof errorData === 'string') {
          errorMsg = errorData;
        }
      }

      alert('Error creating trip:\n' + errorMsg);
    }
  }

  const handleCancelTrip = async () => {
    if (!activeTrip) return;
    try {
      await cancelTrip(activeTrip.id);
      setActiveTrip(null);
      setCurrentView('initial');
    } catch (err) {
      alert('Error canceling trip');
    }
  };

  const handleClientAccept = async () => {
    if (!activeTrip) return;
    try {
      await clientAcceptTrip(activeTrip.id);
      setCurrentView('in_progress');
    } catch (err) {
      alert('Error accepting trip');
    }
  };

  const renderSearchPanel = () => {
    switch (currentView) {
      case 'searching':
        return (
          <div className="searching-view" style={{ textAlign: 'center', padding: '20px' }}>
            <h2 className="view-title" style={{ marginBottom: '30px' }}>A procurar um motorista...</h2>
            <div className="pulse-container" style={{ margin: '40px 0' }}>
              <div className="pulse-circle"></div>
            </div>
            <button
              className="search-btn search-btn--primary"
              onClick={handleCancelTrip}
              style={{ backgroundColor: '#f1cf58', color: '#fff' }}
            >
              Cancelar
            </button>
          </div>
        );

      case 'accepted':
        return (
          <div className="accepted-view" style={{ textAlign: 'center' }}>
            <div className="driver-info" style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
              <div className="driver-photo" style={{ width: '80px', height: '80px', borderRadius: '20px', backgroundColor: '#eee', overflow: 'hidden' }}>
                <img src="https://via.placeholder.com/80" alt="Driver" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{activeTrip?.driver_name}</h3>
                <div style={{ color: '#f1af3d', fontWeight: 'bold' }}>⭐ 4.9 (531 reviews)</div>
              </div>
            </div>
            <div className="car-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', border: '1px solid #eee', borderRadius: '12px', marginBottom: '20px' }}>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ margin: 0 }}>{activeTrip?.taxi_brand} {activeTrip?.taxi_model}</h4>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>{activeTrip?.taxi_plate}</div>
              </div>
              <div className="car-icon">🚗</div>
            </div>
            <div className="actions" style={{ display: 'flex', gap: '10px' }}>
              <button
                className="search-btn"
                onClick={handleCancelTrip}
                style={{ flex: 1, backgroundColor: '#e53e3e', color: '#fff' }}
              >
                Recusar
              </button>
              <button
                className="search-btn"
                onClick={handleClientAccept}
                style={{ flex: 1, backgroundColor: '#f1cf58', color: '#fff' }}
              >
                Aceitar
              </button>
            </div>
          </div>
        );

      case 'in_progress':
        return (
          <div className="in-progress-view" style={{ textAlign: 'center', padding: '20px' }}>
            <h2 className="view-title">Trip in Progress</h2>
            <p>Your driver is on the way!</p>
            <div className="driver-brief" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '20px', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '10px' }}>
              <span>🚗</span>
              <strong>{activeTrip?.driver_name}</strong>
              <span style={{ marginLeft: 'auto' }}>{activeTrip?.taxi_plate}</span>
            </div>
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
                onClick={() => {
                  if (!dateTime) {
                    alert('Please select a date and time for your scheduled ride.');
                    return;
                  }
                  setCurrentView('confirmation');
                }}
              >
                Schedule
              </button>
              <button
                className="search-btn search-btn--primary"
                onClick={() => {
                  setDateTime('');
                  setCurrentView('confirmation');
                }}
              >
                Ride Now
              </button>
            </div>
          </div>
        );

      case 'confirmation':
        return (
          <div className="confirmation-view" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            minHeight: '350px',
            justifyContent: 'space-between'
          }}>
            <div className="view-header" style={{ marginBottom: '10px' }}>
              <button
                className="back-btn"
                onClick={() => setCurrentView('selection')}
                title="Back"
              >
                <ChevronLeft size={24} />
              </button>
              <h2 className="view-title" style={{ fontSize: '1.4rem' }}>Trip Summary</h2>
            </div>

            <div className="details-list" style={{
              background: '#fff',
              border: '2px solid #f1cf58',
              borderRadius: '16px',
              padding: '20px',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              flex: 1,
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
            }}>
              <div className="detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#f1af3d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>From</span>
                <div style={{ fontSize: '1.05rem', color: '#1f2937', lineHeight: '1.4' }}>{origin_address || 'Current Location'}</div>
              </div>

              <div className="detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#f1af3d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>To</span>
                <div style={{ fontSize: '1.05rem', color: '#1f2937', lineHeight: '1.4' }}>{dest_address || searchValue}</div>
              </div>

              <div style={{ display: 'flex', gap: '40px', borderTop: '2px dashed #f3f4f6', paddingTop: '15px' }}>
                <div className="detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#f1af3d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Service</span>
                  <div style={{ fontSize: '1.05rem', color: '#1f2937' }}>{comfort_level}</div>
                </div>
                <div className="detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#f1af3d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Seats</span>
                  <div style={{ fontSize: '1.05rem', color: '#1f2937' }}>{num_passengers}</div>
                </div>
              </div>

              <div className="detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '2px dashed #f3f4f6', paddingTop: '15px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#f1af3d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pickup Time</span>
                <div style={{ fontSize: '1.1rem', color: '#f1af3d', fontWeight: '700' }}>
                  {dateTime ? new Date(dateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Immediate (Ride Now)'}
                </div>
              </div>
            </div>

            <button
              className="search-btn search-btn--primary"
              onClick={handleConfirmRide}
              style={{
                marginTop: '10px',
                padding: '12px 0',
                height: '64px',
                fontSize: '1.1rem',
                letterSpacing: '0.5px'
              }}
            >
              Confirm Trip
            </button>
          </div>
        );

      default:
        return !showMoreOptions ? (
          <>
            <div className="search-input-wrapper">
              <div style={{ position: 'relative', flex: 1 }}>
                <button
                  className="input-search-btn"
                  onClick={() => handleSearchAddress('main')}
                  title="Search address"
                >
                  <Search size={18} />
                </button>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Where would you like to go?"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchAddress('main')}
                />
              </div>
            </div>

            <div className="trip-settings-row">
              <div className="setting-item">
                <label>Comfort</label>
                <select
                  className="setting-input"
                  value={comfort_level}
                  onChange={(e) => setComfort((e.target.value))}
                >
                  <option value="basic">Basic</option>
                  <option value="luxury">Luxury</option>
                </select>
              </div>
              <div className="setting-item">
                <label>Passengers</label>
                <div className="number-control">
                  <button
                    className="number-btn"
                    onClick={() => setPassengers(Math.max(1, num_passengers - 1))}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="number-value">{num_passengers}</span>
                  <button
                    className="number-btn"
                    onClick={() => setPassengers(Math.min(4, num_passengers + 1))}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
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
                <div style={{ position: 'relative', flex: 1 }}>
                  <button
                    className="input-search-btn"
                    onClick={() => handleSearchAddress('origin')}
                    title="Search address"
                  >
                    <Search size={16} />
                  </button>
                  <input
                    type="text"
                    placeholder="Rua das Oliveiras, Campo Grande"
                    value={origin_address}
                    onChange={(e) => setOriginAddress(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchAddress('origin')}
                    style={{ width: '100%' }}
                  />
                </div>
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
                <div style={{ position: 'relative', flex: 1 }}>
                  <button
                    className="input-search-btn"
                    onClick={() => handleSearchAddress('destination')}
                    title="Search address"
                  >
                    <Search size={16} />
                  </button>
                  <input
                    type="text"
                    placeholder="Avenida Dos Campos, Saldanha"
                    value={dest_address}
                    onChange={(e) => setDestinationAddress(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchAddress('destination')}
                    style={{ width: '100%' }}
                  />
                </div>
                <button
                  className={`pinpoint-btn pinpoint-btn--small ${selectingFor === 'destination' ? 'active' : ''}`}
                  onClick={() => setSelectingFor(selectingFor === 'destination' ? null : 'destination')}
                  title="Select destination on map"
                >
                  <MapPin size={20} />
                </button>
              </div>
            </div>

            <div className="trip-settings-row">
              <div className="setting-item">
                <label>Comfort Level</label>
                <select
                  className="setting-input"
                  value={comfort_level}
                  onChange={(e) => setComfort(e.target.value)}
                >
                  <option value="basic">Basic</option>
                  <option value="luxury">Luxury</option>
                </select>
              </div>
              <div className="setting-item">
                <label>Passengers</label>
                <div className="number-control">
                  <button
                    className="number-btn"
                    onClick={() => setPassengers(Math.max(1, num_passengers - 1))}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="number-value">{num_passengers}</span>
                  <button
                    className="number-btn"
                    onClick={() => setPassengers(Math.min(4, num_passengers + 1))}
                  >
                    <Plus size={16} />
                  </button>
                </div>
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
  );
}