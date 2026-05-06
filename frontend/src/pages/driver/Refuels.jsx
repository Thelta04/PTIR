import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, X, Check, ChevronLeft } from 'lucide-react';
import './refuels.css';

export default function Refuels() {
  const navigate = useNavigate();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
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

  const handleMenuClick = (path) => {
    setIsMenuOpen(false);
    navigate(path);
  };

  return (
    <div className="refuel-page">

      <main className="refuel-main">
        <h1>Registar Reabastecimento ⛽</h1>

        <section className="refuel-card">

          <div className="refuel-inputs refuel-inputs--clean">
            <input
              className="refuel-field"
              type="number"
              min="0"
              step="0.01"
              placeholder="Quantidade"
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

            <input
              className="refuel-field"
              type="number"
              min="0"
              step="0.01"
              placeholder="Valor pago"
              value={price}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || Number(value) >= 0) setPrice(value);
              }}
            />

            <span className="refuel-currency">€</span>
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
            Cancelar
          </button>

          <button className="refuel-submit" onClick={handleSubmit}>
            Registar Reabastecimento
          </button>
        </div>
      </main>

      {isMenuOpen && (
        <>
          <div
            className="refuel-drawer-overlay"
            onClick={() => setIsMenuOpen(false)}
          />

          <aside className="refuel-drawer-menu">
            <div className="refuel-drawer-header">
              <span className="refuel-drawer-title">Menu</span>
              <button
                className="refuel-drawer-close"
                onClick={() => setIsMenuOpen(false)}
              >
                <ChevronLeft size={24} />
              </button>
            </div>

            <nav className="refuel-drawer-nav">
              <button
                className="refuel-drawer-link"
                onClick={() => handleMenuClick('/driver')}
              >
                Página Principal
              </button>

              <button
                className="refuel-drawer-link"
                onClick={() => handleMenuClick('/driver')}
              >
                Registar Turno
              </button>

              <button
                className="refuel-drawer-link active"
                onClick={() => handleMenuClick('/driver/refuels')}
              >
                Registar Reabastecimento
              </button>

              <button
                className="refuel-drawer-link"
                onClick={() => handleMenuClick('/driver')}
              >
                Consultar Turnos
              </button>

              <button
                className="refuel-drawer-link"
                onClick={() => handleMenuClick('/driver')}
              >
                Histórico de viagens
              </button>
            </nav>
          </aside>
        </>
      )}

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