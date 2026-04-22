import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Bell, Search, MapPin, ChevronLeft, Target, Calendar, Clock } from 'lucide-react';
import './client.css';

export default function ClientMain() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  
  const [origin_address, setOriginAddress] = useState('');
  const [dest_address, setDestinationAddress] = useState('');
  const [dateTime, setDateTime] = useState('');
  
  const [num_passengers, setPassengers] = useState(1);
  const [comfort_level, setComfort] = useState('Basic');
  const [engine, setEngine] = useState('Fuel');
  const [status, setState] = useState("PENDING");

  const handleLogout = () => {
    logout();
    navigate('/login-client');
  };

  const handleMenuClick = (path) => {
    setIsMenuOpen(false);
    if (path) navigate(path);
  };  

  return (
    <div className="client-layout">
      {/* Header */}
      <header className="client-header">
        <button className="menu-btn" onClick={() => setIsMenuOpen(true)}>
          <Menu size={24} />
        </button>
        <div className="client-brand">
          <span className="client-brand-name">TUXY</span>
        </div>
        <button className="bell-btn">
          <Bell size={20} />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="client-main-content">
        {/* Map Background Placeholder */}
        <div className="map-background">
          <div className="map-grid-pattern"></div>
        </div>

        {/* Floating Search Container */}
        <div className="search-container">
          {isSearching ? (
            <div className="waiting-view">
              <h2 className="waiting-title">Looking for a driver...</h2>
              <button 
                className="search-btn search-btn--primary waiting-cancel-btn"
                onClick={() => {
                  setIsSearching(false);
                  setState("CANCELLED");
                }}
              >
                Cancel
              </button>
            </div>
          ) : !showMoreOptions ? (
            <>
              <div className="search-input-wrapper">
                <Search className="search-icon" size={18} />
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder="Where would you like to go?"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
              </div>

              <div className="quick-options">
                <div className="quick-option-item">
                  <label>People</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="6" 
                    value={num_passengers}
                    onChange={(e) => setPassengers(e.target.value)}
                  />
                </div>
                <div className="quick-option-item">
                  <label>Comfort</label>
                  <select value={comfort_level} onChange={(e) => setComfort(e.target.value)}>
                    <option value="Basic">Basic</option>
                    <option value="Luxury">Luxury</option>
                  </select>
                </div>
                <div className="quick-option-item">
                  <label>Engine</label>
                  <select value={engine} onChange={(e) => setEngine(e.target.value)}>
                    <option value="Fuel">Fuel</option>
                    <option value="Electric">Electric</option>
                  </select>
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
                  onClick={() => {
                    setIsSearching(true);
                    setState("PENDING");
                  }}
                >
                  See Routes
                </button>
              </div>
            </>
          ) : (
            <div className="more-options-form">
              <div className="form-group">
                <label>Enter origin:</label>
                <input 
                  type="text" 
                  placeholder="Rua das Oliveiras, Campo Grande"
                  value={origin_address}
                  onChange={(e) => setOriginAddress(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Enter destination:</label>
                <input 
                  type="text" 
                  placeholder="Avenida Dos Campos, Saldanha"
                  value={dest_address}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Schedule</label>
                <div className="schedule-inputs">
                  <input 
                    type="datetime-local" 
                    value={dateTime}
                    onChange={(e) => setDateTime(e.target.value)}
                    className="search-input"
                    style={{ paddingLeft: '0.75rem' }}
                  />
                </div>
              </div>

              <div className="quick-options">
                <div className="quick-option-item">
                  <label>People</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="6" 
                    value={num_passengers}
                    onChange={(e) => setPassengers(e.target.value)}
                  />
                </div>
                <div className="quick-option-item">
                  <label>Comfort</label>
                  <select value={comfort_level} onChange={(e) => setComfort(e.target.value)}>
                    <option value="Basic">Basic</option>
                    <option value="Luxury">Luxury</option>
                  </select>
                </div>
                <div className="quick-option-item">
                  <label>Engine</label>
                  <select value={engine} onChange={(e) => setEngine(e.target.value)}>
                    <option value="Fuel">Fuel</option>
                    <option value="Electric">Electric</option>
                  </select>
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
                  onClick={() => {
                    setIsSearching(true);
                    setState("PENDING");
                  }}
                >
                  Request Tuxy
                </button>
              </div>
            </div>
          )}
        </div>

        {/* GPS Button */}
        <button className="gps-btn">
          <Target size={20} color="#374151" />
        </button>

        {/* Map Marker Pin */}
        <div className="map-center-marker">
          <div className="marker-circle-outer">
            <div className="marker-circle-mid">
              <div className="marker-circle-inner">
                <MapPin className="pin-icon" size={32} fill="#000" />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Sidebar Drawer Menu */}
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
                <button 
                  className="drawer-link"
                  onClick={() => handleMenuClick('/client')}
                >
                  Request Trip
                </button>
                <button 
                  className="drawer-link"
                  onClick={() => handleMenuClick('/client')}
                >
                  View Reservations
                </button>
                <button 
                  className="drawer-link"
                  onClick={() => handleMenuClick('/client')}
                >
                  View Trip History
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
