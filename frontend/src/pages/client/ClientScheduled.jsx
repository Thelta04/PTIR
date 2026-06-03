import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CalendarClock, ChevronLeft, Clock, MapPin, Menu, Route, User, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { listTrips } from '../../api/client';
import ProfileModal from '../../components/ProfileModal';
import SharedHeader from '../../components/SharedHeader';
import SharedDrawer from '../../components/SharedDrawer';
import { formatDateTimePT } from '../../utils/dateFormat';
import './client.css';

const STATUS_LABELS = {
  PENDING: 'Agendada',
  DRIVER_ACCEPTED: 'Motorista atribuído',
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

function getTripDate(trip) {
  const rawDate = trip.interval?.start_time;
  const date = rawDate ? new Date(rawDate) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
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

export default function ClientScheduled() {
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
        const now = new Date();
        const futureTrips = data
          .filter((trip) => {
            const tripDate = getTripDate(trip);
            return trip.client_id === user.id && tripDate && tripDate > now;
          })
          .sort((a, b) => getTripDate(a) - getTripDate(b));
        setTrips(futureTrips);
      } catch (err) {
        setError(err.response?.data?.error || 'Erro ao carregar as viagens futuras.');
      } finally {
        setLoading(false);
      }
    };

    fetchTrips();
  }, [user.id]);

  const totals = useMemo(() => {
    return trips.reduce(
      (acc, trip) => {
        acc.count += 1;
        acc.kilometers += Number(trip.kilometers) || 0;
        acc.estimated += Number(trip.price) || 0;
        return acc;
      },
      { count: 0, kilometers: 0, estimated: 0 }
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
      <SharedHeader 
        user={user} 
        onMenuClick={() => setIsMenuOpen(true)} 
        onProfileClick={() => setIsProfileModalOpen(true)}
        navigateTo="/client"
      />

      <main className="client-history-main">
        <section className="history-toolbar">
          <div>
            <h1>Viagens futuras</h1>
          </div>
        </section>

        <section className="history-stats">
          <div className="history-stat">
            <div className="history-stat-header">
              <CalendarClock size={18} />
              <span>Agendadas</span>
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
              <span>Estimativa</span>
            </div>
            <strong>{formatPrice(totals.estimated)}</strong>
          </div>
        </section>

        {loading && <div className="history-message">A carregar viagens futuras...</div>}
        {error && <div className="history-message history-message--error">{error}</div>}

        {!loading && !error && trips.length === 0 && (
          <div className="history-empty">
            Não existem viagens futuras associadas a esta conta.
          </div>
        )}

        {!loading && !error && trips.length > 0 && (
          <section className="history-list">
            {trips.map((trip) => (
              <motion.article
                key={trip.id}
                className="history-trip-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
              >
                <div className="history-trip-header">
                  <div>
                    <span className="history-trip-id">Viagem #{trip.id}</span>
                    <h2>{formatDateTimePT(trip.interval?.start_time)}</h2>
                  </div>
                  <span className={`trip-badge ${STATUS_CLASSES[trip.status] || ''}`}>
                    {STATUS_LABELS[trip.status] || trip.status}
                  </span>
                </div>

                <div className="history-route">
                  <div className="history-route-point">
                    <MapPin size={16} />
                    <span>{trip.originAddress || '-'}</span>
                  </div>
                  <ArrowRight size={18} className="history-route-arrow" />
                  <div className="history-route-point">
                    <MapPin size={16} />
                    <span>{trip.destAddress || '-'}</span>
                  </div>
                </div>

                <div className="history-trip-details">
                  <div>
                    <span>Serviço</span>
                    <strong>{formatComfort(trip.comfort_level)}</strong>
                  </div>
                  <div>
                    <span>Passageiros</span>
                    <strong>{trip.num_passengers ?? '-'}</strong>
                  </div>
                  <div>
                    <span>Distância</span>
                    <strong>{Number(trip.kilometers || 0).toFixed(2)} km</strong>
                  </div>
                  <div>
                    <span>Preço</span>
                    <strong>{formatPrice(trip.price)}</strong>
                  </div>
                  <div>
                    <span>Motorista</span>
                    <strong>{trip.driver_name || 'Por atribuir'}</strong>
                  </div>
                  <div>
                    <span>Táxi</span>
                    <strong>
                      {[trip.taxi_brand, trip.taxi_model, trip.taxi_plate].filter(Boolean).join(' ') || '-'}
                    </strong>
                  </div>
                  <div>
                    <span>Data/hora</span>
                    <strong>
                      <Clock size={14} />
                      {formatDateTimePT(trip.interval?.start_time)}
                    </strong>
                  </div>
                  <div>
                    <span>Cliente</span>
                    <strong>
                      <User size={14} />
                      {trip.client_name || user?.name || '-'}
                    </strong>
                  </div>
                </div>
              </motion.article>
            ))}
          </section>
        )}
      </main>

      <AnimatePresence>
        {isMenuOpen && (
          <SharedDrawer
            isOpen={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
            onLogout={handleLogout}
          >
            <button className="drawer-link" onClick={() => handleMenuClick('/client')}>
              Início
            </button>
            <button className="drawer-link" onClick={() => handleMenuClick('/client/history')}>
              Histórico
            </button>
            <button className="drawer-link" onClick={() => handleMenuClick('/client/invoices')}>
              Faturas
            </button>
          </SharedDrawer>
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
