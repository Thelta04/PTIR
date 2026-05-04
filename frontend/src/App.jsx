import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginManager from './pages/manager/LoginManager';
import LoginUser from './pages/LoginUser';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import DriverMain from './pages/driver/DriverMain';
import DecisionDriver from './pages/driver/DecisionDriver';
import ClientMain from './pages/client/ClientMain';
import Signup from './pages/Signup';
import SignupDriver from './pages/SignupDriver';
import './App.css';
import Refuels from './pages/driver/Refuels';

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
          <Route path="/register" element={<Signup />} />
          <Route path="/signup-driver" element={<SignupDriver />} />

          <Route path="/manager" element={
            <ProtectedRoute allowedRoles={['MANAGER']}>
              <ManagerDashboard />
            </ProtectedRoute>
          } />

          <Route path="/decision-driver" element={
            <ProtectedRoute allowedRoles={['DRIVER']}>
              <DecisionDriver />
            </ProtectedRoute>
          } />

          <Route path="/driver" element={
            <ProtectedRoute allowedRoles={['DRIVER']}>
              <DriverMain />
            </ProtectedRoute>
          } />

          <Route path="/client" element={
            <ProtectedRoute allowedRoles={['CLIENT', 'DRIVER']}>
              <ClientMain />
            </ProtectedRoute>
          } />

          <Route path="/driver/refuels" element={<Refuels />} />

          {/* <Route path="/Client" element={<ClientMain />} /> */}

          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;