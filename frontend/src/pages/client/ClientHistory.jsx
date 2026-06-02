import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronUp, ChevronDown, Clock, MapPin, Menu, Route, User, Wallet, Users, Star, Car, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { listTrips } from '../../api/client';
import ProfileModal from '../../components/ProfileModal';
import { formatDateTimePT } from '../../utils/dateFormat';
import './client.css';

const STATUS_LABELS = {
  PENDING: 'Pendente',
  DRIVER_ACCEPTED: 'Motorista aceite',
  CLIENT_ACCEPTED: 'Confirmada',
  IN_PROGRESS: 'Em curso',
  WAITING_PAYMENT: 'A aguardar pagamento',
  PAID: 'Paga',
  COMPLETED: 'Concluída',
  CANCELED: 'Cancelada',
};

const STATUS_CLASSES = {
  PENDING: 'trip-badge--pending',
  DRIVER_ACCEPTED: 'trip-badge--accepted',
  CLIENT_ACCEPTED: 'trip-badge--accepted',
  IN_PROGRESS: 'trip-badge--active',
  WAITING_PAYMENT: 'trip-badge--active',
  PAID: 'trip-badge--done',
  COMPLETED: 'trip-badge--done',
  CANCELED: 'trip-badge--canceled',
};

function getTripDateValue(trip) {
  const rawDate = trip.interval?.start_time;
  const date = rawDate ? new Date(rawDate) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function formatPrice(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `€${number.toFixed(2)}` : '-';
}

function formatComfort(value) {
  if (value === 'basic') return 'Básico';
  if (value === 'luxury') return 'Luxo';
  return value || '-';
}

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

  if (streetIdx === -1 && parts.length > 2 && /^\d/.test(parts[1])) {
    streetIdx = 2;
  }

  if (streetIdx === -1) streetIdx = 0;

  let street = parts[streetIdx];
  if (streetIdx > 0 && /^\d/.test(parts[streetIdx - 1])) {
    street = `${parts[streetIdx - 1]} ${street}`;
  }

  const freguesia = parts[streetIdx + 1] || '';
  const concelho = parts[streetIdx + 2] || '';

  return [street, freguesia, concelho].filter(Boolean).join(', ');
};

const ClientTripCard = ({ trip, user }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.article
      className="history-trip-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div 
        className="history-trip-header" 
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer', marginBottom: expanded ? '14px' : '0' }}
      >
        <div>
          <span className="history-trip-id">Viagem #{trip.id}</span>
          <h2>{formatDateTimePT(trip.interval?.start_time)}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className={`trip-badge ${STATUS_CLASSES[trip.status] || ''}`}>
            {STATUS_LABELS[trip.status] || trip.status}
          </span>
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="history-route">
              <div className="history-route-point">
                <MapPin size={16} />
                <span title={trip.originAddress}>{simplifyAddress(trip.originAddress) || '-'}</span>
              </div>
              <ArrowRight size={18} className="history-route-arrow" />
              <div className="history-route-point">
                <MapPin size={16} />
                <span title={trip.destAddress}>{simplifyAddress(trip.destAddress) || '-'}</span>
              </div>
            </div>

            <div className="history-trip-details">
              <div>
                <span><Star size={14} /> Serviço</span>
                <strong>{formatComfort(trip.comfort_level)}</strong>
              </div>
              <div>
                <span><Users size={14} /> Passageiros</span>
                <strong>{trip.num_passengers ?? '-'}</strong>
              </div>
              <div>
                <span><Route size={14} /> Distância</span>
                <strong>{Number(trip.kilometers || 0).toFixed(2)} km</strong>
              </div>
              <div>
                <span><Wallet size={14} /> Preço</span>
                <strong>{formatPrice(trip.price)}</strong>
              </div>
              <div>
                <span><User size={14} /> Motorista</span>
                <strong>{trip.driver_name || '-'}</strong>
              </div>
              <div>
                <span><Car size={14} /> Táxi</span>
                <strong>
                  {[trip.taxi_brand, trip.taxi_model, trip.taxi_plate].filter(Boolean).join(' ') || '-'}
                </strong>
              </div>
              <div>
                <span><Zap size={14} /> Motor</span>
                <strong>{trip.taxi_engine || '-'}</strong>
              </div>
              <div>
                <span><User size={14} /> Cliente</span>
                <strong>
                  {trip.client_name || user?.name || '-'}
                </strong>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
};

export default function ClientHistory() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const { data } = await listTrips();
        const mine = data
          .filter((trip) => trip.client_id === user.id)
          .sort((a, b) => getTripDateValue(b) - getTripDateValue(a));
        setTrips(mine);
      } catch (err) {
        setError(err.response?.data?.error || 'Erro ao carregar o histórico de viagens.');
      } finally {
        setLoading(false);
      }
    };

    fetchTrips();
  }, [user.id]);

  const totals = useMemo(() => {
    return trips.reduce(
      (acc, trip) => {
        if (trip.status === 'COMPLETED') {
          acc.count += 1;
          acc.kilometers += Number(trip.kilometers) || 0;
          acc.spent += Number(trip.price) || 0;
        }
        return acc;
      },
      { count: 0, kilometers: 0, spent: 0 }
    );
  }, [trips]);

  const handleMenuClick = (path) => {
    setIsMenuOpen(false);
    if (path) navigate(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="client-layout client-history-page">
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

      <main className="client-history-main">
        <section className="history-toolbar">
          <div>
            <h1>Histórico de viagens</h1>
          </div>
        </section>

        <section className="history-stats">
          <div className="history-stat">
            <div className="history-stat-header">
              <Clock size={18} />
              <span>Viagens</span>
            </div>
            <strong>{totals.count}</strong>
          </div>
          <div className="history-stat">
            <div className="history-stat-header">
              <Route size={18} />
              <span>Quilómetros</span>
            </div>
            <strong>{totals.kilometers.toFixed(1)} km</strong>
          </div>
          <div className="history-stat">
            <div className="history-stat-header">
              <Wallet size={18} />
              <span>Total</span>
            </div>
            <strong>{formatPrice(totals.spent)}</strong>
          </div>
        </section>

        {loading && <div className="history-message">A carregar viagens...</div>}
        {error && <div className="history-message history-message--error">{error}</div>}

        {!loading && !error && trips.length === 0 && (
          <div className="history-empty">
            Ainda não existem viagens associadas a esta conta.
          </div>
        )}

        {!loading && !error && trips.length > 0 && (
          <section className="history-list">
            {trips.map((trip) => (
              <ClientTripCard key={trip.id} trip={trip} user={user} />
            ))}
          </section>
        )}
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
                  Início
                </button>
                <button className="drawer-link" onClick={() => handleMenuClick('/client/scheduled')}>
                  Agendar Viagens
                </button>
                <button className="drawer-link drawer-link--active" onClick={() => handleMenuClick('/client/history')}>
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

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        forcedType="CLIENT"
      />
    </div>
  );
}
