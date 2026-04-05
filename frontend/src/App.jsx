import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginManager from './pages/LoginManager';
import LoginUser from './pages/LoginUser';
import ManagerDashboard from './pages/ManagerDashboard';
import DriverDashboard from './pages/DriverDashboard';
import ClientDashboard from './pages/ClientDashboard';
import './App.css';

const ROLE_ROUTES = {
  MANAGER: '/manager',
  DRIVER: '/driver',
  CLIENT: '/client',
};

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login-client" replace />;
  return <Navigate to={ROLE_ROUTES[user.type] || '/login-client'} replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login-client" element={<LoginUser />} />
          <Route path="/login-manager" element={<LoginManager />} />

          <Route path="/manager" element={
            <ProtectedRoute allowedRoles={['MANAGER']}>
              <ManagerDashboard />
            </ProtectedRoute>
          } />

          <Route path="/driver" element={
            <ProtectedRoute allowedRoles={['DRIVER']}>
              <DriverDashboard />
            </ProtectedRoute>
          } />

          <Route path="/client" element={
            <ProtectedRoute allowedRoles={['CLIENT']}>
              <ClientDashboard />
            </ProtectedRoute>
          } />

          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;