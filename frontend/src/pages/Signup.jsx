import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { PSelect, PSelectOption, PInputEmail, PInputPassword, PInputNumber, PInputText } from '@porsche-design-system/components-react';
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
    <div className="login-page-user">

      {/* Brand */}
      <div className="tuxy-header-div">
        <span className="tuxy-header-title">TUXY</span>
        <span className="login-brand-sub" style={{ color: "var(--gold-900)" }}>Cliente</span>
      </div>
      <div className="login-form-container">
        <p className="login-welcome">Bem-vindo</p>
        <p className="login-subtitle">Registe-se para aceder à aplicação</p>


        <form onSubmit={handleSubmit} className="login-form">

          <PFPSelector selectedPfp={profilePic} onSelect={setProfilePic} />

          <PInputText
            label="Nome"
            className="session-input"
            onChange={(e) => setName(e.target.value)}
            required
          />

          <PInputNumber
            label="NIF"
            className="session-input"
            name="some-name"
            placeholder="NNN NNN NNN"
            onChange={(e) => setNif(e.target.value)}
            required
          />

          <PSelect
            id="login-opcao"
            name="options"
            label="Género"
            className="session-input"
            value={opcao}
            onChange={(e) => setGender(e.target.value)}
            required
          >
            <PSelectOption value="Female">
              Feminino
            </PSelectOption>

            <PSelectOption value="Male">
              Masculino
            </PSelectOption>

            <PSelectOption value="Other">
              Outro
            </PSelectOption>
          </PSelect>


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

          {passwordWarning && (
            <div className="login-error" style={{ marginTop: '-8px', fontSize: '0.85rem' }}>
              {passwordWarning}
            </div>
          )}

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
            {loading ? 'A registar…' : 'Registar'}


          </button>
          <p className="login-subtitle">Já tem uma conta? <a href="/login">Iniciar Sessão</a></p>
          <hr></hr>
          <p className="login-subtitle">Deseja registar-se como motorista? <a href="/signup-driver">Registe-se aqui!</a></p>
        </form>
      </div>
    </div>

  );
}
