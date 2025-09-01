// --- File: src/main.tsx ---
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AppProvider } from "@/context/AppContext.tsx";
import { SecurityProvider } from "@/context/SecurityContext.tsx";
import { LocationProvider } from "@/context/LocationContext.tsx";

// Remove the BehavioralAnalytics provider from here - it will be applied per route group in App.tsx
createRoot(document.getElementById("root")!).render(
    <AppProvider>
        <SecurityProvider>
            <LocationProvider>
                <App />
            </LocationProvider>
        </SecurityProvider>
    </AppProvider>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content is available, prompt user to refresh
                if (window.confirm('New version available! Refresh to update?')) {
                  window.location.reload();
                }
              }
            });
          }
        });
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}