import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { listShifts, startShift, endShift } from '../api/client';
import { motion } from 'framer-motion';
import { LogOut, Play, Square, Clock } from 'lucide-react';

function formatDt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function DriverDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

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

  const handleLogout = () => { logout(); navigate('/login-manager'); };

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-header-left">
          <div className="dash-brand">
            <span className="dash-brand-name">TUXY</span>
            <span className="dash-brand-sub">Driver</span>
          </div>
        </div>
        <div className="dash-header-right">
          <span className="dash-greeting">Hello, {user?.name}</span>
          <button className="dash-icon-btn dash-icon-btn--danger" onClick={handleLogout} aria-label="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="dash-main" style={{ padding: '2rem' }}>
        <h1 className="dash-title">My Shifts</h1>

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
                    <button className="btn btn--primary" onClick={() => handleStart(s.id)}>
                      <Play size={14} /> Clock In
                    </button>
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
      </main>
    </div>
  );
}
