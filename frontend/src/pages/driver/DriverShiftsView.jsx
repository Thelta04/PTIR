import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { listShifts, startShift, endShift, deleteShift } from '../../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, Clock, Trash2, Filter } from 'lucide-react';
import ConfirmationModal from '../../components/ConfirmationModal';
import { formatDateTimePT } from '../../utils/dateFormat';

function formatDt(iso) {
  return formatDateTimePT(iso);
}

export default function DriverShiftsView() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [filter, setFilter] = useState('pending'); // 'pending' (Por realizar), 'completed' (Concluído), 'missed' (Não realizado)

  // Modal State for Start/Delete
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const { data } = await listShifts(user.id);
      // Sort by date
      const sorted = [...data].sort((a, b) => 
        new Date(a.scheduled_interval?.start_time) - new Date(b.scheduled_interval?.start_time)
      );
      setShifts(sorted);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar turnos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchShifts(); }, []);

  const handleStart = async (id) => {
    // Only allow to clock in one shift at a time
    const hasActive = shifts.some(s => s.real_interval && !s.real_interval.end_time);
    if (hasActive) {
      alert('Já tem um turno em curso. Termine o turno atual antes de iniciar um novo.');
      return;
    }

    setModalConfig({
      isOpen: true,
      title: 'Iniciar Turno',
      message: 'Tem a certeza que deseja iniciar este turno agora?',
      onConfirm: async () => {
        try {
          await startShift(id);
          setActionMsg('Turno iniciado!');
          fetchShifts();
        } catch (err) {
          setActionMsg(err.response?.data?.error || 'Erro ao iniciar turno.');
        }
        closeModal();
      }
    });
  };

  const handleEnd = async (id) => {
    setModalConfig({
      isOpen: true,
      title: 'Terminar Turno',
      message: 'Deseja terminar o seu turno atual?',
      onConfirm: async () => {
        try {
          await endShift(id);
          setActionMsg('Turno terminado!');
          fetchShifts();
        } catch (err) {
          setActionMsg(err.response?.data?.error || 'Erro ao terminar turno.');
        }
        closeModal();
      }
    });
  };

  const handleDelete = async (id) => {
    setModalConfig({
      isOpen: true,
      title: 'Eliminar Turno',
      message: 'Tem a certeza que deseja apagar este turno? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        try {
          await deleteShift(id);
          setActionMsg('Turno apagado com sucesso!');
          fetchShifts();
        } catch (err) {
          const errData = err.response?.data;
          const errorMsg = typeof errData === 'object' ? JSON.stringify(errData) : err.message;
          alert(`Falha ao apagar turno: ${errorMsg}`);
        }
        closeModal();
      }
    });
  };

  const filteredShifts = shifts.filter(s => {
    const started = s.real_interval !== null;
    const ended = started && s.real_interval?.end_time !== null;
    const now = new Date();
    const isMissed = !started && new Date(s.scheduled_interval?.end_time) < now;
    
    if (filter === 'pending') {
      return (!started && !isMissed) || (started && !ended);
    } else if (filter === 'completed') {
      return ended;
    } else if (filter === 'missed') {
      return isMissed;
    }
    return true;
  }).sort((a, b) => {
    if (filter === 'pending') {
      const isAActive = a.real_interval !== null && a.real_interval.end_time === null;
      const isBActive = b.real_interval !== null && b.real_interval.end_time === null;
      if (isAActive && !isBActive) return -1;
      if (!isAActive && isBActive) return 1;
    }

    const dateA = new Date(a.scheduled_interval?.start_time);
    const dateB = new Date(b.scheduled_interval?.start_time);
    return filter === 'completed' ? dateB - dateA : dateA - dateB;
  });

  return (
    <div className="driver-shifts-view" style={{ padding: '2rem', background: '#fff', minHeight: '100%' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 className="dash-title" style={{ margin: 0 }}>Consultar turnos</h1>
        
        <div className="filter-group">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: '#fff',
              fontSize: '1rem',
              fontWeight: '500',
              color: '#374151',
              cursor: 'pointer',
              outline: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <option value="pending">Por realizar</option>
            <option value="completed">Concluído</option>
            <option value="missed">Não realizado</option>
          </select>
        </div>
      </header>

      {actionMsg && (
        <motion.div
          className="dash-toast"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ background: '#ecfdf5', color: '#065f46', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #a7f3d0' }}
        >
          {actionMsg}
        </motion.div>
      )}

      {loading && <p className="dash-loading">A carregar turnos…</p>}
      {error && <p className="dash-error">{error}</p>}

      {!loading && filteredShifts.length === 0 && (
        <div className="dash-placeholder-card" style={{ textAlign: 'center', padding: '3rem', background: '#f9fafb', borderRadius: '12px', border: '2px dashed #e5e7eb' }}>
          <p style={{ color: '#6b7280', fontSize: '1.1rem' }}>
            {filter === 'pending' ? 'Não tem turnos por realizar ou em curso.' : 
             filter === 'completed' ? 'Não tem turnos concluídos.' : 
             'Não tem turnos não realizados.'}
          </p>
        </div>
      )}

      <div className="shift-grid">
        {filteredShifts.map((s) => {
          const started = s.real_interval !== null;
          const ended = started && s.real_interval?.end_time !== null;
          const now = new Date();
          const isMissed = !started && new Date(s.scheduled_interval?.end_time) < now;

          return (
            <motion.div
              key={s.id}
              className="shift-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="shift-card-header">
                <Clock size={16} />
                <span className="shift-card-id">Turno #{s.id}</span>
                <span className={`shift-badge ${isMissed ? 'shift-badge--missed' : ended ? 'shift-badge--done' : started ? 'shift-badge--active' : 'shift-badge--pending'}`}
                      style={isMissed ? { background: '#fee2e2', color: '#991b1b' } : {}}>
                  {isMissed ? 'Não Realizado' : ended ? 'Concluído' : started ? 'Em Curso' : 'Agendado'}
                </span>
              </div>

              <div className="shift-card-body">
                <p><strong>Táxi:</strong> {s.taxi_plate}</p>
                <p><strong>Agendado:</strong> {formatDt(s.scheduled_interval?.start_time)} → {formatDt(s.scheduled_interval?.end_time)}</p>
                {started && (
                  <p><strong>Real:</strong> {formatDt(s.real_interval?.start_time)} → {formatDt(s.real_interval?.end_time)}</p>
                )}
              </div>

              <div className="shift-card-actions">
                {!started && (
                  <>
                    {!isMissed && (
                      <button className="btn btn--primary" onClick={() => handleStart(s.id)}>
                        <Play size={14} /> Iniciar
                      </button>
                    )}
                    <button 
                      className="btn btn--danger-outline" 
                      onClick={() => handleDelete(s.id)}
                      style={{
                        background: 'transparent',
                        border: '1px solid #ef4444',
                        color: '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 600
                      }}
                    >
                      <Trash2 size={14} /> Apagar
                    </button>
                  </>
                )}
                {started && !ended && (
                  <button className="btn btn--danger" onClick={() => handleEnd(s.id)}>
                    <Square size={14} /> Terminar Turno
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <ConfirmationModal 
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onCancel={closeModal}
      />
    </div>
  );
}
