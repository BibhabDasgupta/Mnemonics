// --- File: src/main.tsx ---
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { BehavioralAnalytics } from './providers/BehavioralAnalyticsProvider.tsx';
import { AppProvider } from "@/context/AppContext.tsx";
import { SecurityProvider } from "@/context/SecurityContext.tsx";

createRoot(document.getElementById("root")!).render(
    <AppProvider>
        <SecurityProvider>
            <BehavioralAnalytics.Provider
                endpoint="http://localhost:8000/api/v1/analytics/behavior"
                intervalMs={60000} // Set to 60 seconds
                debug={false}
            >
                <App />
            </BehavioralAnalytics.Provider>
        </SecurityProvider>
    </AppProvider>
);