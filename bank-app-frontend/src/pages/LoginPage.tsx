import { useNavigate } from "react-router-dom";
import FidoLogin from "@/components/FidoLogin";
import { useEffect, useState } from "react";
import { loadCustomerInfo } from "@/utils/deviceStateChecker";
import { useAppContext } from "@/context/AppContext";

const LoginPage = () => {
  const navigate = useNavigate();
  const { setCustomerId, setCustomerName } = useAppContext();
  const [customerName, setLocalCustomerName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('LoginPage: Component mounted at', new Date().toISOString());
    const fetchCustomerInfo = async () => {
      setIsLoading(true);
      try {
        console.log('LoginPage: Loading customer info from IndexedDB');
        const customerInfo = await loadCustomerInfo();
        console.log('LoginPage: Customer info:', customerInfo);
        if (customerInfo && customerInfo.customerId && customerInfo.name) {
          setCustomerId(customerInfo.customerId);
          setCustomerName(customerInfo.name);
          setLocalCustomerName(customerInfo.name);
        } else {
          console.log('LoginPage: No customer info found, redirecting to /landing');
          navigate("/landing", { replace: true });
        }
      } catch (err) {
        console.error('LoginPage: Error loading customer info:', err);
        setError(`Failed to load customer info: ${err instanceof Error ? err.message : 'Unknown error'}`);
        navigate("/landing", { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomerInfo();
  }, [navigate, setCustomerId, setCustomerName]);

  const handleProceed = () => {
    console.log('LoginPage: Navigating to /dashboard');
    navigate("/dashboard", { replace: true });
  };

  if (error) {
    console.error('LoginPage: Rendering error:', error);
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Error: {error}
      </div>
    );
  }

  if (isLoading) {
    console.log('LoginPage: Rendering loading state');
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0' }}>
        Loading...
      </div>
    );
  }

  console.log('LoginPage: Rendering FidoLogin with customerName:', customerName);
  return <FidoLogin onSuccess={handleProceed} customerName={customerName} />;
};

export default LoginPage;