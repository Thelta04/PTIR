import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { listTaxis, createShift, listAllShifts } from '../../api/client';
import { ArrowLeft, Check, Car, X, Wand2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { EuropeanDateInput } from '../../components/EuropeanDateInput';
import { formatDatePT, formatTimePT, todayDateInput } from '../../utils/dateFormat';

const DAYS = [
  { label: 'Segunda', val: 1 },
  { label: 'Terça', val: 2 },
  { label: 'Quarta', val: 3 },
  { label: 'Quinta', val: 4 },
  { label: 'Sexta', val: 5 },
  { label: 'Sábado', val: 6 },
  { label: 'Domingo', val: 0 },
];

export default function DriverScheduleView({ onNavigate }) {
  const { user } = useAuth();

  const getTimeStr = (plusHours = 0) => {
    const d = new Date();
    d.setHours(d.getHours() + plusHours);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  };

  const [step, setStep] = useState(1);
  const [isMultipleDays, setIsMultipleDays] = useState(false);

  // Step 1 State
  const [startTime, setStartTime] = useState(getTimeStr());
  const [endTime, setEndTime] = useState(getTimeStr(4));
  const [startDate, setStartDate] = useState(todayDateInput());
  const [endDate, setEndDate] = useState(todayDateInput());
  const [selectedDays, setSelectedDays] = useState([]);

  // Step 2 State
  const [generatedShifts, setGeneratedShifts] = useState([]);
  const [allTaxis, setAllTaxis] = useState([]);
  const [allSystemShifts, setAllSystemShifts] = useState([]);
  const [preferredTaxiPlate, setPreferredTaxiPlate] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Delete State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState(null);

  // Global View State
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const toggleDay = (val) => {
    setSelectedDays(prev =>
      prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val]
    );
  };

  const handleNextStep = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');

    if (isMultipleDays && (!startDate || !endDate)) {
      setError('Por favor preencha as datas.');
      return;
    }

    if (!isMultipleDays && !startDate) {
      setError('Por favor preencha a data.');
      return;
    }

    const start = new Date(startDate);
    const end = isMultipleDays ? new Date(endDate) : new Date(startDate);

    if (start > end) {
      setError('Data de fim tem de ser posterior à data de início.');
      return;
    }

    setLoading(true);
    try {
      const [taxisRes, shiftsRes] = await Promise.all([
        listTaxis(),
        listAllShifts()
      ]);
      setAllTaxis(taxisRes.data);
      setAllSystemShifts(shiftsRes.data);
      if (taxisRes.data.length > 0) setPreferredTaxiPlate(taxisRes.data[0].license_plate);

      const newShifts = [];
      const overlaps = [];
      let idCounter = 1;

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (!isMultipleDays || selectedDays.length === 0 || selectedDays.includes(d.getDay())) {

          const [sh, sm] = startTime.split(':');
          const stDt = new Date(d);
          stDt.setHours(parseInt(sh, 10), parseInt(sm, 10), 0, 0);

          const [eh, em] = endTime.split(':');
          const endDt = new Date(d);
          endDt.setHours(parseInt(eh, 10), parseInt(em, 10), 0, 0);

          if (stDt < new Date()) {
            setError('Não é possível agendar um turno para uma data/hora no passado.');
            setLoading(false);
            return;
          }

          if (endDt <= stDt) {
            endDt.setDate(endDt.getDate() + 1);
          }

          if ((endDt - stDt) > 8 * 60 * 60 * 1000) {
            setError('A duração de um turno não pode exceder as 8 horas.');
            setLoading(false);
            return;
          }

          // Check if driver is already busy with an existing shift
          const overlapShift = shiftsRes.data.find(shift => {
            if (shift.driver_id !== user.id) return false;
            if (shift.real_interval && shift.real_interval.end_time) return false;
            const shiftStart = new Date(shift.scheduled_interval.start_time);
            const shiftEnd = new Date(shift.scheduled_interval.end_time);
            return shiftStart < endDt && shiftEnd > stDt;
          });

          // Check if driver is overlapping with a newly created shift in this same request
          const overlapNew = newShifts.find(shift => {
            return shift.startDt < endDt && shift.endDt > stDt;
          });

          if (overlapShift) {
            const overlapStart = new Date(overlapShift.scheduled_interval.start_time);
            const overlapEnd = new Date(overlapShift.scheduled_interval.end_time);
            overlaps.push(`${formatShortDate(stDt)} (${formatShortTime(stDt)}-${formatShortTime(endDt)}) com turno existente a ${formatShortDate(overlapStart)} (${formatShortTime(overlapStart)}-${formatShortTime(overlapEnd)})`);
          } else if (overlapNew) {
            overlaps.push(`${formatShortDate(stDt)} (${formatShortTime(stDt)}-${formatShortTime(endDt)}) sobrepõe-se com outro turno nesta seleção`);
          } else {
            newShifts.push({
              id: idCounter++,
              startDt: stDt,
              endDt: endDt,
              selectedTaxiPlate: '',
              isAuto: false
            });
          }
        }
      }

      if (overlaps.length > 0) {
        setError(`Sobreposição de turnos detetada nas seguintes datas: ${overlaps.join(', ')}. Por favor ajuste a sua seleção.`);
        setLoading(false);
        return;
      }

      if (newShifts.length === 0) {
        setError('Não foram gerados turnos. Verifique se selecionou os dias da semana corretamente.');
        setLoading(false);
        return;
      }

      setGeneratedShifts(newShifts);
      setStep(2);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar dados do sistema.');
    } finally {
      setLoading(false);
    }
  };

  const getAvailableTaxis = (stDt, enDt) => {
    return allTaxis.filter(taxi => {
      // Check if taxi has any overlapping shift
      const hasOverlap = allSystemShifts.some(shift => {
        if (shift.taxi_plate !== taxi.license_plate) return false;
        if (shift.real_interval && shift.real_interval.end_time) return false;

        const shiftStart = new Date(shift.scheduled_interval.start_time);
        const shiftEnd = new Date(shift.scheduled_interval.end_time);

        return shiftStart < enDt && shiftEnd > stDt;
      });
      return !hasOverlap;
    });
  };

  const handleApplyPreferred = () => {
    if (!preferredTaxiPlate) return;

    setGeneratedShifts(prev => prev.map(shift => {
      const avail = getAvailableTaxis(shift.startDt, shift.endDt);
      const isAvailable = avail.some(t => t.license_plate === preferredTaxiPlate);
      if (isAvailable) {
        return { ...shift, selectedTaxiPlate: preferredTaxiPlate, isAuto: true };
      }
      return shift;
    }));
  };

  const handleTaxiChange = (shiftId, plate) => {
    setGeneratedShifts(prev => prev.map(s => {
      if (s.id === shiftId) {
        return { ...s, selectedTaxiPlate: plate, isAuto: false };
      }
      return s;
    }));
  };

  const handleDeleteGeneratedShift = () => {
    if (shiftToDelete === null) return;
    setGeneratedShifts(prev => prev.filter(s => s.id !== shiftToDelete));
    setIsDeleteModalOpen(false);
    setShiftToDelete(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setMsg('');
    setError('');

    const missing = generatedShifts.some(s => !s.selectedTaxiPlate);
    if (missing) {
      setError('Por favor selecione um taxi para todos os turnos ou volte atrás.');
      setLoading(false);
      return;
    }

    let createdCount = 0;
    for (const shift of generatedShifts) {
      try {
        await createShift({
          driver_id: user.id,
          taxi_license_plate: shift.selectedTaxiPlate,
          start_time: shift.startDt.toISOString(),
          end_time: shift.endDt.toISOString()
        });
        createdCount++;
      } catch (err) {
        console.error("Error creating shift", err);
        setError(`Erro ao criar alguns turnos. (Criados: ${createdCount})`);
        setLoading(false);
        return;
      }
    }

    sessionStorage.setItem('shiftSuccessMsg', `Turnos agendados com sucesso! (${createdCount} turnos)`);
    setGeneratedShifts([]);
    setStep(1); // Go back to start on success
    setLoading(false);
    if (onNavigate) onNavigate('shifts');
  };

  const formatShortDate = (dateObj) => {
    return formatDatePT(dateObj);
  };

  const formatShortTime = (dateObj) => {
    return formatTimePT(dateObj);
  };

  return (
    <div className="driver-schedule-view" style={{ padding: '2rem', background: '#fff', minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('shifts')}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#374151'
          }}
          title="Voltar para Gerir turnos"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="dash-title" style={{ margin: 0, fontSize: '1.8rem' }}>
          {step === 1 ? 'Registar turnos' : 'Selecionar Carro'}
        </h1>
      </div>

      {msg && <p className="dash-toast" style={{ color: 'green', marginBottom: '1rem' }}>{msg}</p>}
      {error && <p className="dash-error" style={{ marginBottom: '1rem' }}>{error}</p>}

      {step === 1 && (
        <form onSubmit={handleNextStep} className="schedule-form">
          <div className="schedule-card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '1.1rem' }}>
              <input type="radio" name="scheduleMode" checked={!isMultipleDays} onChange={() => setIsMultipleDays(false)} />
              Único dia
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '1.1rem' }}>
              <input type="radio" name="scheduleMode" checked={isMultipleDays} onChange={() => setIsMultipleDays(true)} />
              Vários dias
            </label>
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

          {!isMultipleDays ? (
            <div className="schedule-card">
              <div className="schedule-row">
                <span className="schedule-label">Data:</span>
                <EuropeanDateInput
                  className="schedule-input"
                  value={startDate}
                  onChange={setStartDate}
                  required
                />
              </div>
            </div>
          ) : (
            <>
              <div className="schedule-card">
                <div className="schedule-row">
                  <span className="schedule-label">Datas:</span>
                  <label className="schedule-sublabel">De</label>
                  <EuropeanDateInput className="schedule-input" value={startDate} onChange={setStartDate} required />
                  <label className="schedule-sublabel">Até:</label>
                  <EuropeanDateInput className="schedule-input" value={endDate} onChange={setEndDate} required />
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
            </>
          )}

          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <button type="submit" className="btn btn--warning schedule-submit-btn" disabled={loading} style={{ width: '100%', maxWidth: '300px', fontSize: '1.2rem', padding: '1rem' }}>
              {loading ? 'A processar...' : 'Seguinte'}
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <div className="schedule-step2">
          {/* Preferred Car Banner */}
          <div className="schedule-preferred-banner" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '1.2rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#b45309', marginBottom: '1rem', fontWeight: 'bold', fontSize: '1.3rem' }}>
              <Wand2 size={24} />
              <span>Atribuição Rápida</span>
              <button 
                type="button" 
                onClick={() => setShowInfoModal(true)}
                style={{ background: 'none', border: 'none', color: '#b45309', cursor: 'pointer', display: 'flex', padding: '0.2rem', marginLeft: '0.2rem' }}
                title="Saber mais"
              >
                <Info size={22} />
              </button>
            </div>
            <div className="schedule-preferred-row" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <select className="schedule-input" style={{ flex: 1, minWidth: '120px' }} value={preferredTaxiPlate} onChange={e => setPreferredTaxiPlate(e.target.value)}>
                {allTaxis.map(t => (
                  <option key={t.license_plate} value={t.license_plate}>
                    {t.brand} {t.model} ({t.license_plate}) - {t.comfort_level === 'luxury' ? 'Luxo' : 'Básico'}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn--warning" onClick={handleApplyPreferred} style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}>
                <Check size={16} /> Aplicar
              </button>
            </div>
          </div>

          {/* Shifts List */}
          <div className="schedule-shifts-list">
            {generatedShifts.map(shift => {
              const availableTaxis = getAvailableTaxis(shift.startDt, shift.endDt);
              return (
                <div key={shift.id} className="schedule-shift-item">
                  <div className="schedule-shift-time">
                    <strong>{formatShortDate(shift.startDt)}</strong>
                    <span>{formatShortTime(shift.startDt)} - {formatShortTime(shift.endDt)}</span>
                  </div>
                  <div className="schedule-shift-taxi" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <select
                      className="schedule-input"
                      value={shift.selectedTaxiPlate}
                      onChange={e => handleTaxiChange(shift.id, e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="" disabled>Selecione um carro...</option>
                      {availableTaxis.map(t => (
                        <option key={t.license_plate} value={t.license_plate}>
                          {t.brand} {t.model} ({t.license_plate}) - {t.comfort_level === 'luxury' ? 'Luxo' : 'Básico'}
                        </option>
                      ))}
                    </select>
                    {shift.isAuto && <span className="auto-label">Automático</span>}

                    <button
                      type="button"
                      onClick={() => {
                        setShiftToDelete(shift.id);
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
                        flexShrink: 0,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                      title="Remover turno"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="schedule-actions-bottom">
            <button type="button" className="btn btn--outline" onClick={() => setStep(1)} disabled={loading} style={{ border: '1px solid #ccc', padding: '0.5rem 1rem', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }}>
              Voltar
            </button>
            <button type="button" className="btn btn--warning schedule-submit-btn" onClick={handleSubmit} disabled={loading} style={{ padding: '0.5rem 1.5rem' }}>
              {loading ? 'A processar...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}

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
              <h3 style={{ marginBottom: '12px', color: '#1f2937' }}>Remover Turno</h3>
              <p style={{ marginBottom: '24px', color: '#4b5563', fontSize: '14px' }}>
                Tem a certeza que deseja remover este turno da sua seleção?
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  style={{
                    padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db',
                    background: '#fff', cursor: 'pointer', fontWeight: 500
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteGeneratedShift}
                  style={{
                    padding: '8px 16px', borderRadius: '6px', border: 'none',
                    background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 500
                  }}
                >
                  Remover
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Info Modal */}
      <AnimatePresence>
        {showInfoModal && (
          <div className="modal-portal">
            <motion.div 
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInfoModal(false)}
            />
            <motion.div 
              className="modal-content"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{ maxWidth: '400px', zIndex: 10001, position: 'relative' }}
            >
              <h3 className="modal-title">Como funciona a Atribuição Rápida?</h3>
              <div className="modal-message" style={{ textAlign: 'left', lineHeight: '1.5' }}>
                <p style={{ marginBottom: '1rem' }}>
                  A <strong>Atribuição Rápida</strong> permite-lhe escolher um carro e tentar atribuí-lo automaticamente a todos os turnos que selecionou.
                </p>
                <p>
                  <strong>Nota:</strong> Esta ação verifica a disponibilidade do veículo. Se o carro já estiver ocupado para o mesmo horário num determinado turno, ele <strong>não</strong> será atribuído a esse turno, mas continuará a ser testado e atribuído aos restantes.
                </p>
              </div>
              <div className="modal-actions" style={{ justifyContent: 'center' }}>
                <button type="button" className="modal-btn modal-btn--confirm" onClick={() => setShowInfoModal(false)}>
                  Entendi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
