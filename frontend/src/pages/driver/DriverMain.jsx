import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Bell, ChevronLeft, LogOut } from 'lucide-react';
import DriverHomeView from './DriverHomeView';
import DriverScheduleView from './DriverScheduleView';
import DriverShiftsView from './DriverShiftsView';
import MapaPedido from '../../components/MapaPedido';
import './driver.css';
import '../../components/map-background.css';
import Refuels from './Refuels';

export default function DriverMain() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  const handleLogout = () => {
    logout();
    navigate('/login-manager');
  };

  const handleNav = (tab) => {
    setActiveTab(tab);
    setIsMenuOpen(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <DriverHomeView />;
      case 'schedule':
        return <DriverScheduleView />;
      case 'shifts':
        return <DriverShiftsView />;
      case 'refuels':
        return <Refuels />;
      default:
        return <DriverHomeView />;
      
    }
  };

  return (
    <div className="driver-layout">
      {/* Top App Bar */}
      <header className="driver-header">
        <button className="menu-btn" onClick={() => setIsMenuOpen(true)}>
          <Menu size={24} />
        </button>
        <div className="driver-brand" onClick={() => setActiveTab('home')} style={{ cursor: 'pointer' }}>
          <span className="driver-brand-name">TUXY</span>
          <span className="driver-brand-sub">Motorista</span>
        </div>
        <button className="bell-btn">
          <Bell size={20} />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="driver-main-content">
        {renderContent()}
        <div className="map-wrapper">
                <MapaPedido
                  origem={origem}
                  destino={destino}
                  onEscolherPonto={handleEscolherPonto}
                />
        </div>
      </main>

      {/* Sidebar Drawer overlay */}
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
                  className={`drawer-link ${activeTab === 'schedule' ? 'active' : ''}`}
                  onClick={() => handleNav('schedule')}
                >
                  Registar turno
                </button>
                <button 
                  className={`drawer-link ${activeTab === 'refuels' ? 'active' : ''}`}
                  onClick={() => handleNav('refuels')}
                >
                  Registar reabastecimento
                </button>
                <button 
                  className={`drawer-link ${activeTab === 'shifts' ? 'active' : ''}`}
                  onClick={() => handleNav('shifts')}
                >
                  Consultar turnos
                </button>
                <button 
                  className="drawer-link"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Ver histórico de viagens
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
    </div>
  );
}
