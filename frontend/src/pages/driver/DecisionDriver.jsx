import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';

export default function DecisionDriver() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selection, setSelection] = useState('DRIVER'); // Default to Driver as it's a driver account

  const handleConfirm = () => {
    if (selection === 'DRIVER') {
      navigate('/driver');
    } else {
      navigate('/client');
    }
  };

  return (
    <div className="decision-page">
      <div className="tuxy-header-div">
        <span className="tuxy-header-title">TUXY</span>
      </div>

      <div className="decision-container">
        <h1 className="decision-welcome">Bem vindo, {user?.name?.split(' ')[0]}!</h1>
        <p className="decision-subtitle">Entrar como...</p>

        <div className="decision-options">
          <motion.div
            className={`decision-option ${selection === 'DRIVER' ? 'active' : ''}`}
            onClick={() => setSelection('DRIVER')}
            whileTap={{ scale: 0.95 }}
          >
            Motorista
          </motion.div>

          <motion.div
            className={`decision-option ${selection === 'CLIENT' ? 'active' : ''}`}
            onClick={() => setSelection('CLIENT')}
            whileTap={{ scale: 0.95 }}
          >
            Cliente
          </motion.div>
        </div>

        <button className="confirm-btn" onClick={handleConfirm}>
          Confirmar
        </button>
      </div>
    </div>
  );
}
