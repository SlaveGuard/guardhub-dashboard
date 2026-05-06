import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';

// We will implement these screens next
import LoginScreen from './screens/auth/LoginScreen';
import RegisterScreen from './screens/auth/RegisterScreen';
import VerifyEmailScreen from './screens/auth/VerifyEmailScreen';
import ForgotPasswordScreen from './screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from './screens/auth/ResetPasswordScreen';
import DashboardScreen from './screens/dashboard/DashboardScreen';
import TelemetryScreen from './screens/dashboard/TelemetryScreen';
import ProfilesScreen from './screens/dashboard/DevicesRedesignScreen';
import AlertsScreen from './screens/dashboard/AlertsScreen';
import AuditScreen from './screens/dashboard/AuditScreen';
import SettingsScreen from './screens/dashboard/SettingsScreen';
import Layout from './components/Layout';
import PublicLayout from './components/PublicLayout';

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

// Public Route Wrapper (redirects to dashboard if already logged in)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
};

function App() {
  return (
    <BrowserRouter>
      {/* Toast notifications container */}
      <Toaster position="top-right" toastOptions={{
        style: {
          background: '#334155',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.1)'
        }
      }} />

      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* Public Routes */}
        <Route element={<PublicRoute><PublicLayout /></PublicRoute>}>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/register" element={<RegisterScreen />} />
          <Route path="/verify-email" element={<VerifyEmailScreen />} />
          <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
          <Route path="/reset-password" element={<ResetPasswordScreen />} />
        </Route>
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardScreen />} />
          <Route path="/telemetry" element={<TelemetryScreen />} />
          <Route path="/alerts" element={<AlertsScreen />} />
          <Route path="/audit" element={<AuditScreen />} />
          <Route path="/profiles" element={<ProfilesScreen />} />
          <Route path="/devices" element={<Navigate to="/profiles" replace />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
