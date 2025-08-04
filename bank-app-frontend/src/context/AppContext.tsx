import { createContext, useContext, useState, ReactNode } from "react";

interface AppState {
  phoneNumber: string;
  customerId: string | undefined;
  error: string;
  registrationCompleted: boolean;
  setPhoneNumber: (phone: string) => void;
  setCustomerId: (id: string | undefined) => void;
  setError: (error: string) => void;
  setRegistrationCompleted: (completed: boolean) => void;
  resetState: () => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [error, setError] = useState("");
  const [registrationCompleted, setRegistrationCompleted] = useState(false);

  const resetState = () => {
    setPhoneNumber("");
    setCustomerId(undefined);
    setError("");
    setRegistrationCompleted(false);
  };

  return (
    <AppContext.Provider
      value={{
        phoneNumber,
        customerId,
        error,
        registrationCompleted,
        setPhoneNumber,
        setCustomerId,
        setError,
        setRegistrationCompleted,
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
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};