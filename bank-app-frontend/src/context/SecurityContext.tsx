// --- File: src/context/SecurityContext.tsx ---
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { SecurityService } from '@/services/securityService';

interface TransactionData {
  recipient_account_number: string;
  amount: number;
  terminal_id: string;
  biometric_hash: string;
}

interface SecurityAlert {
  id: string;
  timestamp: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  anomalyType: string;
  decision_score?: number;
  recommendations: string[];
  blocked: boolean;
  transactionDetails?: {
    type: string;
    features: string[];
    timestamp: string;
    // Add transaction data for retry
    transactionData?: TransactionData;
  };
}

interface SecurityContextType {
  currentAlert: SecurityAlert | null;
  setSecurityAlert: (alert: SecurityAlert | null) => void;
  clearAlert: () => void;
  isSecurityBlocked: boolean;
  triggerAlert: (alert: SecurityAlert) => void;
  triggerTransactionAlert: (alert: SecurityAlert, transactionData?: TransactionData) => void;
  pendingTransaction: TransactionData | null; // Store pending transaction for retry
  setPendingTransaction: (transaction: TransactionData | null) => void;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const SecurityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentAlert, setCurrentAlert] = useState<SecurityAlert | null>(null);
  const [isSecurityBlocked, setIsSecurityBlocked] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<TransactionData | null>(null);
  
  // Initialize from sessionStorage on mount
  useEffect(() => {
    const initializeFromStorage = () => {
      try {
        // Load stored alert
        const storedAlert = sessionStorage.getItem('security_alert');
        if (storedAlert) {
          const parsedAlert = JSON.parse(storedAlert);
          setCurrentAlert(parsedAlert);
          setIsSecurityBlocked(parsedAlert?.blocked || false);
        }

        // Load stored pending transaction
        const storedTransaction = sessionStorage.getItem('pending_transaction');
        if (storedTransaction) {
          const parsedTransaction = JSON.parse(storedTransaction);
          setPendingTransaction(parsedTransaction);
        }
      } catch (error) {
        console.error('Failed to load security context from storage:', error);
        // Clear corrupted data
        sessionStorage.removeItem('security_alert');
        sessionStorage.removeItem('pending_transaction');
      }
    };

    initializeFromStorage();
  }, []);

  // Navigation helper function
  const navigateToSecurityVerification = () => {
    if (typeof window !== 'undefined') {
      // Use window.location for reliable navigation
      window.location.href = '/security-verification';
    }
  };

  const setSecurityAlert = (alert: SecurityAlert | null) => {
    setCurrentAlert(alert);
    setIsSecurityBlocked(alert?.blocked || false);
    
    if (alert) {
      sessionStorage.setItem('security_alert', JSON.stringify(alert));
    } else {
      sessionStorage.removeItem('security_alert');
    }
  };
  
  const clearAlert = () => {
    console.log('🔒 [SecurityContext] Clearing security alert and pending transaction');
    
    setCurrentAlert(null);
    setIsSecurityBlocked(false);
    setPendingTransaction(null);
    
    // Clear from sessionStorage
    sessionStorage.removeItem('security_alert');
    sessionStorage.removeItem('pending_transaction');
  };
  
  const triggerAlert = (alert: SecurityAlert) => {
    console.log('🚨 [SecurityContext] Triggering security alert:', alert.id);
    
    setCurrentAlert(alert);
    setIsSecurityBlocked(alert.blocked);
    
    // Store alert for persistence
    sessionStorage.setItem('security_alert', JSON.stringify(alert));
    
    // Navigate to security verification page
    navigateToSecurityVerification();
  };
  
  const triggerTransactionAlert = (alert: SecurityAlert, transactionData?: TransactionData) => {
    console.log('💳 [SecurityContext] Triggering transaction alert with data:', {
      alertId: alert.id,
      hasTransactionData: !!transactionData
    });
    
    // Store transaction data for retry if provided
    if (transactionData) {
      // Enhance alert with transaction data
      const enhancedAlert: SecurityAlert = {
        ...alert,
        transactionDetails: {
          ...alert.transactionDetails,
          type: 'TRANSACTION_FRAUD',
          features: alert.transactionDetails?.features || [],
          timestamp: alert.timestamp,
          transactionData
        }
      };
      
      setPendingTransaction(transactionData);
      sessionStorage.setItem('pending_transaction', JSON.stringify(transactionData));
      
      triggerAlert(enhancedAlert);
    } else {
      triggerAlert(alert);
    }
  };

  const updatePendingTransaction = (transaction: TransactionData | null) => {
    console.log('💳 [SecurityContext] Updating pending transaction:', !!transaction);
    
    setPendingTransaction(transaction);
    
    if (transaction) {
      sessionStorage.setItem('pending_transaction', JSON.stringify(transaction));
    } else {
      sessionStorage.removeItem('pending_transaction');
    }
  };
  
  return (
    <SecurityContext.Provider value={{
      currentAlert,
      setSecurityAlert,
      clearAlert,
      isSecurityBlocked,
      triggerAlert,
      triggerTransactionAlert,
      pendingTransaction,
      setPendingTransaction: updatePendingTransaction
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

// Export types for use in other components
export type { SecurityAlert, TransactionData };