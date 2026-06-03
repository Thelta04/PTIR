import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import PFPSelector from '../components/PFPSelector';
import { getLicenseNumberValidationMessage, getPasswordValidationMessage } from '../utils/validation';

const ROLE_ROUTES = {
  MANAGER: '/manager',
  DRIVER: '/driver',
  CLIENT: '/client',
};

export default function SignupDriver() {
  const { signupDriver } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [opcao, setGender] = useState("");
  const [name, setName] = useState("");
  const [nif, setNif] = useState("");
  const [birth_date, setDateOfBirth] = useState("");
  const [license_number, setLicenseNumber] = useState("");
  const [profilePic, setProfilePic] = useState(1);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const passwordValidationMessage = getPasswordValidationMessage(password);
    if (passwordValidationMessage) {
      return;
    }

    const licenseNumberValidationMessage = getLicenseNumberValidationMessage(license_number);
    if (licenseNumberValidationMessage) {
      return;
    }

    setLoading(true);

    try {
      // Extract year from birth_date (format can be YYYY-MM-DD or DD/MM/YYYY)
      let birth_year = '';
      if (birth_date) {
        if (birth_date.includes('-')) {
          birth_year = birth_date.split('-')[0];
        } else if (birth_date.includes('/')) {
          birth_year = birth_date.split('/').pop();
        }
      }

      const user = await signupDriver({
        email,
        password,
        name,
        nif,
        gender: opcao,
        license_number,
        birth_year,
        profile_pic: profilePic
      });
      navigate(ROLE_ROUTES[user.type] || '/driver');
    } catch (err) {
      const msg =
        err.response?.data?.error || 'Connection failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const passwordWarning = password ? getPasswordValidationMessage(password) : '';
  const licenseNumberWarning = license_number ? getLicenseNumberValidationMessage(license_number) : '';

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
          <span className="login-brand-sub">Motorista</span>
        </div>

        <p className="login-subtitle" style={{ marginBottom: '1.5rem' }}>
          Novo Motorista! Registe-se para aceder à aplicação.
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

          <div style={{ display: "flex", gap: "10px", width: "100%" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label className="login-label" htmlFor="signup-gender">Género</label>
              <select
                id="signup-gender"
                className="login-input"
                value={opcao}
                onChange={(e) => setGender(e.target.value)}
                required
                style={{ backgroundColor: '#fff' }}
              >
                <option value="" disabled>Selecione</option>
                <option value="Female">Feminino</option>
                <option value="Male">Masculino</option>
                <option value="Other">Outro</option>
              </select>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label className="login-label" htmlFor="signup-date">Data Nascimento</label>
              <input
                id="signup-date"
                type="date"
                className="login-input"
                value={birth_date}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
              />
            </div>
          </div>

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

          <label className="login-label" htmlFor="signup-license">Número da Carta de Condução</label>
          <input
            id="signup-license"
            type="text"
            className="login-input"
            value={license_number}
            onChange={(e) => setLicenseNumber(e.target.value)}
            maxLength={12}
            required
          />

          {licenseNumberWarning && (
            <div className="login-error" style={{ marginTop: '-8px', fontSize: '0.85rem', color: '#b91c1c' }}>
              {licenseNumberWarning}
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
            style={{ fontWeight: 'bold', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? 'A registar…' : 'Registar'}
          </button>
          
          <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--gray-600)' }}>
              Já tem uma conta? <a href="/login-user" style={{ fontWeight: '600', color: '#854d0e' }}>Iniciar Sessão</a>
            </span>
          </div>
        </form>
      </motion.div>
    </main>
  );
}
