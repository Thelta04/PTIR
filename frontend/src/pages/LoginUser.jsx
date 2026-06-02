import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { PDisplay, PInputEmail, PInputPassword, PButton } from '@porsche-design-system/components-react';


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
    <div className="login-page-user">

      {/* Brand */}
      <div className="tuxy-header-div">
        <span className="tuxy-header-title">TUXY</span>
        <span className="login-brand-sub" style={{ color: "var(--gold-900)" }}>Utilizador</span>
      </div>
      <div className="login-form-container">
        <p className="login-welcome">Bem-vindo de volta!</p>
        <p className="login-subtitle">Inicie sessão para aceder à aplicação</p>


        <form onSubmit={handleSubmit} className="login-form">

          <PInputEmail
            id="login-email"
            label="Email"
            type="email"
            className="session-input"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />


          <PInputPassword
            id="login-email"
            className="session-input"
            label="Palavra-passe"
            name="password"
            toggle={true}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={true}
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
            {loading ? 'A iniciar sessão…' : 'Entrar'}


          </button>
          <p className="login-subtitle">Ainda não tem conta? <a href="/register">Registe-se</a></p>
          <hr></hr>
          <p className="login-subtitle">Deseja registar-se como motorista? <a href="/signup-driver">Registe-se aqui!</a></p>

        </form>
      </div>
    </div>

  );
}

