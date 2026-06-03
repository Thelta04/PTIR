import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronDown, ChevronUp, MapPin, Menu, Receipt, User, Wallet, FileText, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { listClientInvoices } from '../../api/client';
import ProfileModal from '../../components/ProfileModal';
import SharedHeader from '../../components/SharedHeader';
import SharedDrawer from '../../components/SharedDrawer';
import { formatDateTimePT } from '../../utils/dateFormat';
import './client.css';

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

function formatPrice(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `€${number.toFixed(2)}` : '-';
}

const ClientInvoiceCard = ({ invoice }) => {
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
          <span className="history-trip-id">Fatura #{invoice.number}</span>
          <h2>{new Date(invoice.date).toLocaleDateString('pt-PT')}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="trip-badge trip-badge--done">
            Emitida
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
                <span title={invoice.originAddress}>{simplifyAddress(invoice.originAddress) || '-'}</span>
              </div>
              <ArrowRight size={18} className="history-route-arrow" />
              <div className="history-route-point">
                <MapPin size={16} />
                <span title={invoice.destAddress}>{simplifyAddress(invoice.destAddress) || '-'}</span>
              </div>
            </div>

            <div className="history-trip-details">
              <div>
                <span><Calendar size={14} /> Data Viagem</span>
                <strong>{invoice.trip_start_time ? formatDateTimePT(invoice.trip_start_time) : '-'}</strong>
              </div>
              <div>
                <span><Wallet size={14} /> Valor Total</span>
                <strong>{formatPrice(invoice.amount_total)}</strong>
              </div>
              <div>
                <span><Receipt size={14} /> NIF</span>
                <strong>{invoice.nif || '-'}</strong>
              </div>
              <div>
                <span><User size={14} /> Motorista</span>
                <strong>{invoice.driver_name || '-'}</strong>
              </div>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <a
                href={`/api/trip/${invoice.trip_id}/invoice/`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.9rem', color: '#854d0e' }}
              >
                <FileText size={16} color='#854d0e' /> Ver Fatura PDF
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
};

export default function ClientInvoices() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const { data } = await listClientInvoices(user.id);
        setInvoices(data);
      } catch (err) {
        setError(err.response?.data?.error || 'Erro ao carregar as faturas.');
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) fetchInvoices();
  }, [user.id]);

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
        <h1 className="history-title">Minhas Faturas</h1>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>A carregar faturas...</div>
        ) : error ? (
          <div className="history-empty" style={{ color: '#d9534f' }}>{error}</div>
        ) : invoices.length === 0 ? (
          <div className="history-empty">Não tem faturas emitidas.</div>
        ) : (
          <div className="history-list">
            {invoices.map((invoice) => (
              <ClientInvoiceCard key={invoice.number} invoice={invoice} user={user} />
            ))}
          </div>
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
            <button className="drawer-link drawer-link--active" onClick={() => handleMenuClick('/client/invoices')}>
              Faturas
            </button>
          </SharedDrawer>
        )}
      </AnimatePresence>

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onLogout={handleLogout}
      />
    </div>
  );
}
