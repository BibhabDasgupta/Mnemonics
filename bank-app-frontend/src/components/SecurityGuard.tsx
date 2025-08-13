// --- File: src/components/SecurityGuard.tsx ---
import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSecurityContext } from '@/context/SecurityContext';

interface SecurityGuardProps {
  children: React.ReactNode;
}

const SecurityGuard: React.FC<SecurityGuardProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentAlert, setSecurityAlert } = useSecurityContext();

  useEffect(() => {
    // Check for stored security alert on app load
    const storedAlert = sessionStorage.getItem('security_alert');
    if (storedAlert && !currentAlert) {
      try {
        const alert = JSON.parse(storedAlert);
        setSecurityAlert(alert);
      } catch (error) {
        console.error('Failed to parse stored security alert:', error);
        sessionStorage.removeItem('security_alert');
      }
    }
  }, [currentAlert, setSecurityAlert]);

  useEffect(() => {
    // Redirect to security verification if alert exists and not already on that page
    if (currentAlert && currentAlert.blocked && location.pathname !== '/security-verification') {
      console.log('🚨 Security Guard: Redirecting to security verification');
      navigate('/security-verification', { replace: true });
    }
  }, [currentAlert, location.pathname, navigate]);

  return <>{children}</>;
};

export default SecurityGuard;