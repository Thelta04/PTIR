import { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, createClient, createDriver, updateProfilePic } from '../api/client';

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
      profile_pic: data.profile_pic,
      gender: data.gender,
      birth_year: data.birth_year || null,
      access: data.access || null,
      refresh: data.refresh || null,
    };
    setUser(userData);
    localStorage.setItem('tuxy_user', JSON.stringify(userData));
    return userData;
  };

  const signup = async (signupData) => {
    await createClient(signupData);
    // After successful signup, we log the user in
    return await login(signupData.email, signupData.password);
  };

  const signupDriver = async (signupData) => {
    await createDriver(signupData);
    // After successful signup, we log the user in
    return await login(signupData.email, signupData.password);
  };

  const updateUserPfp = async (pfpId) => {
    if (!user?.id) return;
    try {
      await updateProfilePic(user.id, pfpId);
      const updatedUser = { ...user, profile_pic: pfpId };
      setUser(updatedUser);
      localStorage.setItem('tuxy_user', JSON.stringify(updatedUser));
    } catch (err) {
      console.error('Error updating profile pic:', err);
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('tuxy_user');
  };

  const value = {
    user,
    loading,
    login,
    signup,
    signupDriver,
    updateUserPfp,
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
