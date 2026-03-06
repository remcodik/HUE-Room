import { useEffect } from 'react';
import { useHueStore } from './store/useHueStore';
import { isConfigured, getStoredConfig } from './services/hue';
import SetupWizard from './pages/SetupWizard';
import MainApp from './pages/MainApp';

export default function App() {
  const { connected, setConnection, refresh, startPolling } = useHueStore();
  const configured = isConfigured();

  // On mount: if already configured, connect immediately
  useEffect(() => {
    if (configured && !connected) {
      const { ip, username } = getStoredConfig();
      if (ip && username) {
        setConnection(ip, username);
        refresh().then(() => startPolling());
      }
    }
  }, []);

  if (!configured && !connected) {
    return <SetupWizard />;
  }

  return <MainApp />;
}
