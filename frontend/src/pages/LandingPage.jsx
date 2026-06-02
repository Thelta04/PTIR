import React from 'react';
import { useNavigate } from 'react-router-dom';
import './landing.css';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      <div className="landing-card">
        <div className="landing-header">
          <img src="/icon.png" alt="TUXY Icon" className="landing-logo" />
          <h1 className="landing-title">TUXY</h1>
          <p className="landing-subtitle">A sua viagem começa aqui.</p>
        </div>
        
        <div className="landing-actions">
          <button 
            className="landing-btn landing-btn--primary" 
            onClick={() => navigate('/login')}
          >
            Entrar na Conta
          </button>
          <button 
            className="landing-btn landing-btn--secondary" 
            onClick={() => navigate('/register')}
          >
            Registar
          </button>
        </div>
      </div>
      
      <div className="landing-footer">
        <p>&copy; 2026 TUXY. Todos os direitos reservados.</p>
      </div>
    </div>
  );
}
