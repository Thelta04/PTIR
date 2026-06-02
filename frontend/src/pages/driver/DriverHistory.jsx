import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Car, Clock, MapPin, Route, User, Wallet } from 'lucide-react';
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

function formatEngine(value) {
  const mapping = {
    combustion: 'Combustão',
    electric: 'Elétrico',
    hybrid: 'Híbrido',
  };
  return mapping[value] || value || '-';
}

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
        acc.count += 1;
        acc.kilometers += Number(trip.kilometers) || 0;
        acc.earned += Number(trip.price) || 0;
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
          <Clock size={18} />
          <span>Viagens</span>
          <strong>{totals.count}</strong>
        </div>
        <div className="driver-history-stat">
          <Route size={18} />
          <span>Quilómetros</span>
          <strong>{totals.kilometers.toFixed(1)} km</strong>
        </div>
        <div className="driver-history-stat">
          <Wallet size={18} />
          <span>Total</span>
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
            <motion.article
              key={trip.id}
              className="driver-history-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="driver-history-card-header">
                <div>
                  <span className="driver-history-trip-id">Viagem #{trip.id}</span>
                  <h2>{formatDateTimePT(trip.interval?.start_time)}</h2>
                </div>
                <span className={`trip-badge ${STATUS_CLASSES[trip.status] || ''}`}>
                  {STATUS_LABELS[trip.status] || trip.status}
                </span>
              </div>

              <div className="driver-history-route">
                <div className="driver-history-route-point">
                  <MapPin size={16} />
                  <span>{trip.originAddress || '-'}</span>
                </div>
                <ArrowRight size={18} className="driver-history-route-arrow" />
                <div className="driver-history-route-point">
                  <MapPin size={16} />
                  <span>{trip.destAddress || '-'}</span>
                </div>
              </div>

              <div className="driver-history-details">
                <div>
                  <span>Cliente</span>
                  <strong>
                    <User size={14} />
                    {trip.client_name || '-'}
                  </strong>
                </div>
                <div>
                  <span>Início</span>
                  <strong>{formatDateTimePT(trip.interval?.start_time)}</strong>
                </div>
                <div>
                  <span>Fim</span>
                  <strong>{formatDateTimePT(trip.interval?.end_time)}</strong>
                </div>
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
                  <span>Táxi</span>
                  <strong>
                    <Car size={14} />
                    {[trip.taxi_brand, trip.taxi_model, trip.taxi_plate].filter(Boolean).join(' ') || '-'}
                  </strong>
                </div>
                <div>
                  <span>Motor</span>
                  <strong>{formatEngine(trip.taxi_engine)}</strong>
                </div>
                <div>
                  <span>Lugares do táxi</span>
                  <strong>{trip.taxi_passengers ?? '-'}</strong>
                </div>
              </div>
            </motion.article>
          ))}
        </section>
      )}
    </div>
  );
}
