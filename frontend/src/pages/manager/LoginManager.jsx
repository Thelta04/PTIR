import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';

const ROLE_ROUTES = {
  MANAGER: '/manager'
};

export default function LoginManager() {
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
      navigate(ROLE_ROUTES[user.type] || '/manager');
    } catch (err) {
      const msg =
        err.response?.data?.error || 'Connection failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {/* Brand */}
        <div className="login-brand">
          <span className="login-brand-name">TUXY</span>
          <span className="login-brand-sub">Gestor</span>
        </div>

        <p className="login-subtitle">Entre na sua conta</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            className="login-input"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />

          <label className="login-label" htmlFor="login-password">Password</label>
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
            >
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            className="login-btn"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
