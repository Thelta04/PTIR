import { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('tuxy_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { /* corrupt data */ }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { data } = await apiLogin(email, password);
    const userData = {
      id: data.id,
      name: data.name,
      email: data.email,
      type: data.type,
      access: data.access || null,
      refresh: data.refresh || null,
    };
    setUser(userData);
    localStorage.setItem('tuxy_user', JSON.stringify(userData));
    return userData;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('tuxy_user');
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isManager: user?.type === 'MANAGER',
    isDriver: user?.type === 'DRIVER',
    isClient: user?.type === 'CLIENT',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
