import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  Search,
  Bell,
  LogOut,
  Users,
  Car,
  CalendarClock,
  BarChart3,
  X,
  User
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { listDrivers, listTaxis, listAllShifts, createDriver, createTaxi, createShift, listClients, createClient } from '../../api/client';

const sidebarItems = [
  { key: 'clients', label: 'Clients', icon: User },
  { key: 'drivers', label: 'Drivers', icon: Users },
  { key: 'taxis', label: 'Taxis', icon: Car },
  { key: 'shifts', label: 'Shifts', icon: CalendarClock },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
];

export default function ManagerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('clients');
  const [data, setData] = useState({ clients: [], drivers: [], taxis: [], shifts: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiStatus, setApiStatus] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const fetchData = useCallback(() => {
    setLoading(true);
    setError('');

    if (activeSection === 'clients') {
      listClients()
        .then(res => {
          setData(d => ({ ...d, clients: res.data }));
          setApiStatus(`Fetched ${res.data.length} client records from API`);
          setTimeout(() => setApiStatus(''), 4000);
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    } else if (activeSection === 'drivers') {
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

  useEffect(() => {
    fetchData();
    setIsModalOpen(false); // Close modal when switching tabs
  }, [fetchData]);

  // Make sure we have drivers and taxis for shift creation modal
  useEffect(() => {
    if (activeSection === 'shifts') {
      if (data.drivers.length === 0) listDrivers().then(res => setData(d => ({ ...d, drivers: res.data }))).catch(() => {});
      if (data.taxis.length === 0) listTaxis().then(res => setData(d => ({ ...d, taxis: res.data }))).catch(() => {});
    }
  }, [activeSection]); // eslint-disable-line

  const handleLogout = () => {
    logout();
    navigate('/login-manager');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');

    let request;
    if (activeSection === 'clients') {
      request = createClient(formData);
    } else if (activeSection === 'drivers') {
      request = createDriver(formData);
    } else if (activeSection === 'taxis') {
      request = createTaxi(formData);
    } else if (activeSection === 'shifts') {
      const payload = {
        ...formData,
        driver_id: parseInt(formData.driver_id, 10)
      };
      request = createShift(payload);
    }

    if (request) {
      request
        .then(() => {
          setIsModalOpen(false);
          setFormData({});
          fetchData();
        })
        .catch(err => {
            const errData = err.response?.data;
            const errorMsg = typeof errData === 'object' ? JSON.stringify(errData) : err.message;
            setSubmitError(errorMsg || 'Error occurred');
        })
        .finally(() => {
          setSubmitting(false);
        });
    }
  };

  const renderFormFields = () => {
    if (activeSection === 'clients') {
      return (
        <>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">NIF</label>
            <input className="auth-input" name="nif" required onChange={handleInputChange} />
          </div>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">Name</label>
            <input className="auth-input" name="name" required onChange={handleInputChange} />
          </div>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">Email</label>
            <input className="auth-input" type="email" name="email" required onChange={handleInputChange} />
          </div>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">Gender</label>
            <select className="auth-input" name="gender" required onChange={handleInputChange} defaultValue="">
              <option value="" disabled>Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">Password</label>
            <input className="auth-input" type="password" name="password" required onChange={handleInputChange} />
          </div>
        </>
      );
    }
    if (activeSection === 'drivers') {
      return (
        <>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">NIF</label>
            <input className="auth-input" name="nif" required onChange={handleInputChange} />
          </div>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">Name</label>
            <input className="auth-input" name="name" required onChange={handleInputChange} />
          </div>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">Email</label>
            <input className="auth-input" type="email" name="email" required onChange={handleInputChange} />
          </div>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">Gender</label>
            <select className="auth-input" name="gender" required onChange={handleInputChange} defaultValue="">
              <option value="" disabled>Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">Password</label>
            <input className="auth-input" type="password" name="password" required onChange={handleInputChange} />
          </div>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">License Number</label>
            <input className="auth-input" name="license_number" required onChange={handleInputChange} />
          </div>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">Birth Year</label>
            <input className="auth-input" name="birth_year" type="number" min="1900" max="2026" required onChange={handleInputChange} />
          </div>
        </>
      );
    }
    if (activeSection === 'taxis') {
      return (
        <>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">License Plate (XX-XX-XX)</label>
            <input className="auth-input" name="license_plate" required onChange={handleInputChange} />
          </div>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">Purchase Year</label>
            <input className="auth-input" name="purchase_year" type="number" min="1900" max="2026" required onChange={handleInputChange} />
          </div>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">Mileage</label>
            <input className="auth-input" name="mileage" type="number" required onChange={handleInputChange} />
          </div>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">Brand</label>
            <input className="auth-input" name="brand" required onChange={handleInputChange} />
          </div>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">Model</label>
            <input className="auth-input" name="model" required onChange={handleInputChange} />
          </div>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">Comfort Level</label>
            <select className="auth-input" name="comfort_level" required onChange={handleInputChange} defaultValue="">
              <option value="" disabled>Select Level</option>
              <option value="basic">Basic</option>
              <option value="luxury">Luxury</option>
            </select>
          </div>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">Engine Type</label>
            <input className="auth-input" name="engine_type" required onChange={handleInputChange} />
          </div>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">Num Passengers</label>
            <input className="auth-input" name="num_passengers" type="number" min="1" max="10" required onChange={handleInputChange} />
          </div>
        </>
      );
    }
    if (activeSection === 'shifts') {
      return (
        <>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">Driver</label>
            <select className="auth-input" name="driver_id" required onChange={handleInputChange} defaultValue="">
              <option value="" disabled>Select Driver</option>
              {data.drivers.map(d => (
                <option key={d.nif} value={d.id}>
                  {d.name} ({d.nif})
                </option>
              ))}
            </select>
          </div>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">Taxi</label>
            <select className="auth-input" name="taxi_license_plate" required onChange={handleInputChange} defaultValue="">
              <option value="" disabled>Select Taxi</option>
              {data.taxis.map(t => (
                <option key={t.license_plate} value={t.license_plate}>
                  {t.brand} {t.model} ({t.license_plate})
                </option>
              ))}
            </select>
          </div>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">Start Time</label>
            <input className="auth-input" type="datetime-local" name="start_time" required onChange={handleInputChange} />
          </div>
          <div className="auth-field" style={{marginBottom: 12}}>
            <label className="auth-label">End Time</label>
            <input className="auth-input" type="datetime-local" name="end_time" required onChange={handleInputChange} />
          </div>
        </>
      );
    }
    return null;
  };

  return (
    <div className="dashboard">
      {/* Modal Details */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
              display: 'flex', justifyContent: 'center', alignItems: 'center'
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              style={{
                background: '#fff', padding: '24px', borderRadius: '12px',
                width: '400px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto',
                position: 'relative', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
              }}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#666' }}
              >
                <X size={20} />
              </button>
              
              <h2 style={{ marginBottom: '20px', color: '#1f2937', fontWeight: 600 }}>
                Create New {activeSection.slice(0, -1).charAt(0).toUpperCase() + activeSection.slice(0, -1).slice(1)}
              </h2>
              
              <form onSubmit={handleSubmit}>
                {renderFormFields()}
                
                {submitError && (
                  <div style={{ color: 'red', fontSize: '13px', marginBottom: '12px' }}>
                    {submitError}
                  </div>
                )}
                
                <button type="submit" className="auth-btn" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <h1 className="dash-title">{sidebarItems.find(i => i.key === activeSection)?.label}</h1>
                {['clients', 'drivers', 'taxis', 'shifts'].includes(activeSection) && (
                  <button 
                    onClick={() => {
                        setFormData({});
                        setSubmitError('');
                        setIsModalOpen(true);
                    }} 
                    style={{
                      background: '#16a34a', color: 'white', border: 'none', 
                      borderRadius: '6px', padding: '6px 12px', fontSize: '13px', 
                      fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    + Add New
                  </button>
                )}
              </div>
              
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
            ) : activeSection === 'clients' ? (
              <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <th style={{ padding: '12px 16px' }}>ID</th>
                      <th style={{ padding: '12px 16px' }}>NIF</th>
                      <th style={{ padding: '12px 16px' }}>Name</th>
                      <th style={{ padding: '12px 16px' }}>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.clients.map((c, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f9f9f9' }}>
                        <td style={{ padding: '12px 16px' }}>{c.id || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>{c.nif}</td>
                        <td style={{ padding: '12px 16px' }}>{c.name}</td>
                        <td style={{ padding: '12px 16px' }}>{c.email}</td>
                      </tr>
                    ))}
                    {data.clients.length === 0 && <tr><td colSpan="4" style={{ padding: '16px' }}>No clients found.</td></tr>}
                  </tbody>
                </table>
              </div>
            ) : activeSection === 'drivers' ? (
              <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <th style={{ padding: '12px 16px' }}>ID</th>
                      <th style={{ padding: '12px 16px' }}>NIF</th>
                      <th style={{ padding: '12px 16px' }}>Name</th>
                      <th style={{ padding: '12px 16px' }}>Email</th>
                      <th style={{ padding: '12px 16px' }}>License</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.drivers.map((d, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f9f9f9' }}>
                        <td style={{ padding: '12px 16px' }}>{d.id || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>{d.nif}</td>
                        <td style={{ padding: '12px 16px' }}>{d.name}</td>
                        <td style={{ padding: '12px 16px' }}>{d.email}</td>
                        <td style={{ padding: '12px 16px' }}>{d.license_number}</td>
                      </tr>
                    ))}
                    {data.drivers.length === 0 && <tr><td colSpan="5" style={{ padding: '16px' }}>No drivers found.</td></tr>}
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
                        <td style={{ padding: '12px 16px' }}>{s.scheduled_interval?.start_time ? new Date(s.scheduled_interval.start_time).toLocaleString() : '-'}</td>
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
