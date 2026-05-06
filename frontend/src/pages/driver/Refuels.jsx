import { useState } from 'react';
import { X, Check } from 'lucide-react';
import './refuels.css';

export default function Refuels() {
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('L');
  const [showPopup, setShowPopup] = useState(false);

  const handleSubmit = () => {
    const amountNumber = Number(amount);
    const priceNumber = Number(price);

    if (!amount || !price) {
      alert('Preenche a quantidade e o valor pago.');
      return;
    }

    if (amountNumber <= 0 || priceNumber <= 0) {
      alert('A quantidade e o valor pago têm de ser superiores a zero.');
      return;
    }

    setShowPopup(true);
  };

  return (
    <div className="refuel-page">
      <main className="refuel-main">
        <h1>Registar Reabastecimento ⛽</h1>

        <section className="refuel-card">
          <div className="refuel-inputs">
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
              setUnit('L');
            }}
          >
            Limpar
          </button>

          <button className="refuel-submit" onClick={handleSubmit}>
            Confirmar
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