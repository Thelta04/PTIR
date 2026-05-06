import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { listShifts, startShift, endShift, deleteShift } from '../../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, Clock, Trash2 } from 'lucide-react';

function formatDt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function DriverShiftsView() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  // Delete State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const { data } = await listShifts(user.id);
      setShifts(data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load shifts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchShifts(); }, []);

  const handleStart = async (id) => {
    try {
      await startShift(id);
      setActionMsg('Shift started!');
      fetchShifts();
    } catch (err) {
      setActionMsg(err.response?.data?.error || 'Failed to start shift.');
    }
  };

  const handleEnd = async (id) => {
    try {
      await endShift(id);
      setActionMsg('Shift ended!');
      fetchShifts();
    } catch (err) {
      setActionMsg(err.response?.data?.error || 'Failed to end shift.');
    }
  };

  const handleDelete = async () => {
    if (!shiftToDelete) return;
    try {
      setDeleting(true);
      await deleteShift(shiftToDelete);
      setActionMsg('Turno apagado com sucesso!');
      setIsDeleteModalOpen(false);
      setShiftToDelete(null);
      fetchShifts();
    } catch (err) {
      const errData = err.response?.data;
      const errorMsg = typeof errData === 'object' ? JSON.stringify(errData) : err.message;
      alert(`Falha ao apagar turno: ${errorMsg}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="driver-shifts-view" style={{ padding: '2rem', background: '#fff', minHeight: '100%' }}>
      <h1 className="dash-title">Consultar turnos</h1>

      {actionMsg && (
        <motion.div
          className="dash-toast"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {actionMsg}
        </motion.div>
      )}

      {loading && <p className="dash-loading">Loading shifts…</p>}
      {error && <p className="dash-error">{error}</p>}

      {!loading && shifts.length === 0 && (
        <div className="dash-placeholder-card">
          <p>No shifts assigned to you yet.</p>
        </div>
      )}

      <div className="shift-grid">
        {shifts.map((s) => {
          const started = s.real_interval !== null;
          const ended = started && s.real_interval?.end_time !== null;

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
                <span className="shift-card-id">Shift #{s.id}</span>
                <span className={`shift-badge ${ended ? 'shift-badge--done' : started ? 'shift-badge--active' : 'shift-badge--pending'}`}>
                  {ended ? 'Completed' : started ? 'In Progress' : 'Scheduled'}
                </span>
              </div>

              <div className="shift-card-body">
                <p><strong>Taxi:</strong> {s.taxi_plate}</p>
                <p><strong>Scheduled:</strong> {formatDt(s.scheduled_interval?.start_time)} → {formatDt(s.scheduled_interval?.end_time)}</p>
                {started && (
                  <p><strong>Actual:</strong> {formatDt(s.real_interval?.start_time)} → {formatDt(s.real_interval?.end_time)}</p>
                )}
              </div>

              <div className="shift-card-actions">
                {!started && (
                  <>
                    <button className="btn btn--primary" onClick={() => handleStart(s.id)}>
                      <Play size={14} /> Clock In
                    </button>
                    <button 
                      className="btn btn--danger-outline" 
                      onClick={() => {
                        setShiftToDelete(s.id);
                        setIsDeleteModalOpen(true);
                      }}
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
                    <Square size={14} /> Clock Out
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {isDeleteModalOpen && (
          <motion.div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100,
              display: 'flex', justifyContent: 'center', alignItems: 'center'
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              style={{
                background: '#fff', padding: '24px', borderRadius: '12px',
                width: '350px', maxWidth: '90%', textAlign: 'center',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
              }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <h3 style={{ marginBottom: '12px', color: '#1f2937' }}>Confirmar Eliminação</h3>
              <p style={{ marginBottom: '24px', color: '#4b5563', fontSize: '14px' }}>
                Tem a certeza que deseja apagar este turno? Esta ação não pode ser desfeita.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  style={{
                    padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db',
                    background: '#fff', cursor: 'pointer', fontWeight: 500
                  }}
                  disabled={deleting}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  style={{
                    padding: '8px 16px', borderRadius: '6px', border: 'none',
                    background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 500
                  }}
                  disabled={deleting}
                >
                  {deleting ? 'A apagar...' : 'Apagar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

