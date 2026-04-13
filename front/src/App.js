import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Landing from './Landing';
import AnomalyDashboard from './dashboard';
import Realtime from './realtime';
import Login from './Login';
import Admin from './Admin';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import './dashboard.css';
import { AuthProvider, RequireAdmin, RequireAuth } from './auth';

const hideLogoRoutes = ['/'];

const AppLayout = () => {
  const location = useLocation();
  const hideLogo = hideLogoRoutes.includes(location.pathname);

  return (
    <div className="App">
      <Navbar hideLogo={hideLogo} />
      <div className="content-area">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <AnomalyDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/realtime"
            element={
              <RequireAuth>
                <Realtime />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <Admin />
              </RequireAdmin>
            }
          />
        </Routes>
      </div>
      <Footer />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppLayout />
      </Router>
    </AuthProvider>
  );
}

export default App;