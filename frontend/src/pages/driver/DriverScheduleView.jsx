import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { listTaxis, createShift } from '../../api/client';
import { motion } from 'framer-motion';

const DAYS = [
  { label: 'Segunda', val: 1 },
  { label: 'Terça', val: 2 },
  { label: 'Quarta', val: 3 },
  { label: 'Quinta', val: 4 },
  { label: 'Sexta', val: 5 },
  { label: 'Sábado', val: 6 },
  { label: 'Domingo', val: 0 },
];

export default function DriverScheduleView() {
  const { user } = useAuth();
  
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('14:00');
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [selectedDays, setSelectedDays] = useState([]);
  
  const [taxis, setTaxis] = useState([]);
  const [taxiPlate, setTaxiPlate] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    listTaxis().then(res => {
      setTaxis(res.data);
      if (res.data.length > 0) setTaxiPlate(res.data[0].license_plate);
    }).catch(err => console.error("Error loading taxis", err));
  }, []);

  const toggleDay = (val) => {
    setSelectedDays(prev =>
      prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    setError('');

    if (!startDate || !endDate) {
      setError('Por favor preencha as datas.');
      setLoading(false);
      return;
    }
    
    if (!taxiPlate) {
      setError('Por favor selecione um taxi.');
      setLoading(false);
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      setError('Data de fim tem de ser posterior à data de início.');
      setLoading(false);
      return;
    }

    let createdCount = 0;
    
    // Iterate over dates
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (selectedDays.length === 0 || selectedDays.includes(d.getDay())) {
        
        // Format start datetime
        const [sh, sm] = startTime.split(':');
        const stDt = new Date(d);
        stDt.setHours(parseInt(sh, 10), parseInt(sm, 10), 0, 0);
        
        // Format end datetime
        const [eh, em] = endTime.split(':');
        const endDt = new Date(d);
        endDt.setHours(parseInt(eh, 10), parseInt(em, 10), 0, 0);
        
        // Handle next-day ending shift if end time is before start time
        if (endDt <= stDt) {
          endDt.setDate(endDt.getDate() + 1);
        }

        try {
          await createShift({
            driver_id: user.id,
            taxi_license_plate: taxiPlate,
            start_time: stDt.toISOString(),
            end_time: endDt.toISOString()
          });
          createdCount++;
        } catch (err) {
          console.error("Error creating shift", err);
          setError(`Erro ao criar alguns turnos. (Criados: ${createdCount})`);
          setLoading(false);
          return;
        }
      }
    }
    
    setMsg(`Turnos agendados com sucesso! (${createdCount} turnos)`);
    setLoading(false);
  };

  return (
    <div className="driver-schedule-view" style={{ padding: '2rem', background: '#fff', minHeight: '100%' }}>
      <h1 className="dash-title" style={{ marginBottom: '1.5rem', fontSize: '1.8rem' }}>Registar turnos</h1>

      {msg && <p className="dash-toast" style={{ color: 'green', marginBottom: '1rem' }}>{msg}</p>}
      {error && <p className="dash-error" style={{ marginBottom: '1rem' }}>{error}</p>}

      <form onSubmit={handleSubmit} className="schedule-form">
        <div className="schedule-card">
          <div className="schedule-row">
            <span className="schedule-label">Taxi:</span>
            <select className="schedule-input" value={taxiPlate} onChange={(e) => setTaxiPlate(e.target.value)}>
              {taxis.map(t => (
                <option key={t.license_plate} value={t.license_plate}>
                  {t.brand} {t.model} ({t.license_plate})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="schedule-card">
          <div className="schedule-row">
            <span className="schedule-label">Horas:</span>
            <label className="schedule-sublabel">De</label>
            <input type="time" className="schedule-input" value={startTime} onChange={e => setStartTime(e.target.value)} required />
            <label className="schedule-sublabel">Até:</label>
            <input type="time" className="schedule-input" value={endTime} onChange={e => setEndTime(e.target.value)} required />
          </div>
        </div>

        <div className="schedule-card">
          <div className="schedule-row">
            <span className="schedule-label">Datas:</span>
            <label className="schedule-sublabel">De</label>
            <input type="date" className="schedule-input" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            <label className="schedule-sublabel">Até:</label>
            <input type="date" className="schedule-input" value={endDate} onChange={e => setEndDate(e.target.value)} required />
          </div>
        </div>

        <div className="schedule-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <span className="schedule-label" style={{ marginBottom: '1rem' }}>Repetir:</span>
          <div className="schedule-days-grid">
            {DAYS.map(day => (
              <label key={day.val} className="schedule-day-checkbox">
                <input 
                  type="checkbox" 
                  checked={selectedDays.includes(day.val)} 
                  onChange={() => toggleDay(day.val)}
                />
                <span>{day.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button type="submit" className="btn btn--warning schedule-submit-btn" disabled={loading} style={{ width: '100%', maxWidth: '300px', fontSize: '1.2rem', padding: '1rem' }}>
            {loading ? 'A processar...' : 'Agendar'}
          </button>
        </div>
      </form>
    </div>
  );
}
