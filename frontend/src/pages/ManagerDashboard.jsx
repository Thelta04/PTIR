import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Menu,
  Search,
  Bell,
  LogOut,
  Users,
  Car,
  CalendarClock,
  BarChart3,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { listDrivers, listTaxis, listAllShifts } from '../api/client';

const sidebarItems = [
  { key: 'drivers', label: 'Drivers', icon: Users },
  { key: 'taxis', label: 'Taxis', icon: Car },
  { key: 'shifts', label: 'Shifts', icon: CalendarClock },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
];

export default function ManagerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('drivers');
  const [data, setData] = useState({ drivers: [], taxis: [], shifts: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiStatus, setApiStatus] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');

    if (activeSection === 'drivers') {
      listDrivers()
        .then(res => {
          setData(d => ({ ...d, drivers: res.data }));
          setApiStatus(`Fetched ${res.data.length} driver records from API`);
          setTimeout(() => setApiStatus(''), 4000);
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    } else if (activeSection === 'taxis') {
      listTaxis()
        .then(res => {
          setData(d => ({ ...d, taxis: res.data }));
          setApiStatus(`Fetched ${res.data.length} taxi records from API`);
          setTimeout(() => setApiStatus(''), 4000);
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    } else if (activeSection === 'shifts') {
      listAllShifts()
        .then(res => {
          setData(d => ({ ...d, shifts: res.data }));
          setApiStatus(`Fetched ${res.data.length} shift records from API`);
          setTimeout(() => setApiStatus(''), 4000);
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [activeSection]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dash-header">
        <div className="dash-header-left">
          <button
            className="dash-icon-btn"
            onClick={() => setSidebarOpen((p) => !p)}
            aria-label="Toggle sidebar"
          >
            <Menu size={20} />
          </button>
          <div className="dash-brand">
            <span className="dash-brand-name">TUXY</span>
            <span className="dash-brand-sub">Manager</span>
          </div>
        </div>

        <div className="dash-header-right">
          <span className="dash-greeting">Hello, {user?.name}</span>
          <button className="dash-icon-btn" aria-label="Search">
            <Search size={18} />
          </button>
          <button className="dash-icon-btn" aria-label="Notifications">
            <Bell size={18} />
          </button>
          <button className="dash-icon-btn dash-icon-btn--danger" onClick={handleLogout} aria-label="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="dash-body">
        {/* Sidebar */}
        <motion.aside
          className="dash-sidebar"
          animate={{ width: sidebarOpen ? 200 : 0, opacity: sidebarOpen ? 1 : 0 }}
          transition={{ duration: 0.25 }}
        >
          <nav className="dash-nav">
            {sidebarItems.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                className={`dash-nav-item ${activeSection === key ? 'dash-nav-item--active' : ''}`}
                onClick={() => setActiveSection(key)}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </motion.aside>

        {/* Main */}
        <main className="dash-main">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h1 className="dash-title">{sidebarItems.find(i => i.key === activeSection)?.label}</h1>
              {apiStatus && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ color: '#16a34a', fontSize: '14px', fontWeight: '500', background: '#dcfce7', padding: '6px 12px', borderRadius: '20px' }}
                >
                  {apiStatus}
                </motion.div>
              )}
            </div>

            {loading ? (
              <div className="dash-placeholder-card">Loading {activeSection}...</div>
            ) : error ? (
              <div className="dash-placeholder-card" style={{ color: 'red' }}>
                Failed to load {activeSection}. Make sure you are logged in correctly and endpoints exist. ({error})
              </div>
            ) : activeSection === 'drivers' ? (
              <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <th style={{ padding: '12px 16px' }}>NIF</th>
                      <th style={{ padding: '12px 16px' }}>Name</th>
                      <th style={{ padding: '12px 16px' }}>Email</th>
                      <th style={{ padding: '12px 16px' }}>License</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.drivers.map((d, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f9f9f9' }}>
                        <td style={{ padding: '12px 16px' }}>{d.nif}</td>
                        <td style={{ padding: '12px 16px' }}>{d.name}</td>
                        <td style={{ padding: '12px 16px' }}>{d.email}</td>
                        <td style={{ padding: '12px 16px' }}>{d.license_number}</td>
                      </tr>
                    ))}
                    {data.drivers.length === 0 && <tr><td colSpan="4" style={{ padding: '16px' }}>No drivers found.</td></tr>}
                  </tbody>
                </table>
              </div>
            ) : activeSection === 'taxis' ? (
              <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <th style={{ padding: '12px 16px' }}>Plate</th>
                      <th style={{ padding: '12px 16px' }}>Brand</th>
                      <th style={{ padding: '12px 16px' }}>Model</th>
                      <th style={{ padding: '12px 16px' }}>Engine</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.taxis.map((t, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f9f9f9' }}>
                        <td style={{ padding: '12px 16px' }}>{t.license_plate}</td>
                        <td style={{ padding: '12px 16px' }}>{t.brand}</td>
                        <td style={{ padding: '12px 16px' }}>{t.model}</td>
                        <td style={{ padding: '12px 16px' }}>{t.engine_type}</td>
                      </tr>
                    ))}
                    {data.taxis.length === 0 && <tr><td colSpan="4" style={{ padding: '16px' }}>No taxis found.</td></tr>}
                  </tbody>
                </table>
              </div>
            ) : activeSection === 'shifts' ? (
              <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <th style={{ padding: '12px 16px' }}>ID</th>
                      <th style={{ padding: '12px 16px' }}>Driver</th>
                      <th style={{ padding: '12px 16px' }}>Taxi</th>
                      <th style={{ padding: '12px 16px' }}>Scheduled Start</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.shifts.map((s, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f9f9f9' }}>
                        <td style={{ padding: '12px 16px' }}>{s.id}</td>
                        <td style={{ padding: '12px 16px' }}>{s.driver_name}</td>
                        <td style={{ padding: '12px 16px' }}>{s.taxi_plate}</td>
                        <td style={{ padding: '12px 16px' }}>{new Date(s.scheduled_interval?.start_time).toLocaleString()}</td>
                      </tr>
                    ))}
                    {data.shifts.length === 0 && <tr><td colSpan="4" style={{ padding: '16px' }}>No shifts found.</td></tr>}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="dash-placeholder-card">
                <p>Reports view is pending implementation.</p>
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
