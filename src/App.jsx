import { useEffect, useState } from 'react';
import { useHueStore } from './store/useHueStore';
import {
  isConfigured, getStoredConfig, isRemoteMode,
  exchangeOAuthCode, saveRemoteTokens, linkRemoteBridge,
  getClientId, saveClientId,
} from './services/hue';
import SetupWizard from './pages/SetupWizard';
import MainApp from './pages/MainApp';

export default function App() {
  const { connected, setConnection, refresh, startPolling } = useHueStore();
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState(null);

  // Handle OAuth callback (?code=xxx in URL after Hue login redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      setOauthError('Hue login geweigerd: ' + (params.get('error_description') || error));
      window.history.replaceState({}, '', '/');
      return;
    }

    if (code) {
      // Clear code from URL immediately (prevents re-use on refresh)
      window.history.replaceState({}, '', '/');
      const clientId = params.get('state')
        ? (getClientId() || params.get('state'))
        : getClientId();

      setOauthLoading(true);
      (async () => {
        try {
          const tokens = await exchangeOAuthCode(code, clientId);
          saveRemoteTokens(tokens);
          // Link bridge — get whitelist username
          const username = await linkRemoteBridge(tokens.access_token);
          setConnection(null, username); // no local IP needed in remote mode
          await refresh();
          startPolling();
        } catch (e) {
          setOauthError(e.message || 'Verbinding mislukt na Hue login');
        } finally {
          setOauthLoading(false);
        }
      })();
      return;
    }

    // Normal startup: restore existing connection
    if (isConfigured() && !connected) {
      if (isRemoteMode()) {
        const { username } = getStoredConfig();
        setConnection(null, username);
        refresh().then(() => startPolling());
      } else {
        const { ip, username } = getStoredConfig();
        if (ip && username) {
          setConnection(ip, username);
          refresh().then(() => startPolling());
        }
      }
    }
  }, []);

  if (oauthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-white text-sm">Verbinding maken met Hue...</p>
      </div>
    );
  }

  if (oauthError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-red-400 text-center text-sm">{oauthError}</p>
        <button
          onClick={() => setOauthError(null)}
          className="px-6 py-3 bg-amber-400 text-slate-900 font-semibold rounded-xl"
        >
          Opnieuw proberen
        </button>
      </div>
    );
  }

  if (!isConfigured() && !connected) {
    return <SetupWizard />;
  }

  return <MainApp />;
}
