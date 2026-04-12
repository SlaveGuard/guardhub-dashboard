import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';

// We will implement these screens next
import LoginScreen from './screens/auth/LoginScreen';
import RegisterScreen from './screens/auth/RegisterScreen';
import DashboardScreen from './screens/dashboard/DashboardScreen';
import TelemetryScreen from './screens/dashboard/TelemetryScreen';
import DevicesScreen from './screens/dashboard/DevicesScreen';
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
        </Route>
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardScreen />} />
          <Route path="/telemetry" element={<TelemetryScreen />} />
          <Route path="/devices" element={<DevicesScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
