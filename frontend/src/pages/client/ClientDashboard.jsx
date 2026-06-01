import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { listTrips } from '../../api/client';
import { motion } from 'framer-motion';
import { LogOut, MapPin, ArrowRight } from 'lucide-react';
import ProfileModal from '../../components/ProfileModal';

const STATUS_STYLES = {
  PENDING:         'trip-badge--pending',
  DRIVER_ACCEPTED: 'trip-badge--accepted',
  CLIENT_ACCEPTED: 'trip-badge--accepted',
  IN_PROGRESS:     'trip-badge--active',
  COMPLETED:       'trip-badge--done',
  CANCELED:        'trip-badge--canceled',
};

const STATUS_LABELS = {
  PENDING:         'Pendente',
  DRIVER_ACCEPTED: 'Motorista Aceitou',
  CLIENT_ACCEPTED: 'Confirmada',
  IN_PROGRESS:     'Em Curso',
  COMPLETED:       'Concluída',
  CANCELED:        'Cancelada',
};

export default function ClientDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await listTrips();
        // Filter to only show this client's trips
        const mine = data.filter((t) => t.client_id === user.id);
        setTrips(mine);
      } catch (err) {
        setError(err.response?.data?.error || 'Erro ao carregar viagens.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user.id]);

  const handleLogout = () => { logout(); navigate('/login-client'); };

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-header-left">
          <div className="dash-brand">
            <span className="dash-brand-name">TUXY</span>
            <span className="dash-brand-sub">Cliente</span>
          </div>
        </div>
        <div className="dash-header-right">
          <div 
            className="user-name-container" 
            onClick={() => setIsProfileModalOpen(true)}
            style={{ cursor: 'pointer' }}
          >
            <span className="dash-greeting">Olá, {user?.name?.split(' ')[0]}</span>
            <img 
              src={`/PFPs/${user?.profile_pic || 1}.jpg`} 
              alt="Profile" 
              className="user-pfp-small"
            />
          </div>
          <button className="dash-icon-btn dash-icon-btn--danger" onClick={handleLogout} aria-label="Sair">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="dash-main" style={{ padding: '2rem' }}>
        <h1 className="dash-title">As Minhas Viagens</h1>

        {loading && <p className="dash-loading">A carregar viagens…</p>}
        {error && <p className="dash-error">{error}</p>}

        {!loading && trips.length === 0 && (
          <div className="dash-placeholder-card">
            <p>Ainda não tem viagens. Peça uma para começar!</p>
          </div>
        )}

        <div className="trip-grid">
          {trips.map((t) => (
            <motion.div
              key={t.id}
              className="trip-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="trip-card-header">
                <span className="trip-card-id">Viagem #{t.id}</span>
                <span className={`trip-badge ${STATUS_STYLES[t.status] || ''}`}>
                  {STATUS_LABELS[t.status] || t.status}
                </span>
              </div>

              <div className="trip-route">
                <MapPin size={14} className="trip-route-icon" />
                <span>{t.origin}</span>
                <ArrowRight size={14} />
                <span>{t.destination}</span>
              </div>

              <div className="trip-card-meta">
                <span>{t.comfort_level}</span>
                <span>{t.num_passengers} pax</span>
                <span>€{Number(t.price).toFixed(2)}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      <ProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
}
