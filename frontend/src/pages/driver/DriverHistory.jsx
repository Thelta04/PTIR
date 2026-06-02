import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Car, ChevronDown, ChevronUp, Clock, MapPin, Route, User, Wallet, Users, Star, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { listTrips } from '../../api/client';
import { formatDateTimePT } from '../../utils/dateFormat';

const STATUS_LABELS = {
  PENDING: 'Pendente',
  DRIVER_ACCEPTED: 'Aceite pelo motorista',
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

function formatEngine(value) {
  const mapping = {
    combustion: 'Combustão',
    electric: 'Elétrico',
    hybrid: 'Híbrido',
  };
  return mapping[value] || value || '-';
}

const DriverTripCard = ({ trip }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.article
      className="driver-history-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div
        className="driver-history-card-header"
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer', marginBottom: expanded ? '14px' : '0' }}
      >
        <div>
          <span className="driver-history-trip-id">Viagem #{trip.id}</span>
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
            <div className="driver-history-route">
              <div className="driver-history-route-point">
                <MapPin size={16} />
                <span title={trip.originAddress}>{simplifyAddress(trip.originAddress) || '-'}</span>
              </div>
              <ArrowRight size={18} className="driver-history-route-arrow" />
              <div className="driver-history-route-point">
                <MapPin size={16} />
                <span title={trip.destAddress}>{simplifyAddress(trip.destAddress) || '-'}</span>
              </div>
            </div>

            <div className="driver-history-details">
              <div>
                <span><User size={14} /> Cliente</span>
                <strong>
                  {trip.client_name || '-'}
                </strong>
              </div>
              <div>
                <span><Clock size={14} /> Início</span>
                <strong>{formatDateTimePT(trip.interval?.start_time)}</strong>
              </div>
              <div>
                <span><Clock size={14} /> Fim</span>
                <strong>{formatDateTimePT(trip.interval?.end_time)}</strong>
              </div>
              <div>
                <span><Star size={14} /> Serviço</span>
                <strong>{formatComfort(trip.comfort_level)}</strong>
              </div>
              <div>
                <span><Car size={14} /> Táxi</span>
                <strong>
                  {[trip.taxi_brand, trip.taxi_model, trip.taxi_plate].filter(Boolean).join(' ') || '-'}
                </strong>
              </div>
              <div>
                <span><Zap size={14} /> Motor</span>
                <strong>{formatEngine(trip.taxi_engine)}</strong>
              </div>
              <div>
                <span><Users size={14} /> Lugares do táxi</span>
                <strong>{trip.taxi_passengers ?? '-'}</strong>
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
};

export default function DriverHistory() {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const { data } = await listTrips();
        const mine = data
          .filter((trip) => trip.driver_id === user.id)
          .sort((a, b) => getTripDateValue(b) - getTripDateValue(a));
        setTrips(mine);
      } catch (err) {
        setError(err.response?.data?.error || err.response?.data?.detail || 'Erro ao carregar o histórico de viagens.');
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
          acc.earned += Number(trip.price) || 0;
        }
        return acc;
      },
      { count: 0, kilometers: 0, earned: 0 }
    );
  }, [trips]);

  return (
    <div className="driver-history-page">
      <section className="driver-history-toolbar">
        <div>
          <h1>Histórico de viagens</h1>

        </div>
      </section>

      <section className="driver-history-stats">
        <div className="driver-history-stat">
          <div className="driver-history-stat-header">
            <Clock size={18} />
            <span>Viagens</span>
          </div>
          <strong>{totals.count}</strong>
        </div>
        <div className="driver-history-stat">
          <div className="driver-history-stat-header">
            <Route size={18} />
            <span>Quilómetros</span>
          </div>
          <strong>{totals.kilometers.toFixed(1)} km</strong>
        </div>
        <div className="driver-history-stat">
          <div className="driver-history-stat-header">
            <Wallet size={18} />
            <span>Total</span>
          </div>
          <strong>{formatPrice(totals.earned)}</strong>
        </div>
      </section>

      {loading && <div className="driver-history-message">A carregar viagens...</div>}
      {error && <div className="driver-history-message driver-history-message--error">{error}</div>}

      {!loading && !error && trips.length === 0 && (
        <div className="driver-history-empty">
          Ainda não existem viagens associadas a esta conta de motorista.
        </div>
      )}

      {!loading && !error && trips.length > 0 && (
        <section className="driver-history-list">
          {trips.map((trip) => (
            <DriverTripCard key={trip.id} trip={trip} />
          ))}
        </section>
      )}
    </div>
  );
}
