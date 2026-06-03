import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

const ROLE_ROUTES = {
  MANAGER: '/manager',
  DRIVER: '/driver',
  CLIENT: '/client',
};

export default function LoginUser() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);
      if (user.type === 'DRIVER') {
        navigate('/decision-driver');
      } else {
        navigate(ROLE_ROUTES[user.type] || '/login');
      }
    } catch (err) {
      const msg =
        err.response?.data?.error || 'Falha na ligação. Por favor tente novamente.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {/* Brand */}
        <div className="login-brand">
          <h1 className="login-brand-name" style={{ margin: 0 }}>TUXY</h1>
        </div>

        <p className="login-subtitle" style={{ marginBottom: '1.5rem' }}>
          Bem-vindo de volta! Inicie sessão para aceder à aplicação.
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            className="login-input"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />

          <label className="login-label" htmlFor="login-password">Palavra-passe</label>
          <input
            id="login-password"
            type="password"
            className="login-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <motion.div
              className="login-error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '8px' }}
            >
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            className="login-btn"
            style={{ fontWeight: 'bold' }}
            disabled={loading}
          >
            {loading ? 'A iniciar sessão…' : 'Entrar'}
          </button>

          <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--gray-600)' }}>
              Ainda não tem conta? <a href="/register" style={{ fontWeight: '600', color: '#854d0e' }}>Registe-se</a>
            </span>
            <hr style={{ border: 'none', borderTop: '1px solid var(--gray-200)' }} />
            <span style={{ fontSize: '0.9rem', color: 'var(--gray-600)' }}>
              Deseja conduzir? <a href="/signup-driver" style={{ fontWeight: '600', color: '#854d0e' }}>Registe-se como motorista</a>
            </span>
          </div>
        </form>
      </motion.div>
    </main>
  );
}

