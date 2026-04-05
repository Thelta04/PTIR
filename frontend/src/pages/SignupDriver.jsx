import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { PSelect, PInputDate, PSelectOption, PInputEmail, PInputPassword, PInputNumber, PInputText } from '@porsche-design-system/components-react';


const ROLE_ROUTES = {
  MANAGER: '/manager',
  DRIVER: '/driver',
  CLIENT: '/client',
};

export default function SignupDriver() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [opcao, setGender] = useState("");
  const [name, setName] = useState("");
  const [nif, setNif] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);
      navigate(ROLE_ROUTES[user.type] || '/login-client');
    } catch (err) {
      const msg =
        err.response?.data?.error || 'Connection failed. Please try again.';
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
          <span className="login-brand-sub" style={{ color: "var(--gold-900)" }}>Client</span>
        </div>
        <div className="login-form-container">
          <p className="login-welcome">New Driver</p>
          <p className="login-subtitle">Sign up to access the app</p>


          <form onSubmit={handleSubmit} className="login-form">

            <PInputText 
            label="Name" 
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

            <div style={{ display: "flex" }}>
              <PSelect
                id="login-opcao"
                name="options"
                label="Gender"
                className="session-input half-width"
                value={opcao}
                onChange={(e) => setGender(e.target.value)}
                required
                >
                <PSelectOption value="female">
                    Female
                </PSelectOption>
                
                <PSelectOption value="male">
                    Male
                </PSelectOption>

                <PSelectOption value="other">
                    Other
                </PSelectOption>
              </PSelect>

              <PInputDate
                id="login-data"
                name="some-name"
                label="Birth Date"
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
            id="login-email"
              className="session-input" 
              label="Password" 
              name="password" 
              toggle={true}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={true}
            />

            <PInputNumber 
            label="Drivers License Number" 
            className="session-input"
            name="some-name" 
            onChange={(e) => setNif(e.target.value)}
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
            <p className="login-subtitle">Already have an account? <a href="/login-user">Log In</a></p>
            </form>
        </div>
    </div>
    
  );
}

