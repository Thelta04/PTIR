import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Bell, ChevronLeft, X } from 'lucide-react';
import DriverHomeView from './DriverHomeView';
import DriverScheduleView from './DriverScheduleView';
import DriverShiftsView from './DriverShiftsView';
import DriverHistory from './DriverHistory';
import ProfileModal from '../../components/ProfileModal';
import './driver.css';
import '../client/client.css';
import '../../components/map-background.css';
import Refuels from './Refuels';

export default function DriverMain() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/manager');
  };

  const handleNav = (tab) => {
    setActiveTab(tab);
    setIsMenuOpen(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <DriverHomeView onNavigate={handleNav} />;
      case 'schedule':
        return <DriverScheduleView onNavigate={handleNav} />;
      case 'shifts':
        return <DriverShiftsView onNavigate={handleNav} />;
      case 'refuels':
        return <Refuels />;
      case 'history':
        return <DriverHistory />;
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
        <div className="client-brand" onClick={() => setActiveTab('home')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/icon_small.png" alt="TUXY Icon" style={{ width: '28px', height: '28px' }} />
          <span className="client-brand-name">TUXY</span>
        </div>
        <div
          className="header-actions"
          onClick={() => setIsProfileModalOpen(true)}
          style={{ cursor: 'pointer' }}
        >
          <span className="user-name-display">{user?.name?.split(' ')[0]}</span>
          <img
            src={`/PFPs/${user?.profile_pic || 1}.jpg`}
            alt="Profile"
            className="user-pfp-small"
          />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="driver-main-content">
        {renderContent()}
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
                  className={`drawer-link ${activeTab === 'home' ? 'active' : ''}`}
                  onClick={() => handleNav('home')}
                >
                  Página Inicial
                </button>
                <button
                  className={`drawer-link ${activeTab === 'refuels' ? 'active' : ''}`}
                  onClick={() => handleNav('refuels')}
                >
                  Registar Reabastecimento
                </button>
                <button
                  className={`drawer-link ${activeTab === 'shifts' ? 'active' : ''}`}
                  onClick={() => handleNav('shifts')}
                >
                  Gerir Turnos
                </button>
                <button
                  className={`drawer-link ${activeTab === 'history' ? 'active' : ''}`}
                  onClick={() => handleNav('history')}
                >
                  Ver Histórico de Viagens
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

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        forcedType="DRIVER"
      />

    </div>
  );
}
