import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface Account {
  account_number: string;
  account_type: string;
  balance: number;
  customer_id: string;
  transactions: Transaction[];
}

interface Transaction {
  id: string;
  account_number: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  date: string;
  terminal_id: string;
}

interface AppState {
  phoneNumber: string;
  customerId: string | undefined;
  customerName: string;
  error: string;
  registrationCompleted: boolean;
  selectedAccount: Account | null;
  setPhoneNumber: (phone: string) => void;
  setCustomerId: (id: string | undefined) => void;
  setCustomerName: (name: string) => void;
  setError: (error: string) => void;
  setRegistrationCompleted: (completed: boolean) => void;
  setSelectedAccount: (account: Account | null) => void;
  resetState: () => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [phoneNumber, setPhoneNumber] = useState(() => localStorage.getItem('phoneNumber') || '');
  const [customerId, setCustomerId] = useState<string | undefined>(() => localStorage.getItem('customerId') || undefined);
  const [customerName, setCustomerName] = useState(() => localStorage.getItem('customerName') || '');
  const [error, setError] = useState('');
  const [registrationCompleted, setRegistrationCompleted] = useState(() => 
    localStorage.getItem('registrationCompleted') === 'true' || false
  );
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(() => {
    const stored = localStorage.getItem('selectedAccount');
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    localStorage.setItem('phoneNumber', phoneNumber);
  }, [phoneNumber]);

  useEffect(() => {
    if (customerId) {
      localStorage.setItem('customerId', customerId);
    } else {
      localStorage.removeItem('customerId');
    }
  }, [customerId]);

  useEffect(() => {
    localStorage.setItem('customerName', customerName);
  }, [customerName]);

  useEffect(() => {
    localStorage.setItem('registrationCompleted', registrationCompleted.toString());
  }, [registrationCompleted]);

  useEffect(() => {
    if (selectedAccount) {
      localStorage.setItem('selectedAccount', JSON.stringify(selectedAccount));
    } else {
      localStorage.removeItem('selectedAccount');
    }
  }, [selectedAccount]);

  const resetState = () => {
    setPhoneNumber('');
    setCustomerId(undefined);
    setCustomerName('');
    setError('');
    setRegistrationCompleted(false);
    setSelectedAccount(null);
    localStorage.removeItem('phoneNumber');
    localStorage.removeItem('customerId');
    localStorage.removeItem('customerName');
    localStorage.removeItem('registrationCompleted');
    localStorage.removeItem('selectedAccount');
  };

  return (
    <AppContext.Provider
      value={{
        phoneNumber,
        customerId,
        customerName,
        error,
        registrationCompleted,
        selectedAccount,
        setPhoneNumber,
        setCustomerId,
        setCustomerName,
        setError,
        setRegistrationCompleted,
        setSelectedAccount,
        resetState,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};