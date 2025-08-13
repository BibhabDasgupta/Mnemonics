// --- File: src/context/SecurityContext.tsx ---
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SecurityAlert {
  id: string;
  timestamp: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  anomalyType: string;
  decision_score?: number;
  recommendations: string[];
  blocked: boolean;
}

interface SecurityContextType {
  currentAlert: SecurityAlert | null;
  setSecurityAlert: (alert: SecurityAlert | null) => void;
  clearAlert: () => void;
  isSecurityBlocked: boolean;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const SecurityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentAlert, setCurrentAlert] = useState<SecurityAlert | null>(null);
  
  const setSecurityAlert = (alert: SecurityAlert | null) => {
    setCurrentAlert(alert);
  };
  
  const clearAlert = () => {
    setCurrentAlert(null);
  };
  
  const isSecurityBlocked = currentAlert?.blocked || false;
  
  return (
    <SecurityContext.Provider value={{
      currentAlert,
      setSecurityAlert,
      clearAlert,
      isSecurityBlocked
    }}>
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurityContext = () => {
  const context = useContext(SecurityContext);
  if (context === undefined) {
    throw new Error('useSecurityContext must be used within a SecurityProvider');
  }
  return context;
};