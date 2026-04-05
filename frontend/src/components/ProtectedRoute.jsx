import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) return null; // still rehydrating

  if (!user) return <Navigate to="/login-client" replace />;

  if (allowedRoles && !allowedRoles.includes(user.type)) {
    return <Navigate to="/login-client" replace />;
  }

  return children;
}
