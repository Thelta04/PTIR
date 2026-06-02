import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, Search, Bell, LogOut, Users, Car, CalendarClock, BarChart3, X, User, MapPin, Trash2, ShieldCheck, ShieldAlert, Edit2, Plus, Info, Star
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import {
  listDrivers, listTaxis, listAllShifts, createDriver, createTaxi, createShift,
  listClients, createClient, listTrips, deleteShift, toggleUserStatus, deleteUser,
  deleteTaxi, updateDriver, getReports, updateClient, updateTaxi, updateShift
} from '../../api/client';
import './manager.css';
import { EuropeanDateInput, EuropeanDateTimeInput } from '../../components/EuropeanDateInput';
import {
  formatDateTimePT,
  dateInputToLocalDate,
  dateTimeInput,
  todayDateInput,
  nowDateTimeInput,
  plusHoursDateTimeInput,
} from '../../utils/dateFormat';

const sidebarItems = [
  { key: 'clients', label: 'Clientes', icon: User },
  { key: 'drivers', label: 'Motoristas', icon: Users },
  { key: 'taxis', label: 'Táxis', icon: Car },
  { key: 'shifts', label: 'Turnos', icon: CalendarClock },
  { key: 'trips', label: 'Viagens', icon: MapPin },
  { key: 'reports', label: 'Relatórios', icon: BarChart3 },
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
  const [tripStatusFilter, setTripStatusFilter] = useState('');
  const [shiftStatusFilter, setShiftStatusFilter] = useState('');


  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [formData, setFormData] = useState({});
  const [originalId, setOriginalId] = useState(null);
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

  const fetchData = useCallback(() => {
    setLoading(true);
    setError('');

    const handlers = {
      clients: listClients,
      drivers: listDrivers,
      taxis: listTaxis,
      shifts: listAllShifts,
      trips: listTrips
    };

    if (handlers[activeSection]) {
      handlers[activeSection]()
        .then(res => {
          setData(d => ({ ...d, [activeSection]: res.data }));
          setApiStatus(`Dados de ${activeSection} atualizados`);
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
    setIsModalOpen(false);
  }, [fetchData]);

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

  const openCreateModal = () => {
    setFormMode('create');
    setSubmitError('');

    if (activeSection === 'clients') {
      setFormData({
        nif: '',
        name: '',
        email: '',
        gender: '',
        password: '',
      });
    } else if (activeSection === 'shifts') {
      setFormData({
        start_time: nowDateTimeInput(),
        end_time: plusHoursDateTimeInput(8),
      });
    } else if (activeSection === 'reports') {
      setFormData({
        reports_start: todayDateInput(),
        reports_end: todayDateInput(),
      });
    } else {
      setFormData({});
    }

    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const formatError = (err) => {
    if (!err) return '';
    if (typeof err === 'string') return err;
    if (typeof err === 'object') {
      return Object.entries(err).map(([key, value]) => {
        const field = key === 'non_field_errors' ? 'Erro' : (key.charAt(0).toUpperCase() + key.slice(1));
        const msg = Array.isArray(value) ? value.join(' ') : value;
        return `${field}: ${msg}`;
      }).join('\n');
    }
    return 'Erro inesperado';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');

    let request;
    if (formMode === 'edit-driver') {
      const payload = { ...formData };
      delete payload.id;
      if (!payload.password) delete payload.password;
      request = updateDriver(originalId, payload);
    } else if (formMode === 'edit-client') {
      const payload = { ...formData };
      delete payload.id;
      if (!payload.password) delete payload.password;
      request = updateClient(originalId, payload);
    } else if (formMode === 'edit-taxi') {
      const payload = { ...formData };
      request = updateTaxi(originalId, payload);
    } else if (formMode === 'edit-shift') {
      const payload = { 
        driver_id: parseInt(formData.driver_id, 10),
        taxi_license_plate: formData.taxi_license_plate,
        start_time: formData.start_time,
        end_time: formData.end_time
      };
      request = updateShift(originalId, payload);
    } else if (activeSection === 'clients') {
      request = createClient(formData);
    } else if (activeSection === 'drivers') {
      request = createDriver(formData);
    } else if (activeSection === 'taxis') {
      request = createTaxi(formData);
    } else if (activeSection === 'shifts') {
      const payload = { ...formData, driver_id: parseInt(formData.driver_id, 10) };
      request = createShift(payload);
    }

    if (request) {
      request
        .then(() => {
          setIsModalOpen(false);
          setFormData({});
          setSubmitError('');
          setFormMode('create');
          fetchData();
          setApiStatus(formMode.startsWith('edit') ? 'Registo atualizado com sucesso' : 'Registo criado com sucesso');
          setTimeout(() => setApiStatus(''), 4000);
        })
        .catch(err => {
          const errData = err.response?.data;
          setSubmitError(formatError(errData) || err.message);
        })
        .finally(() => setSubmitting(false));
    }
  };

  const openEditDriver = (driver) => {
    setFormMode('edit-driver');
    setOriginalId(driver.id);
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

  const openEditClient = (client) => {
    setFormMode('edit-client');
    setOriginalId(client.id);
    setFormData({
      id: client.id,
      nif: client.nif || '',
      name: client.name || '',
      email: client.email || '',
      gender: client.gender || '',
      password: '',
    });
    setIsModalOpen(true);
  };

  const openEditTaxi = (taxi) => {
    setFormMode('edit-taxi');
    setOriginalId(taxi.license_plate);
    setFormData({
      license_plate: taxi.license_plate,
      purchase_year: taxi.purchase_year || '',
      mileage: taxi.mileage || 0,
      brand: taxi.brand || '',
      model: taxi.model || '',
      comfort_level: taxi.comfort_level || '',
      engine_type: taxi.engine_type || '',
      num_passengers: taxi.num_passengers || 1,
    });
    setIsModalOpen(true);
  };

  const openEditShift = (shift) => {
    setFormMode('edit-shift');
    setOriginalId(shift.id);
    setFormData({
      id: shift.id,
      driver_id: shift.driver_id,
      taxi_license_plate: shift.taxi_plate,
      start_time: dateTimeInput(shift.scheduled_interval?.start_time),
      end_time: dateTimeInput(shift.scheduled_interval?.end_time),
    });
    setIsModalOpen(true);
  };

  const handleDelete = () => {
    if (!itemToDelete) return;
    setDeleting(true);

    let request;
    if (itemToDelete.type === 'shift') request = deleteShift(itemToDelete.id);
    else if (itemToDelete.type === 'user') request = deleteUser(itemToDelete.id, managerPassword);
    else if (itemToDelete.type === 'taxi') request = deleteTaxi(itemToDelete.id);

    setDeleteError('');
    request
      .then(() => {
        setIsDeleteModalOpen(false);
        setItemToDelete(null);
        setManagerPassword('');
        fetchData();
        setApiStatus(`Item removido com sucesso`);
        setTimeout(() => setApiStatus(''), 4000);
      })
      .catch(err => {
        const errData = err.response?.data;
        const errorMsg = typeof errData === 'object' ? JSON.stringify(errData) : err.message;
        setDeleteError(errorMsg || 'Falha ao remover item');
      })
      .finally(() => setDeleting(false));
  };

  const handleToggleStatus = (id) => {
    toggleUserStatus(id)
      .then(res => {
        setApiStatus(`Estado do utilizador atualizado`);
        fetchData();
        setTimeout(() => setApiStatus(''), 4000);
      })
      .catch(() => alert('Falha ao alterar estado'));
  };

  const renderFormFields = () => {
    if (activeSection === 'clients') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="auth-field"><label className="auth-label">NIF</label><input className="auth-input" name="nif" required onChange={handleInputChange} value={formData.nif || ''} /></div>
          <div className="auth-field"><label className="auth-label">Nome</label><input className="auth-input" name="name" required onChange={handleInputChange} value={formData.name || ''} /></div>
          <div className="auth-field"><label className="auth-label">Email</label><input className="auth-input" type="email" name="email" required onChange={handleInputChange} value={formData.email || ''} /></div>
          <div className="auth-field">
            <label className="auth-label">Género</label>
            <select className="auth-input" name="gender" required onChange={handleInputChange} value={formData.gender || ''}>
              <option value="" disabled>Selecionar</option><option value="Male">Masculino</option><option value="Female">Feminino</option><option value="Other">Outro</option>
            </select>
          </div>
          <div className="auth-field">
            <label className="auth-label">
              Palavra-passe {formMode === 'edit-client' && '(deixar em branco para manter)'}
            </label>
            <input className="auth-input" type="password" name="password" required={formMode === 'create'} onChange={handleInputChange} value={formData.password || ''} />
          </div>
        </div>
      );
    }
    if (activeSection === 'drivers') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="auth-field"><label className="auth-label">NIF</label><input className="auth-input" name="nif" required onChange={handleInputChange} value={formData.nif || ''} /></div>
          <div className="auth-field"><label className="auth-label">Nome</label><input className="auth-input" name="name" required onChange={handleInputChange} value={formData.name || ''} /></div>
          <div className="auth-field"><label className="auth-label">Email</label><input className="auth-input" type="email" name="email" required onChange={handleInputChange} value={formData.email || ''} /></div>
          <div className="auth-field">
            <label className="auth-label">Género</label>
            <select className="auth-input" name="gender" required onChange={handleInputChange} value={formData.gender || ''}>
              <option value="" disabled>Género</option><option value="Male">Masculino</option><option value="Female">Feminino</option><option value="Other">Outro</option>
            </select>
          </div>
          <div className="auth-field">
            <label className="auth-label">
              Palavra-passe {formMode === 'edit-driver' && '(deixar em branco para manter)'}
            </label>
            <input className="auth-input" type="password" name="password" required={formMode === 'create'} onChange={handleInputChange} value={formData.password || ''} />
          </div>
          <div className="auth-field"><label className="auth-label">Nº Carta</label><input className="auth-input" name="license_number" required onChange={handleInputChange} value={formData.license_number || ''} /></div>
          <div className="auth-field"><label className="auth-label">Ano Nascimento</label><input className="auth-input" name="birth_year" type="number" min="1900" max="2026" required onChange={handleInputChange} value={formData.birth_year || ''} /></div>
        </div>
      );
    }
    if (activeSection === 'taxis') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="auth-field">
            <label className="auth-label">Matrícula</label>
            <input className="auth-input" name="license_plate" placeholder="XX-XX-XX" required readOnly={formMode === 'edit-taxi'} style={formMode === 'edit-taxi' ? { background: '#f5f5f5', color: '#888' } : {}} onChange={handleInputChange} value={formData.license_plate || ''} />
          </div>
          <div className="auth-field"><label className="auth-label">Ano Compra</label><input className="auth-input" name="purchase_year" type="number" min="1900" max="2026" required onChange={handleInputChange} value={formData.purchase_year || ''} /></div>
          <div className="auth-field"><label className="auth-label">KM</label><input className="auth-input" name="mileage" type="number" required onChange={handleInputChange} value={formData.mileage || ''} /></div>
          <div className="auth-field"><label className="auth-label">Marca</label><input className="auth-input" name="brand" required onChange={handleInputChange} value={formData.brand || ''} /></div>
          <div className="auth-field"><label className="auth-label">Modelo</label><input className="auth-input" name="model" required onChange={handleInputChange} value={formData.model || ''} /></div>
          <div className="auth-field"><label className="auth-label">Nº Passageiros</label><input className="auth-input" name="num_passengers" type="number" min="1" max="4" required onChange={handleInputChange} value={formData.num_passengers || ''} /></div>
          <div className="auth-field">
            <label className="auth-label">Conforto</label>
            <select className="auth-input" name="comfort_level" required onChange={handleInputChange} value={formData.comfort_level || ''}>
              <option value="" disabled>Nível</option><option value="basic">Basic</option><option value="luxury">Luxury</option>
            </select>
          </div>
          <div className="auth-field">
            <label className="auth-label">Motor</label>
            <select className="auth-input" name="engine_type" required onChange={handleInputChange} value={formData.engine_type || ''}>
              <option value="" disabled>Tipo</option><option value="combustion">Combustion</option><option value="electric">Electric</option>
            </select>
          </div>
        </div>
      );
    }
    if (activeSection === 'shifts') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="auth-field">
            <label className="auth-label">Motorista</label>
            <select className="auth-input" name="driver_id" required onChange={handleInputChange} value={formData.driver_id || ""}>
              <option value="" disabled>Selecionar</option>
              {data.drivers.map(d => <option key={d.nif} value={d.id}>{d.name} ({d.nif})</option>)}
            </select>
          </div>
          <div className="auth-field">
            <label className="auth-label">Táxi</label>
            <select className="auth-input" name="taxi_license_plate" required onChange={handleInputChange} value={formData.taxi_license_plate || ""}>
              <option value="" disabled>Selecionar</option>
              {data.taxis.map(t => <option key={t.license_plate} value={t.license_plate}>{t.brand} {t.model} ({t.license_plate})</option>)}
            </select>
          </div>
          <div className="auth-field">
            <label className="auth-label">Início</label>
            <EuropeanDateTimeInput
              className="auth-input"
              name="start_time"
              required
              onChange={(value) => setFormData(prev => ({ ...prev, start_time: value }))}
              value={formData.start_time || ''}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">Fim</label>
            <EuropeanDateTimeInput
              className="auth-input"
              name="end_time"
              required
              onChange={(value) => setFormData(prev => ({ ...prev, end_time: value }))}
              value={formData.end_time || ''}
            />
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="manager-dashboard">
      <AnimatePresence>
        {isModalOpen && (
          <motion.div className="manager-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="manager-modal-content" style={{ background: '#fff', padding: '32px', borderRadius: '24px', width: '700px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}>
              <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: '24px', right: '24px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#999' }}><X size={24} /></button>
              <h2 style={{ marginBottom: '24px', color: '#111', fontWeight: 800, fontSize: '1.5rem' }}>{formMode.startsWith('edit') ? 'Editar Registo' : `Adicionar ${sidebarItems.find(i => i.key === activeSection)?.label.slice(0, -1)}`}</h2>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {renderFormFields()}
                {submitError && <div style={{ color: 'red', fontSize: '14px', background: '#fee2e2', padding: '10px', borderRadius: '8px', whiteSpace: 'pre-line' }}>{submitError}</div>}
                <button type="submit" className="auth-btn" disabled={submitting}>{submitting ? 'A processar...' : (formMode.startsWith('edit') ? 'Guardar Alterações' : 'Criar Registo')}</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDeleteModalOpen && (
          <motion.div className="manager-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', justifyContent: 'center', alignItems: 'center' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="manager-modal-content" style={{ background: '#fff', padding: '32px', borderRadius: '24px', width: '400px', maxWidth: '90%', textAlign: 'center' }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <div style={{ color: '#ef4444', marginBottom: '16px' }}><Trash2 size={48} style={{ margin: '0 auto' }} /></div>
              <h3 style={{ marginBottom: '12px', color: '#111', fontWeight: 800, fontSize: '1.4rem' }}>Confirmar Remoção</h3>
              <p style={{ marginBottom: '24px', color: '#666', fontSize: '15px' }}>Tem a certeza que deseja apagar este registo? Esta ação é irreversível.</p>
              {itemToDelete?.type === 'user' && <div style={{ marginBottom: 16 }}><input className="auth-input" type="password" placeholder="Palavra-passe de Gestor" value={managerPassword} onChange={(e) => setManagerPassword(e.target.value)} /></div>}
              {deleteError && <div style={{ color: 'red', marginBottom: 12, fontSize: '14px' }}>{deleteError}</div>}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setIsDeleteModalOpen(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 600 }} disabled={deleting}>Cancelar</button>
                <button onClick={handleDelete} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 600 }} disabled={deleting || (itemToDelete?.type === 'user' && !managerPassword)}>{deleting ? 'A remover...' : 'Remover'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="dash-header">
        <div className="dash-header-left">
          <button className="dash-icon-btn" onClick={() => setSidebarOpen((p) => !p)}><Menu size={20} /></button>
          <div className="dash-brand"><span className="dash-brand-name">TUXY</span><span className="dash-brand-sub">Backoffice</span></div>
        </div>
        <div className="dash-header-right">
          <span className="dash-greeting">Olá, {user?.name?.split(' ')[0]}</span>
          <button className="dash-icon-btn dash-icon-btn--danger" onClick={handleLogout}><LogOut size={18} /></button>
        </div>
      </header>

      <div className="manager-body">
        <aside className="manager-sidebar" style={{ width: sidebarOpen ? 240 : 0, opacity: sidebarOpen ? 1 : 0 }}>
          <nav className="manager-nav">
            {sidebarItems.map(({ key, label, icon: Icon }) => (
              <button key={key} className={`manager-nav-item ${activeSection === key ? 'active' : ''}`} onClick={() => setActiveSection(key)}>
                <Icon size={18} /><span>{label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="manager-main">
          <motion.div key={activeSection} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div className="section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <h1 className="section-title">{sidebarItems.find(i => i.key === activeSection)?.label}</h1>
                {['clients', 'drivers', 'taxis', 'shifts'].includes(activeSection) && (
                  <button onClick={openCreateModal} className="fetch-btn" style={{ height: '36px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                    <Plus size={16} /> Novo Registo
                  </button>
                )}
              </div>
              {apiStatus && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="dash-toast">{apiStatus}</motion.div>}
            </div>

            {loading ? (
              <div className="dash-placeholder-card"><div className="dash-loading">A carregar dados de {activeSection}...</div></div>
            ) : error ? (
              <div className="dash-placeholder-card" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>Erro ao carregar {activeSection}: {error}</div>
            ) : activeSection === 'clients' ? (
              <div className="data-table-container">
                <table className="manager-table">
                  <thead><tr><th>ID</th><th>NIF</th><th>Nome</th><th>Email</th><th>Estado</th><th style={{ textAlign: 'center' }}>Ações</th></tr></thead>
                  <tbody>
                    {data.clients.map((c, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 700, color: '#999' }}>#{c.id}</td><td>{c.nif}</td><td style={{ fontWeight: 600 }}>{c.name}</td><td>{c.email}</td>
                        <td><span className={`status-badge ${c.is_banned ? 'status-badge--banned' : 'status-badge--active'}`}>{c.is_banned ? 'Banido' : 'Ativo'}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button onClick={() => handleToggleStatus(c.id)} className="action-btn action-btn--edit" title={c.is_banned ? 'Ativar' : 'Banir'}>{c.is_banned ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}</button>
                            <button onClick={() => openEditClient(c)} className="action-btn action-btn--edit" title="Editar"><Edit2 size={16} /></button>
                            <button onClick={() => { setItemToDelete({ id: c.id, type: 'user' }); setIsDeleteModalOpen(true); }} className="action-btn action-btn--delete" title="Apagar"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : activeSection === 'drivers' ? (
              <div className="data-table-container">
                <table className="manager-table">
                  <thead><tr><th>ID</th><th>NIF</th><th>Nome</th><th>Email</th><th>Carta</th><th>Classificação</th><th>Estado</th><th style={{ textAlign: 'center' }}>Ações</th></tr></thead>
                  <tbody>
                    {data.drivers.map((d, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 700, color: '#999' }}>#{d.id}</td><td>{d.nif}</td><td style={{ fontWeight: 600 }}>{d.name}</td><td>{d.email}</td><td>{d.license_number}</td>
                        <td>
                          {d.avg_rating ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f1af3d', fontWeight: 'bold' }}>
                              <Star size={14} fill="#f1af3d" />
                              {d.avg_rating} <span style={{ color: '#999', fontWeight: 'normal', fontSize: '0.8rem' }}>({d.rating_count})</span>
                            </div>
                          ) : (
                            <span style={{ color: '#ccc' }}>N/A</span>
                          )}
                        </td>
                        <td><span className={`status-badge ${d.is_banned ? 'status-badge--banned' : 'status-badge--active'}`}>{d.is_banned ? 'Banido' : 'Ativo'}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button onClick={() => handleToggleStatus(d.id)} className="action-btn action-btn--edit" title="Alterar Estado">{d.is_banned ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}</button>
                            <button onClick={() => openEditDriver(d)} className="action-btn action-btn--edit" title="Editar"><Edit2 size={16} /></button>
                            <button onClick={() => { setItemToDelete({ id: d.id, type: 'user' }); setManagerPassword(''); setIsDeleteModalOpen(true); }} className="action-btn action-btn--delete" title="Apagar"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : activeSection === 'taxis' ? (
              <div className="data-table-container">
                <table className="manager-table">
                  <thead><tr><th>Matrícula</th><th>Veículo</th><th>KM</th><th>Motor</th><th>Conforto</th><th style={{ textAlign: 'center' }}>Ações</th></tr></thead>
                  <tbody>
                    {data.taxis.map((t, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 700 }}>{t.license_plate}</td>
                        <td><div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontWeight: 600 }}>{t.brand} {t.model}</span><span style={{ fontSize: '0.75rem', color: '#999' }}>{t.purchase_year}</span></div></td>
                        <td>{t.mileage.toLocaleString()} km</td><td><span style={{ textTransform: 'capitalize' }}>{t.engine_type}</span></td><td><span style={{ textTransform: 'capitalize' }}>{t.comfort_level}</span></td>
                        <td><div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button onClick={() => openEditTaxi(t)} className="action-btn action-btn--edit" title="Editar"><Edit2 size={16} /></button>
                          <button onClick={() => { setItemToDelete({ id: t.license_plate, type: 'taxi' }); setIsDeleteModalOpen(true); }} className="action-btn action-btn--delete" title="Apagar"><Trash2 size={16} /></button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : activeSection === 'shifts' ? (
              <div className="data-table-container">
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'flex-end' }}>
                  <select 
                    className="auth-input" 
                    style={{ width: 'auto', padding: '8px 12px' }}
                    value={shiftStatusFilter}
                    onChange={(e) => setShiftStatusFilter(e.target.value)}
                  >
                    <option value="">Todos os Estados</option>
                    <option value="SCHEDULED">Agendado</option>
                    <option value="HAPPENING">A Decorrer</option>
                    <option value="COMPLETED">Concluído</option>
                    <option value="DID_NOT_HAPPEN">Não Realizado</option>
                  </select>
                </div>
                <table className="manager-table">
                  <thead><tr><th>ID</th><th>Motorista</th><th>Táxi</th><th>Horário Agendado</th><th style={{ textAlign: 'center' }}>Ações</th></tr></thead>
                  <tbody>
                    {data.shifts
                      .filter(s => {
                        if (!shiftStatusFilter) return true;
                        
                        let status = 'SCHEDULED';
                        if (s.real_interval?.start_time && s.real_interval?.end_time) {
                          status = 'COMPLETED';
                        } else if (s.real_interval?.start_time && !s.real_interval?.end_time) {
                          status = 'HAPPENING';
                        } else {
                          const now = new Date();
                          const scheduledEnd = new Date(s.scheduled_interval?.end_time);
                          if (!s.real_interval && now > scheduledEnd) status = 'DID_NOT_HAPPEN';
                        }
                        return status === shiftStatusFilter;
                      })
                      .sort((a, b) => {
                        const timeA = a.scheduled_interval?.start_time ? new Date(a.scheduled_interval.start_time).getTime() : 0;
                        const timeB = b.scheduled_interval?.start_time ? new Date(b.scheduled_interval.start_time).getTime() : 0;
                        return timeB - timeA;
                      })
                      .map((s, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 700, color: '#999' }}>#{s.id}</td><td style={{ fontWeight: 600 }}>{s.driver_name}</td><td>{s.taxi_plate}</td>
                        <td>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '0.9rem',
                            }}
                          >
                            <CalendarClock size={14} color="#999" />
                            {formatDateTimePT(s.scheduled_interval?.start_time)}
                            {' → '}
                            {formatDateTimePT(s.scheduled_interval?.end_time)}
                          </div>
                        </td>
                        <td><div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button onClick={() => openEditShift(s)} className="action-btn action-btn--edit" title="Editar"><Edit2 size={16} /></button>
                          <button onClick={() => { setItemToDelete({ id: s.id, type: 'shift' }); setIsDeleteModalOpen(true); }} className="action-btn action-btn--delete" style={{ margin: '0' }}><Trash2 size={16} /></button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : activeSection === 'trips' ? (
              <div className="data-table-container">
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'flex-end' }}>
                  <select 
                    className="auth-input" 
                    style={{ width: 'auto', padding: '8px 12px' }}
                    value={tripStatusFilter}
                    onChange={(e) => setTripStatusFilter(e.target.value)}
                  >
                    <option value="">Todos os Estados</option>
                    <option value="PENDING">Pendente</option>
                    <option value="DRIVER_ACCEPTED">Motorista Aceitou</option>
                    <option value="CLIENT_ACCEPTED">Cliente Aceitou</option>
                    <option value="IN_PROGRESS">Em Progresso</option>
                    <option value="WAITING_PAYMENT">A Aguardar Pagamento</option>
                    <option value="PAID">Pago</option>
                    <option value="COMPLETED">Concluído</option>
                    <option value="CANCELED">Cancelado</option>
                  </select>
                </div>
                <table className="manager-table">
                  <thead><tr><th>ID</th><th>Estado</th><th>Cliente</th><th>Motorista</th><th>Rota</th><th>Data/Hora</th><th>Duração</th><th>Preço</th></tr></thead>
                  <tbody>
                    {data.trips
                      .filter(t => tripStatusFilter ? t.status === tripStatusFilter : true)
                      .sort((a, b) => {
                        const timeA = a.interval?.start_time ? new Date(a.interval.start_time).getTime() : 0;
                        const timeB = b.interval?.start_time ? new Date(b.interval.start_time).getTime() : 0;
                        return timeB - timeA;
                      })
                      .map((t, i) => {
                      let durationStr = '-';
                      if (t.interval?.start_time && t.interval?.end_time) {
                        const start = new Date(t.interval.start_time);
                        const end = new Date(t.interval.end_time);
                        const diffMs = end - start;
                        if (diffMs > 0) {
                          const mins = Math.floor(diffMs / 60000);
                          const hours = Math.floor(mins / 60);
                          const remMins = mins % 60;
                          durationStr = hours > 0 ? `${hours}h ${remMins}m` : `${mins}m`;
                        }
                      }
                      
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 700, color: '#999' }}>#{t.id}</td><td><span className={`trip-badge trip-badge--${t.status.toLowerCase()}`}>{t.status}</span></td>
                          <td style={{ fontWeight: 600 }}>{t.client_name}</td><td>{t.driver_name || '-'}</td>
                          <td><div style={{ fontSize: '0.8rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${t.originAddress} -> ${t.destAddress}`}>{t.originAddress.split(',')[0]} → {t.destAddress.split(',')[0]}</div></td>
                          <td><div style={{ fontSize: '0.85rem', color: '#555' }}>{t.interval?.start_time ? new Date(t.interval.start_time).toLocaleString('pt-PT') : '-'}</div></td>
                          <td style={{ fontWeight: 500, color: '#666' }}>{durationStr}</td>
                          <td style={{ fontWeight: 700 }}>€{t.price}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="reports-container">
                <div className="reports-filter-card">
                  <div className="filter-group">
                    <label className="filter-label">Data Início</label>
                    <EuropeanDateInput
                      className="filter-input"
                      value={formData.reports_start || ''}
                      onChange={(value) =>
                        setFormData((fd) => ({
                          ...fd,
                          reports_start: value,
                        }))
                      }
                    />
                  </div>

                  <div className="filter-group">
                    <label className="filter-label">Data Fim</label>
                    <EuropeanDateInput
                      className="filter-input"
                      value={formData.reports_end || ''}
                      onChange={(value) =>
                        setFormData((fd) => ({
                          ...fd,
                          reports_end: value,
                        }))
                      }
                    />
                  </div>
                  <button onClick={() => {
                    const s = formData.reports_start; const e = formData.reports_end;
                    if (!s || !e) { setReportsError('Selecione ambas as datas.'); return; }
                    if (dateInputToLocalDate(s) > dateInputToLocalDate(e)) {
                      setReportsError('Data início deve ser anterior ao fim.');
                      return;
                    }
                    setReportsLoading(true); setReportsError('');
                    getReports(s, e).then(res => setData(d => ({ ...d, reports: res.data }))).catch(err => { setReportsError(err.response?.data?.error || 'Falha ao obter relatórios'); setData(d => ({ ...d, reports: null })); }).finally(() => setReportsLoading(false));
                  }} className="fetch-btn" disabled={reportsLoading || !formData.reports_start || !formData.reports_end}>{reportsLoading ? 'A processar...' : 'Gerar Relatório'}</button>
                  {reportsError && <div style={{ color: 'red', fontSize: '13px', marginLeft: '10px' }}>{reportsError}</div>}
                </div>

                {data.reports ? (
                  <>
                    <div className="reports-grid">
                      <div className="stat-card"><div className="stat-label">Total de Viagens</div><div className="stat-value">{data.reports.total_trips}</div></div>
                      <div className="stat-card"><div className="stat-label">Total de Horas</div><div className="stat-value">{data.reports.total_hours?.toFixed(1)}h</div></div>
                      <div className="stat-card"><div className="stat-label">Total de Distância</div><div className="stat-value">{data.reports.total_kilometers?.toLocaleString()} km</div></div>
                      <div className="stat-card"><div className="stat-label">Faturação Estimada</div><div className="stat-value">€{(data.reports.total_kilometers * 1.2).toFixed(2)}</div></div>
                    </div>
                    <div className="report-details-grid">
                      <div className="data-table-container">
                        <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '10px' }}><Users size={20} color="var(--gold-600)" /><h3 style={{ margin: 0, fontSize: '1.1rem' }}>Desempenho por Motorista</h3></div>
                        <table className="manager-table">
                          <thead><tr><th>Motorista</th><th>Horas</th><th>KM</th></tr></thead>
                          <tbody>{data.reports.by_driver.map((bd) => <tr key={bd.driver_id}><td style={{ fontWeight: 600 }}>{bd.driver_name}</td><td>{bd.hours.toFixed(1)}h</td><td>{bd.kilometers} km</td></tr>)}</tbody>
                        </table>
                      </div>
                      <div className="data-table-container">
                        <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '10px' }}><Car size={20} color="var(--gold-600)" /><h3 style={{ margin: 0, fontSize: '1.1rem' }}>Utilização por Táxi</h3></div>
                        <table className="manager-table">
                          <thead><tr><th>Táxi</th><th>Horas</th><th>KM</th></tr></thead>
                          <tbody>{data.reports.by_taxi.map((bt) => <tr key={bt.taxi_plate}><td style={{ fontWeight: 600 }}>{bt.taxi_plate}</td><td>{bt.hours.toFixed(1)}h</td><td>{bt.kilometers} km</td></tr>)}</tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="dash-placeholder-card"><Info size={40} style={{ margin: '0 auto 16px', display: 'block', color: '#ccc' }} />Nenhum relatório carregado. Escolha um intervalo de datas e clique em "Gerar Relatório".</div>
                )}
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
