import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { createRefuel, listShifts } from '../../api/client';
import './refuels.css';

export default function Refuels() {
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [mileage, setMileage] = useState('');
  const [unit, setUnit] = useState('L');
  const [showPopup, setShowPopup] = useState(false);
  const [activeShift, setActiveShift] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchShift = async () => {
      const storedUser = localStorage.getItem('tuxy_user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        try {
          const { data: shifts } = await listShifts(user.id);
          const active = shifts.find(s => s.real_interval && !s.real_interval.end_time);
          if (active) setActiveShift(active);
        } catch (err) {
          console.error("Failed to fetch shift", err);
        }
      }
    };
    fetchShift();
  }, []);

  const handleSubmit = async () => {
    const amountNumber = Number(amount);
    const priceNumber = Number(price);
    const mileageNumber = Number(mileage);

    if (!amount || !price || !mileage) {
      alert('Preenche a quantidade, o valor pago e a quilometragem atual.');
      return;
    }

    if (amountNumber <= 0 || priceNumber <= 0 || mileageNumber < 0) {
      alert('A quantidade, o valor pago e a quilometragem têm de ser válidos.');
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
      
      await createRefuel(payload);
      setShowPopup(true);
    } catch (err) {
      console.error("Refuel error:", err);
      alert('Ocorreu um erro ao registar o reabastecimento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="refuel-page">
      <main className="refuel-main">
        <h1>Registar Reabastecimento ⛽</h1>

        <section className="refuel-card">
          <div className="refuel-inputs">
            
            <div className="refuel-input-row">
              <label>Quilometragem atual (km)</label>
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
              <label>Quantidade de combustível</label>
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
                <select
                  className="refuel-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  <option value="L">L</option>
                  <option value="kWh">kWh</option>
                </select>
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
          </div>
        </section>

        <div className="refuel-actions">
          <button
            className="refuel-cancel"
            onClick={() => {
              setAmount('');
              setPrice('');
              setMileage('');
              setUnit('L');
            }}
            disabled={loading}
          >
            Limpar
          </button>

          <button className="refuel-submit" onClick={handleSubmit} disabled={loading}>
            {loading ? 'A registar...' : 'Confirmar'}
          </button>
        </div>
      </main>

      {showPopup && (
        <div className="refuel-popup-overlay">
          <div className="refuel-popup">
            <button className="popup-close" onClick={() => setShowPopup(false)}>
              <X size={20} />
            </button>

            <div className="success-badge">
              <Check size={42} />
            </div>

            <h2>Refuel Successful</h2>

            <p className="popup-text">
              O reabastecimento foi registado com sucesso.
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
                setMileage('');
                setUnit('L');
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