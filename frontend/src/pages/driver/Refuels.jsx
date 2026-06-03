import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createRefuel, listShifts, getTaxi } from '../../api/client';
import './refuels.css';

export default function Refuels() {
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [mileage, setMileage] = useState('');
  const [unit, setUnit] = useState('L');
  const [duration, setDuration] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [activeShift, setActiveShift] = useState(null);
  const [taxiInfo, setTaxiInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 5000);
  };

  useEffect(() => {
    const fetchShift = async () => {
      const storedUser = localStorage.getItem('tuxy_user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        try {
          const { data: shifts } = await listShifts(user.id);
          const active = shifts.find(s => s.real_interval && !s.real_interval.end_time);
          if (active) {
            setActiveShift(active);
            const { data: taxi } = await getTaxi(active.taxi_plate);
            setTaxiInfo(taxi);
            setMileage(taxi.mileage.toString());
            setUnit(taxi.engine_type === 'electric' ? 'kWh' : 'L');
          }
        } catch (err) {
          console.error("Failed to fetch shift/taxi", err);
        } finally {
          setShiftLoading(false);
        }
      } else {
        setShiftLoading(false);
      }
    };
    fetchShift();
  }, []);

  const handleSubmit = async () => {
    const amountNumber = Number(amount);
    const priceNumber = Number(price);
    const mileageNumber = Number(mileage);
    const durationNumber = Number(duration);

    if (!amount || !price || !mileage) {
      showError('Preenche a quantidade, o valor pago e a quilometragem atual.');
      return;
    }

    if (amountNumber <= 0 || priceNumber <= 0 || mileageNumber < 0) {
      showError('A quantidade, o valor pago e a quilometragem têm de ser válidos.');
      return;
    }

    if (taxiInfo && mileageNumber < taxiInfo.mileage) {
      showError(`A quilometragem não pode ser inferior à atual (${taxiInfo.mileage} km).`);
      return;
    }

    if (taxiInfo && taxiInfo.engine_type === 'electric' && (!duration || durationNumber <= 0)) {
      showError('Preenche a duração do carregamento (minutos).');
      return;
    }

    if (!activeShift) {
      showError('Tens de estar num turno ativo para registar um reabastecimento.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        cost: priceNumber,
        kwh: unit === 'kWh' ? amountNumber : null,
        liters: unit === 'L' ? amountNumber : null,
        initial_mileage: mileageNumber,
        shift: activeShift.id
      };
      
      if (taxiInfo && taxiInfo.engine_type === 'electric') {
        payload.duration = durationNumber;
      }

      await createRefuel(payload);
      setShowPopup(true);
      // Update local taxiInfo mileage to avoid repeated validation errors
      setTaxiInfo({ ...taxiInfo, mileage: mileageNumber });
    } catch (err) {
      console.error("Refuel error:", err);
      // Handle possible backend validation errors nicely
      if (err.response && err.response.data && typeof err.response.data === 'object' && !Array.isArray(err.response.data)) {
        const errorVal = Object.values(err.response.data).flat()[0];
        if (typeof errorVal === 'string') {
          showError(`Erro: ${errorVal}`);
          return;
        }
      }
      showError('Ocorreu um erro ao registar o reabastecimento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="refuel-page">
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            style={{
              position: 'fixed',
              bottom: '20px',
              left: '50%',
              background: '#fee2e2',
              color: '#991b1b',
              padding: '1rem 2rem',
              borderRadius: '8px',
              border: '1px solid #fecaca',
              zIndex: 9999,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              fontWeight: '500',
              textAlign: 'center',
              width: 'max-content',
              maxWidth: '90%'
            }}
          >
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="refuel-main">
        <h1>Registar {taxiInfo?.engine_type === 'electric' ? 'Carregamento' : 'Reabastecimento'}</h1>

        {!shiftLoading && !activeShift && (
          <div style={{ background: '#fef3c7', color: '#92400e', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #fde68a', fontSize: '0.95rem' }}>
            <strong>Aviso:</strong> Precisas de ter um turno ativo para poder registar um reabastecimento. Por favor, inicia um turno primeiro.
          </div>
        )}

        <section className="refuel-card" style={{ opacity: !activeShift && !shiftLoading ? 0.6 : 1, pointerEvents: !activeShift && !shiftLoading ? 'none' : 'auto' }}>
          <div className="refuel-inputs">

            <div className="refuel-input-row">
              <label>
                Quilometragem atual (km)
                {taxiInfo && <span className="refuel-current-kms"> (Atual: {taxiInfo.mileage} km)</span>}
              </label>
              <div className="refuel-field-group">
                <input
                  className="refuel-field"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Ex: 125000"
                  value={mileage}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || Number(value) >= 0) setMileage(value);
                  }}
                />
                <span className="refuel-unit">km</span>
              </div>
            </div>

            <div className="refuel-input-row">
              <label>Quantidade de {taxiInfo?.engine_type === 'electric' ? 'energia' : 'combustível'}</label>
              <div className="refuel-field-group">
                <input
                  className="refuel-field"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || Number(value) >= 0) setAmount(value);
                  }}
                />
                <span className="refuel-unit">{unit}</span>
              </div>
            </div>

            <div className="refuel-input-row">
              <label>Valor pago</label>
              <div className="refuel-field-group">
                <input
                  className="refuel-field"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || Number(value) >= 0) setPrice(value);
                  }}
                />
                <span className="refuel-currency">€</span>
              </div>
            </div>

            {taxiInfo && taxiInfo.engine_type === 'electric' && (
              <div className="refuel-input-row">
                <label>Duração do carregamento</label>
                <div className="refuel-field-group">
                  <input
                    className="refuel-field"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Ex: 30"
                    value={duration}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || Number(value) >= 0) setDuration(value);
                    }}
                  />
                  <span className="refuel-unit">min</span>
                </div>
              </div>
            )}

          </div>
        </section>

        <div className="refuel-actions">
          <button
            className="refuel-cancel"
            onClick={() => {
              setAmount('');
              setPrice('');
              setMileage(taxiInfo ? taxiInfo.mileage.toString() : '');
              setDuration('');
            }}
            disabled={loading}
          >
            Limpar
          </button>

          <button className="refuel-submit" onClick={handleSubmit} disabled={loading || (!activeShift && !shiftLoading)}>
            {loading ? 'A registar...' : 'Confirmar'}
          </button>
        </div>
      </div>

      {showPopup && (
        <div className="refuel-popup-overlay">
          <div className="refuel-popup">
            <button className="popup-close" onClick={() => setShowPopup(false)}>
              <X size={20} />
            </button>

            <div className="success-badge">
              <Check size={42} />
            </div>

            <h2>Registado com sucesso</h2>

            <p className="popup-text">
              O registo foi efetuado com sucesso.
            </p>

            <div className="popup-info">
              <span>Quilometragem</span>
              <strong>{mileage} km</strong>
            </div>

            <div className="popup-divider" />

            <div className="popup-info">
              <span>Quantidade</span>
              <strong>
                {amount} {unit}
              </strong>
            </div>

            {taxiInfo && taxiInfo.engine_type === 'electric' && (
              <>
                <div className="popup-divider" />
                <div className="popup-info">
                  <span>Duração</span>
                  <strong>{duration} min</strong>
                </div>
              </>
            )}

            <div className="popup-divider" />

            <div className="popup-info">
              <span>Valor pago</span>
              <strong>{price} €</strong>
            </div>

            <button
              className="popup-button"
              onClick={() => {
                setShowPopup(false);
                setAmount('');
                setPrice('');
                setMileage(taxiInfo ? taxiInfo.mileage.toString() : '');
                setDuration('');
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}