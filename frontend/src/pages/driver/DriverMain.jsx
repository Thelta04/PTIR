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
import SharedHeader from '../../components/SharedHeader';
import SharedDrawer from '../../components/SharedDrawer';
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
      <SharedHeader 
        user={user} 
        subtitle="Motorista"
        onMenuClick={() => setIsMenuOpen(true)} 
        onProfileClick={() => setIsProfileModalOpen(true)}
        navigateTo="/driver"
      />

      {/* Main Content Area */}
      <main className="driver-main-content" tabIndex={0}>
        {renderContent()}
      </main>

      <AnimatePresence>
        {isMenuOpen && (
          <SharedDrawer
            isOpen={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
            onLogout={handleLogout}
          >
            <button
              className={`drawer-link ${activeTab === 'home' ? 'drawer-link--active' : ''}`}
              onClick={() => handleNav('home')}
            >
              Página Inicial
            </button>
            <button
              className={`drawer-link ${activeTab === 'refuels' ? 'drawer-link--active' : ''}`}
              onClick={() => handleNav('refuels')}
            >
              Registar Reabastecimento
            </button>
            <button
              className={`drawer-link ${activeTab === 'shifts' ? 'drawer-link--active' : ''}`}
              onClick={() => handleNav('shifts')}
            >
              Gerir Turnos
            </button>
            <button
              className={`drawer-link ${activeTab === 'history' ? 'drawer-link--active' : ''}`}
              onClick={() => handleNav('history')}
            >
              Ver Histórico de Viagens
            </button>
          </SharedDrawer>
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
