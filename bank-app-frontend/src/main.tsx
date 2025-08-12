import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { BehavioralAnalytics } from './providers/BehavioralAnalyticsProvider.tsx';
import {AppProvider} from "@/context/AppContext.tsx";

createRoot(document.getElementById("root")!).render(
    <AppProvider>
        <BehavioralAnalytics.Provider
            endpoint="http://localhost:8000/api/v1/analytics/behavior"
            intervalMs={60000} // Set to 60 seconds
            debug={false}
        >
            <App />
        </BehavioralAnalytics.Provider>
    </AppProvider>
);
