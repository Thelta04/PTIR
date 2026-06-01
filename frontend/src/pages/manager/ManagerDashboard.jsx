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
  User,
  MapPin,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Edit2
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import {
  listDrivers, listTaxis, listAllShifts, createDriver, createTaxi, createShift,
  listClients, createClient, listTrips, deleteShift, toggleUserStatus, deleteUser,
  deleteTaxi, updateTaxiMileage, updateDriver, getReports, getDriver, getTaxi
} from '../../api/client';

const sidebarItems = [
  { key: 'clients', label: 'Clients', icon: User },
  { key: 'drivers', label: 'Drivers', icon: Users },
  { key: 'taxis', label: 'Taxis', icon: Car },
  { key: 'shifts', label: 'Shifts', icon: CalendarClock },
  { key: 'trips', label: 'Trips', icon: MapPin },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
];

export default function ManagerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('clients');
  const [data, setData] = useState({ clients: [], drivers: [], taxis: [], shifts: [], trips: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiStatus, setApiStatus] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState('');

  // Delete State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null); // { id, type: 'shift' | 'user' | 'taxi' }
  const [managerPassword, setManagerPassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Mileage Edit State
  const [isMileageModalOpen, setIsMileageModalOpen] = useState(false);
  const [taxiToEditMileage, setTaxiToEditMileage] = useState(null);
  const [newMileage, setNewMileage] = useState('');
  const [updatingMileage, setUpdatingMileage] = useState(false);

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
    } else if (activeSection === 'trips') {
      listTrips()
        .then(res => {
          setData(d => ({ ...d, trips: res.data }));
          setApiStatus(`Fetched ${res.data.length} trip records from API`);
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
      if (data.drivers.length === 0) listDrivers().then(res => setData(d => ({ ...d, drivers: res.data }))).catch(() => { });
      if (data.taxis.length === 0) listTaxis().then(res => setData(d => ({ ...d, taxis: res.data }))).catch(() => { });
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
    if (formMode === 'edit-driver') {
      const payload = { ...formData };
      delete payload.id;
      request = updateDriver(formData.id, payload);
    } else if (activeSection === 'clients') {
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
          // After a successful create/update: close modal and clear form.
          // User requested that creating a new client opens blank and the form closes on success.
          setIsModalOpen(false);
          setFormData({});
          setSubmitError('');
          setFormMode('create');
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

  const openEditDriver = (driver) => {
    setFormMode('edit-driver');
    setFormData({
      id: driver.id,
      nif: driver.nif || '',
      name: driver.name || '',
      email: driver.email || '',
      gender: driver.gender || '',
      password: '',
      license_number: driver.license_number || '',
      birth_year: driver.birth_year || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = () => {
    if (!itemToDelete) return;
    setDeleting(true);

    let request;
    if (itemToDelete.type === 'shift') {
      request = deleteShift(itemToDelete.id);
    } else if (itemToDelete.type === 'user') {
      request = deleteUser(itemToDelete.id, managerPassword);
    } else if (itemToDelete.type === 'taxi') {
      request = deleteTaxi(itemToDelete.id);
    }

    setDeleteError('');
    request
      .then(() => {
        setIsDeleteModalOpen(false);
        setItemToDelete(null);
        setManagerPassword('');
        fetchData();
        setApiStatus(`${itemToDelete.type.charAt(0).toUpperCase() + itemToDelete.type.slice(1)} deleted successfully`);
        setTimeout(() => setApiStatus(''), 4000);
      })
      .catch(err => {
        const errData = err.response?.data;
        const errorMsg = typeof errData === 'object' ? JSON.stringify(errData) : err.message;
        setDeleteError(errorMsg || 'Failed to delete');
      })
      .finally(() => {
        setDeleting(false);
      });
  };

  const handleUpdateMileage = (e) => {
    e.preventDefault();
    if (!taxiToEditMileage) return;
    setUpdatingMileage(true);
    updateTaxiMileage(taxiToEditMileage.license_plate, parseInt(newMileage, 10))
      .then(() => {
        setIsMileageModalOpen(false);
        setTaxiToEditMileage(null);
        setNewMileage('');
        fetchData();
        setApiStatus('Mileage updated successfully');
        setTimeout(() => setApiStatus(''), 4000);
      })
      .catch(err => {
        const errData = err.response?.data;
        const errorMsg = typeof errData === 'object' ? JSON.stringify(errData) : err.message;
        alert('Failed to update mileage: ' + errorMsg);
      })
      .finally(() => {
        setUpdatingMileage(false);
      });
  };

  const handleToggleStatus = (id) => {
    toggleUserStatus(id)
      .then(res => {
        setApiStatus(`User is now ${res.data.message}`);
        fetchData();
        setTimeout(() => setApiStatus(''), 4000);
      })
      .catch(err => {
        alert('Failed to toggle status');
      });
  };

  const renderFormFields = () => {
    if (activeSection === 'clients') {
      return (
        <>
          <div className="auth-field" style={{ marginBottom: 12 }}>
            <label className="auth-label">NIF</label>
            <input autoComplete="off" className="auth-input" name="nif" required onChange={handleInputChange} value={formData.nif || ''} />
          </div>
          <div className="auth-field" style={{ marginBottom: 12 }}>
            <label className="auth-label">Name</label>
            <input autoComplete="off" className="auth-input" name="name" required onChange={handleInputChange} value={formData.name || ''} />
          </div>
          <div className="auth-field" style={{ marginBottom: 12 }}>
            <label className="auth-label">Email</label>
            <input autoComplete="off" className="auth-input" type="email" name="email" required onChange={handleInputChange} value={formData.email || ''} />
          </div>
          <div className="auth-field" style={{ marginBottom: 12 }}>
            <label className="auth-label">Gender</label>
            <select autoComplete="off" className="auth-input" name="gender" required onChange={handleInputChange} value={formData.gender || ''}>
              <option value="" disabled>Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="auth-field" style={{ marginBottom: 12 }}>
            <label className="auth-label">Password</label>
            <input autoComplete="new-password" className="auth-input" type="password" name="password" onChange={handleInputChange} value={formData.password || ''} />
          </div>
        </>
      );
    }
    if (activeSection === 'drivers') {
      return (
        <>
          <div className="auth-field" style={{ marginBottom: 12 }}>
            <label className="auth-label">NIF</label>
            <input className="auth-input" name="nif" required onChange={handleInputChange} />
          </div>
          <div className="auth-field" style={{ marginBottom: 12 }}>
            <label className="auth-label">Name</label>
            <input className="auth-input" name="name" required onChange={handleInputChange} />
          </div>
          <div className="auth-field" style={{ marginBottom: 12 }}>
            <label className="auth-label">Email</label>
            <input className="auth-input" type="email" name="email" required onChange={handleInputChange} />
          </div>
          <div className="auth-field" style={{ marginBottom: 12 }}>
            <label className="auth-label">Gender</label>
            <select className="auth-input" name="gender" required onChange={handleInputChange} defaultValue="">
              <option value="" disabled>Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="auth-field" style={{ marginBottom: 12 }}>
            <label className="auth-label">Password</label>
            <input className="auth-input" type="password" name="password" required onChange={handleInputChange} />
          </div>
          <div className="auth-field" style={{ marginBottom: 12 }}>
            <label className="auth-label">License Number</label>
            <input className="auth-input" name="license_number" required onChange={handleInputChange} value={formData.license_number || ''} />
          </div>
          <div className="auth-field" style={{ marginBottom: 12 }}>
            <label className="auth-label">Birth Year</label>
            <input className="auth-input" name="birth_year" type="number" min="1900" max="2026" required onChange={handleInputChange} value={formData.birth_year || ''} />
          </div>
        </>
      );
    }
    if (activeSection === 'taxis') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '4px' }}>
          <div className="auth-field">
            <label className="auth-label">License Plate</label>
            <input className="auth-input" name="license_plate" placeholder="XX-XX-XX" required onChange={handleInputChange} value={formData.license_plate || ''} />
          </div>
          <div className="auth-field">
            <label className="auth-label">Purchase Year</label>
            <input className="auth-input" name="purchase_year" type="number" min="1900" max="2026" required onChange={handleInputChange} value={formData.purchase_year || ''} />
          </div>
          <div className="auth-field">
            <label className="auth-label">Mileage (km)</label>
            <input className="auth-input" name="mileage" type="number" required onChange={handleInputChange} value={formData.mileage || ''} />
          </div>
          <div className="auth-field">
            <label className="auth-label">Brand</label>
            <input className="auth-input" name="brand" placeholder="e.g. Tesla" required onChange={handleInputChange} value={formData.brand || ''} />
          </div>
          <div className="auth-field">
            <label className="auth-label">Model</label>
            <input className="auth-input" name="model" placeholder="e.g. Model 3" required onChange={handleInputChange} value={formData.model || ''} />
          </div>
          <div className="auth-field">
            <label className="auth-label">Passengers</label>
            <input className="auth-input" name="num_passengers" type="number" min="1" max="10" required onChange={handleInputChange} value={formData.num_passengers || ''} />
          </div>
          <div className="auth-field">
            <label className="auth-label">Comfort Level</label>
            <select className="auth-input" name="comfort_level" required onChange={handleInputChange} value={formData.comfort_level || ''}>
              <option value="" disabled>Select Level</option>
              <option value="basic">Basic</option>
              <option value="luxury">Luxury</option>
            </select>
          </div>
          <div className="auth-field">
            <label className="auth-label">Engine Type</label>
            <select className="auth-input" name="engine_type" required onChange={handleInputChange} value={formData.engine_type || ''}>
              <option value="" disabled>Select Engine</option>
              <option value="combustion">Combustion</option>
              <option value="electric">Electric</option>
            </select>
          </div>
        </div>
      );
    }
    if (activeSection === 'shifts') {
      return (
        <>
          <div className="auth-field" style={{ marginBottom: 12 }}>
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
          <div className="auth-field" style={{ marginBottom: 12 }}>
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
          <div className="auth-field" style={{ marginBottom: 12 }}>
            <label className="auth-label">Start Time</label>
            <input className="auth-input" type="datetime-local" name="start_time" required onChange={handleInputChange} />
          </div>
          <div className="auth-field" style={{ marginBottom: 12 }}>
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
                background: '#fff', padding: '32px', borderRadius: '16px',
                width: '600px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto',
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
                  {submitting ? (formMode === 'edit-driver' ? 'Saving...' : 'Saving...') : (formMode === 'edit-driver' ? 'Save Changes' : 'Create')}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mileage Update Modal */}
      <AnimatePresence>
        {isMileageModalOpen && (
          <motion.div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050,
              display: 'flex', justifyContent: 'center', alignItems: 'center'
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              style={{
                background: '#fff', padding: '32px', borderRadius: '16px',
                width: '500px', maxWidth: '95%',
                position: 'relative', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
              }}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
            >
              <button
                onClick={() => setIsMileageModalOpen(false)}
                style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#666' }}
              >
                <X size={20} />
              </button>

              <h2 style={{ marginBottom: '20px', color: '#1f2937', fontWeight: 600 }}>
                Update Mileage: {taxiToEditMileage?.license_plate}
              </h2>

              <form onSubmit={handleUpdateMileage}>
                <div className="auth-field" style={{ marginBottom: 20 }}>
                  <label className="auth-label">New Mileage (km)</label>
                  <input
                    className="auth-input"
                    type="number"
                    value={newMileage}
                    onChange={(e) => setNewMileage(e.target.value)}
                    required
                    min={taxiToEditMileage?.mileage || 0}
                  />
                </div>

                <button type="submit" className="auth-btn" disabled={updatingMileage}>
                  {updatingMileage ? 'Updating...' : 'Update Mileage'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
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
              <h3 style={{ marginBottom: '12px', color: '#1f2937' }}>Confirm Deletion</h3>
              <p style={{ marginBottom: '24px', color: '#4b5563', fontSize: '14px' }}>
                Are you sure you want to delete this {itemToDelete?.type}? This action cannot be undone.
              </p>
              {itemToDelete?.type === 'user' && (
                <div style={{ marginBottom: 12 }}>
                  <input
                    className="auth-input"
                    type="password"
                    placeholder="Manager password"
                    value={managerPassword}
                    onChange={(e) => setManagerPassword(e.target.value)}
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                  />
                </div>
              )}
              {deleteError && (
                <div style={{ color: 'red', marginBottom: 12 }}>{deleteError}</div>
              )}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  style={{
                    padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db',
                    background: '#fff', cursor: 'pointer', fontWeight: 500
                  }}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  style={{
                    padding: '8px 16px', borderRadius: '6px', border: 'none',
                    background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 500
                  }}
                  disabled={deleting || (itemToDelete?.type === 'user' && !managerPassword)}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
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
          <span className="dash-greeting">Hello, {user?.name?.split(' ')[0]}</span>
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
                      setFormMode('create');
                      // ensure client form opens with empty fields (avoid prefilled values)
                      if (activeSection === 'clients') {
                        setFormData({ nif: '', name: '', email: '', gender: '', password: '' });
                      } else {
                        setFormData({});
                      }
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
                      <th style={{ padding: '12px 16px' }}>Status</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.clients.map((c, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f9f9f9' }}>
                        <td style={{ padding: '12px 16px' }}>{c.id || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>{c.nif}</td>
                        <td style={{ padding: '12px 16px' }}>{c.name}</td>
                        <td style={{ padding: '12px 16px' }}>{c.email}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            color: c.is_banned ? '#ef4444' : '#16a34a',
                            background: c.is_banned ? '#fee2e2' : '#dcfce7',
                            padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600
                          }}>
                            {c.is_banned ? 'Banned' : 'Active'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                            <button
                              onClick={() => handleToggleStatus(c.id)}
                              style={{
                                border: 'none',
                                background: c.is_banned ? '#16a34a' : '#ef4444',
                                color: 'white',
                                padding: '4px 12px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                minWidth: '60px'
                              }}
                              title={c.is_banned ? 'Unban User' : 'Ban User'}
                            >
                              {c.is_banned ? 'UnBan' : 'Ban'}
                            </button>
                            <button
                              onClick={() => {
                                setItemToDelete({ id: c.id, type: 'user' });
                                setIsDeleteModalOpen(true);
                              }}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#666' }}
                              title="Delete User"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {data.clients.length === 0 && <tr><td colSpan="6" style={{ padding: '16px' }}>No clients found.</td></tr>}
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
                      <th style={{ padding: '12px 16px' }}>Status</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
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
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            color: d.is_banned ? '#ef4444' : '#16a34a',
                            background: d.is_banned ? '#fee2e2' : '#dcfce7',
                            padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600
                          }}>
                            {d.is_banned ? 'Banned' : 'Active'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                            <button
                              onClick={() => handleToggleStatus(d.id)}
                              style={{
                                border: 'none',
                                background: d.is_banned ? '#16a34a' : '#ef4444',
                                color: 'white',
                                padding: '4px 12px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                minWidth: '60px'
                              }}
                              title={d.is_banned ? 'Unban User' : 'Ban User'}
                            >
                              {d.is_banned ? 'UnBan' : 'Ban'}
                            </button>

                            <button
                              onClick={() => openEditDriver(d)}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#666' }}
                              title="Edit Driver"
                            >
                              <Edit2 size={18} />
                            </button>

                            <button
                              onClick={() => {
                                setItemToDelete({ id: d.id, type: 'user' });
                                setManagerPassword('');
                                setIsDeleteModalOpen(true);
                              }}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#666' }}
                              title="Delete User"
                            >
                              <Trash2 size={18} />
                            </button>

                          </div>
                        </td>
                      </tr>
                    ))}
                    {data.drivers.length === 0 && <tr><td colSpan="7" style={{ padding: '16px' }}>No drivers found.</td></tr>}
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
                      <th style={{ padding: '12px 16px' }}>Mileage</th>
                      <th style={{ padding: '12px 16px' }}>Engine</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.taxis.map((t, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f9f9f9' }}>
                        <td style={{ padding: '12px 16px' }}>{t.license_plate}</td>
                        <td style={{ padding: '12px 16px' }}>{t.brand}</td>
                        <td style={{ padding: '12px 16px' }}>{t.model}</td>
                        <td style={{ padding: '12px 16px' }}>{t.mileage.toLocaleString()} km</td>
                        <td style={{ padding: '12px 16px' }}>{t.engine_type}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                            <button
                              onClick={() => {
                                setTaxiToEditMileage(t);
                                setNewMileage(t.mileage.toString());
                                setIsMileageModalOpen(true);
                              }}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#16a34a' }}
                              title="Update Mileage"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => {
                                setItemToDelete({ id: t.license_plate, type: 'taxi' });
                                setIsDeleteModalOpen(true);
                              }}
                              style={{
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                              }}
                              title="Delete Taxi"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {data.taxis.length === 0 && <tr><td colSpan="6" style={{ padding: '16px' }}>No taxis found.</td></tr>}
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
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.shifts.map((s, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f9f9f9' }}>
                        <td style={{ padding: '12px 16px' }}>{s.id}</td>
                        <td style={{ padding: '12px 16px' }}>{s.driver_name}</td>
                        <td style={{ padding: '12px 16px' }}>{s.taxi_plate}</td>
                        <td style={{ padding: '12px 16px' }}>{s.scheduled_interval?.start_time ? new Date(s.scheduled_interval.start_time).toLocaleString() : '-'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button
                            onClick={() => {
                              setItemToDelete({ id: s.id, type: 'shift' });
                              setIsDeleteModalOpen(true);
                            }}
                            style={{
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              cursor: 'pointer',
                              margin: '0 auto',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                            title="Delete Shift"
                          >
                            <X size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {data.shifts.length === 0 && <tr><td colSpan="5" style={{ padding: '16px' }}>No shifts found.</td></tr>}
                  </tbody>
                </table>
              </div>
            ) : activeSection === 'trips' ? (
              <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <th style={{ padding: '12px 16px' }}>ID</th>
                      <th style={{ padding: '12px 16px' }}>Status</th>
                      <th style={{ padding: '12px 16px' }}>Client</th>
                      <th style={{ padding: '12px 16px' }}>Driver</th>
                      <th style={{ padding: '12px 16px' }}>Origin</th>
                      <th style={{ padding: '12px 16px' }}>Destination</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trips.map((t, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f9f9f9' }}>
                        <td style={{ padding: '12px 16px' }}>{t.id}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className={`trip-badge trip-badge--${t.status.toLowerCase()}`}>
                            {t.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>{t.client_name}</td>
                        <td style={{ padding: '12px 16px' }}>{t.driver_name || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>{t.originAddress}</td>
                        <td style={{ padding: '12px 16px' }}>{t.destAddress}</td>
                      </tr>
                    ))}
                    {data.trips.length === 0 && <tr><td colSpan="6" style={{ padding: '16px' }}>No trips found.</td></tr>}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card reports-card">
                <div style={{ padding: 16 }}>
                  <div className="reports-controls">
                    <div>
                      <label>Start date</label>
                      <input type="date" value={formData.reports_start || ''} onChange={(e) => setFormData(fd => ({ ...fd, reports_start: e.target.value }))} />
                    </div>
                    <div>
                      <label>End date</label>
                      <input type="date" value={formData.reports_end || ''} onChange={(e) => setFormData(fd => ({ ...fd, reports_end: e.target.value }))} />
                    </div>
                    <div>
                      <button
                        onClick={() => {
                          const s = formData.reports_start; const e = formData.reports_end;
                          // client-side validation
                          if (!s || !e) {
                            setReportsError('Please select both start and end dates.');
                            return;
                          }
                          // ensure start <= end
                          if (new Date(s) > new Date(e)) {
                            setReportsError('Start date must be before or equal to end date.');
                            return;
                          }

                          setReportsLoading(true);
                          setReportsError('');
                          getReports(s, e)
                            .then(res => {
                              setData(d => ({ ...d, reports: res.data }));
                            })
                            .catch(err => {
                              const serverMsg = err.response?.data?.error || err.response?.data || err.message;
                              setReportsError(serverMsg || 'Failed to fetch reports');
                              setData(d => ({ ...d, reports: null }));
                            })
                            .finally(() => setReportsLoading(false));
                        }}
                        style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6 }}
                        disabled={reportsLoading || !formData.reports_start || !formData.reports_end}
                      >{reportsLoading ? 'Fetching...' : 'Fetch'}</button>
                      {reportsError && <div style={{ color: 'red', marginTop: 8 }}>{reportsError}</div>}
                    </div>
                  </div>

                  {data.reports ? (
                    <div>
                      <div className="reports-summary">
                        <div><strong>Total trips:</strong> {data.reports.total_trips}</div>
                        <div><strong>Total hours:</strong> {data.reports.total_hours.toFixed ? data.reports.total_hours.toFixed(2) : data.reports.total_hours}</div>
                        <div><strong>Total km:</strong> {data.reports.total_kilometers}</div>
                      </div>

                      <div className="reports-columns">
                        <div>
                          <h4>By driver</h4>
                          <ul>
                            {data.reports.by_driver.map((bd) => (
                              <li key={bd.driver_id}>{bd.driver_name} — {bd.hours.toFixed(2)} h — {bd.kilometers} km</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4>By taxi</h4>
                          <ul>
                            {data.reports.by_taxi.map((bt) => (
                              <li key={bt.taxi_plate}>{bt.taxi_plate} — {bt.hours.toFixed(2)} h — {bt.kilometers} km</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="reports-empty">No report loaded. Choose a date range and click Fetch.</div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
