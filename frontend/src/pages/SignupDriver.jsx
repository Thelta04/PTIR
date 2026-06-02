import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { PSelect, PInputDate, PSelectOption, PInputEmail, PInputPassword, PInputNumber, PInputText } from '@porsche-design-system/components-react';
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
    <div className="login-page-user">
      
        {/* Brand */}
          <div className="tuxy-header-div">
          <span className="tuxy-header-title">TUXY</span>
          <span className="login-brand-sub" style={{ color: "var(--gold-900)" }}>Driver</span>
        </div>
        <div className="login-form-container">
          <p className="login-welcome">Novo Motorista</p>
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
            onChange={(e) => setNif(e.target.value)}
            required
            />

            <div style={{ display: "flex", padding: "0 5px"}}>
              <PSelect
                id="login-opcao"
                name="options"
                label="Género"
                className="session-input half-width"
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

              <PInputDate
                id="login-data"
                name="some-name"
                label="Data de Nascimento"
                className="session-input half-width"
                onChange={(e) => setDateOfBirth(e.target.value)}
                locale="pt-PT" /* Força o formato de Portugal (dd/mm/yyyy) */
                required
              />

            </div>



            <PInputEmail
              id="login-email"
              label="Email" 
              type="email"
              className="session-input"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />

            
            <PInputPassword 
              id="login-password"
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

            <PInputText 
            label="Número da Carta de Condução" 
            className="session-input"
            name="some-name" 
            onChange={(e) => setLicenseNumber(e.target.value)}
            maxLength={12}
            required
            />

            {licenseNumberWarning && (
              <div className="login-error" style={{ marginTop: '-8px', fontSize: '0.85rem' }}>
                {licenseNumberWarning}
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
            <p className="login-subtitle">Já tem uma conta? <a href="/login-user">Iniciar Sessão</a></p>
            </form>
        </div>
    </div>
    
  );
}
