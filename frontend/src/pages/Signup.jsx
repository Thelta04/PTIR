import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import PFPSelector from '../components/PFPSelector';
import { getPasswordValidationMessage } from '../utils/validation';

const ROLE_ROUTES = {
  MANAGER: '/manager',
  DRIVER: '/driver',
  CLIENT: '/client',
};

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [opcao, setGender] = useState("");
  const [name, setName] = useState("");
  const [nif, setNif] = useState("");
  const [profilePic, setProfilePic] = useState(1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const passwordValidationMessage = getPasswordValidationMessage(password);
    if (passwordValidationMessage) {
      return;
    }

    setLoading(true);

    try {
      const user = await signup({
        email,
        password,
        name,
        nif,
        gender: opcao,
        profile_pic: profilePic
      });
      navigate(ROLE_ROUTES[user.type] || '/client');
    } catch (err) {
      const msg =
        err.response?.data?.error || 'Falha na ligação. Por favor tente novamente.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const passwordWarning = password ? getPasswordValidationMessage(password) : '';

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
          <span className="login-brand-sub">Cliente</span>
        </div>

        <p className="login-subtitle" style={{ marginBottom: '1.5rem' }}>
          Bem-vindo! Registe-se para aceder à aplicação.
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <PFPSelector selectedPfp={profilePic} onSelect={setProfilePic} />

          <label className="login-label" htmlFor="signup-name">Nome</label>
          <input
            id="signup-name"
            type="text"
            className="login-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <label className="login-label" htmlFor="signup-nif">NIF</label>
          <input
            id="signup-nif"
            type="number"
            className="login-input"
            placeholder="NNN NNN NNN"
            value={nif}
            onChange={(e) => setNif(e.target.value)}
            required
          />

          <label className="login-label" htmlFor="signup-gender">Género</label>
          <select
            id="signup-gender"
            className="login-input"
            value={opcao}
            onChange={(e) => setGender(e.target.value)}
            required
            style={{ backgroundColor: '#fff' }}
          >
            <option value="" disabled>Selecione um género</option>
            <option value="Female">Feminino</option>
            <option value="Male">Masculino</option>
            <option value="Other">Outro</option>
          </select>

          <label className="login-label" htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            type="email"
            className="login-input"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label className="login-label" htmlFor="signup-password">Palavra-passe</label>
          <input
            id="signup-password"
            type="password"
            className="login-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {passwordWarning && (
            <div className="login-error" style={{ marginTop: '-8px', fontSize: '0.85rem', color: '#b91c1c' }}>
              {passwordWarning}
            </div>
          )}

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
            className="login-btn btn--primary"
            style={{ fontWeight: 'bold' }}
            disabled={loading}
          >
            {loading ? 'A registar…' : 'Registar'}
          </button>
          
          <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--gray-600)' }}>
              Já tem uma conta? <a href="/login" style={{ fontWeight: '600', color: '#854d0e' }}>Iniciar Sessão</a>
            </span>
            <hr style={{ border: 'none', borderTop: '1px solid var(--gray-200)' }} />
            <span style={{ fontSize: '0.9rem', color: 'var(--gray-600)' }}>
              Deseja registar-se como motorista? <a href="/signup-driver" style={{ fontWeight: '600', color: '#854d0e' }}>Registe-se aqui!</a>
            </span>
          </div>
        </form>
      </motion.div>
    </main>
  );
}
