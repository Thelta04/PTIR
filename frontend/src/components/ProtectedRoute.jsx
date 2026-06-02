import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles, redirectTo = '/login' }) {
  const { user, loading } = useAuth();

  if (loading) return null; // still rehydrating

  if (!user) return <Navigate to={redirectTo} replace />;

  if (allowedRoles && !allowedRoles.includes(user.type)) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}
