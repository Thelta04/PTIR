import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
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
        }
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
      alert('Preenche a quantidade, o valor pago e a quilometragem atual.');
      return;
    }

    if (amountNumber <= 0 || priceNumber <= 0 || mileageNumber < 0) {
      alert('A quantidade, o valor pago e a quilometragem têm de ser válidos.');
      return;
    }

    if (taxiInfo && mileageNumber < taxiInfo.mileage) {
      alert(`A quilometragem não pode ser inferior à atual (${taxiInfo.mileage} km).`);
      return;
    }

    if (taxiInfo && taxiInfo.engine_type === 'electric' && (!duration || durationNumber <= 0)) {
      alert('Preenche a duração do carregamento (minutos).');
      return;
    }

    if (!activeShift) {
      alert('Tens de estar num turno ativo para registar um reabastecimento.');
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
      if (err.response && err.response.data) {
        const errorMsg = Object.values(err.response.data).flat()[0];
        if (typeof errorMsg === 'string') {
          alert(`Erro: ${errorMsg}`);
          return;
        }
      }
      alert('Ocorreu um erro ao registar o reabastecimento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="refuel-page">
      <div className="refuel-main">
        <h1>Registar {taxiInfo?.engine_type === 'electric' ? 'Carregamento' : 'Reabastecimento'}</h1>

        <section className="refuel-card">
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

          <button className="refuel-submit" onClick={handleSubmit} disabled={loading}>
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