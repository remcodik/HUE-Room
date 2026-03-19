import { useState, useEffect } from 'react';
import {
  discoverBridges, pairWithBridge, fetchLights, fetchGroups, fetchScenes,
  getOAuthUrl, saveClientId, getClientId, getOAuthRedirectUri,
} from '../services/hue';
import { useHueStore } from '../store/useHueStore';

const STEPS = ['discover', 'press', 'done'];
const IS_HTTPS = window.location.protocol === 'https:';

export default function SetupWizard() {
  // 'local' | 'remote'
  const [mode, setMode] = useState(IS_HTTPS ? 'remote' : 'local');

  // Local bridge state
  const [step, setStep] = useState('discover');
  const [bridges, setBridges] = useState([]);
  const [selectedBridge, setSelectedBridge] = useState(null);
  const [manualIp, setManualIp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pairing, setPairing] = useState(false);

  // Remote API state
  const [clientId, setClientId] = useState(getClientId() || '');

  const { setConnection, setLights, setGroups, setScenes, startPolling } = useHueStore();

  useEffect(() => {
    if (mode === 'local') discover();
  }, [mode]);

  const discover = async () => {
    setLoading(true);
    setError(null);
    try {
      const found = await discoverBridges();
      setBridges(found.filter(b => b.ip));
      if (found.length === 1 && found[0].ip) setSelectedBridge(found[0]);
    } catch {
      setError('Zoekopdracht mislukt. Voer IP-adres handmatig in.');
    } finally {
      setLoading(false);
    }
  };

  const handlePair = async () => {
    const ip = selectedBridge?.ip || manualIp.trim();
    if (!ip) { setError('Voer een IP-adres in'); return; }
    setStep('press');
    setError(null);
    let attempts = 0;
    const tryPair = async () => {
      attempts++;
      setPairing(true);
      try {
        const result = await pairWithBridge(ip);
        setConnection(result.ip, result.username);
        const [lights, groups, scenes] = await Promise.all([
          fetchLights(), fetchGroups(), fetchScenes(),
        ]);
        setLights(lights);
        setGroups(groups);
        setScenes(scenes);
        startPolling();
        setStep('done');
      } catch (e) {
        if (e.message === 'PRESS_BUTTON' && attempts < 30) {
          setTimeout(tryPair, 2000);
        } else if (e.message === 'PRESS_BUTTON') {
          setError('Knop niet ingedrukt binnen 60 seconden. Probeer opnieuw.');
          setStep('discover');
          setPairing(false);
        } else if (e.name === 'TypeError' || e.message?.includes('fetch')) {
          setError(`Bridge niet bereikbaar op ${ip}. Controleer het IP-adres en WiFi.`);
          setStep('discover');
          setPairing(false);
        } else {
          setError(e.message || 'Koppeling mislukt');
          setStep('discover');
          setPairing(false);
        }
      }
    };
    tryPair();
  };

  const handleRemoteLogin = () => {
    if (!clientId.trim()) { setError('Voer je Client ID in'); return; }
    saveClientId(clientId.trim());
    window.location.href = getOAuthUrl(clientId.trim());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center px-6 safe-top safe-bottom">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/30">
          <span className="text-4xl">💡</span>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">HUE Room</h1>
        <p className="text-slate-400 text-sm mt-1">Plattegrond lichtbediening</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-6 bg-slate-800/60 rounded-2xl p-1.5">
        <button
          onClick={() => { setMode('local'); setError(null); }}
          className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
            mode === 'local'
              ? 'bg-amber-400 text-slate-900'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          🏠 Thuis (lokaal)
        </button>
        <button
          onClick={() => { setMode('remote'); setError(null); }}
          className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
            mode === 'remote'
              ? 'bg-amber-400 text-slate-900'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          🌍 Overal (remote)
        </button>
      </div>

      {/* ── HTTPS waarschuwing (altijd zichtbaar in local mode) ── */}
      {mode === 'local' && IS_HTTPS && (
        <div className="w-full max-w-sm mb-4 bg-orange-500/10 border border-orange-500 rounded-2xl p-4 space-y-3">
          <p className="text-orange-300 text-sm font-semibold">🔒 Lokale modus werkt niet via HTTPS</p>
          <p className="text-orange-200/80 text-xs leading-relaxed">
            Je browser blokkeert verbindingen met de bridge omdat de app via HTTPS wordt geladen.
            Gebruik <strong>Remote modus</strong> of open de app via <code className="bg-orange-900/40 px-1 rounded">http://</code> op je thuisnetwerk.
          </p>
          <button
            onClick={() => { setMode('remote'); setError(null); }}
            className="w-full py-2.5 bg-orange-500 text-white font-semibold rounded-xl text-sm"
          >
            Overschakelen naar Remote modus →
          </button>
        </div>
      )}

      {/* ── LOCAL MODE ── */}
      {mode === 'local' && (
        <>
          {/* Steps */}
          <div className="flex gap-2 mb-8">
            {['Verbinden', 'Koppelen', 'Klaar'].map((label, i) => {
              const stepName = STEPS[i];
              const active = step === stepName;
              const done = STEPS.indexOf(step) > i;
              return (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    done ? 'bg-green-500 text-white' : active ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs ${active ? 'text-white' : 'text-slate-500'}`}>{label}</span>
                  {i < 2 && <span className="text-slate-700 text-xs mx-1">—</span>}
                </div>
              );
            })}
          </div>

          <div className="w-full max-w-sm bg-slate-800/50 backdrop-blur-sm rounded-3xl border border-slate-700/50 p-6">
            {step === 'discover' && (
              <div className="space-y-4">
                <h2 className="text-white font-semibold text-base">Hue Bridge zoeken</h2>
                <p className="text-slate-400 text-sm">Zorg dat uw Hue Bridge verbonden is met hetzelfde netwerk.</p>

                {loading ? (
                  <div className="flex items-center gap-3 py-4">
                    <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-slate-400 text-sm">Zoeken naar bridges...</span>
                  </div>
                ) : bridges.length > 0 ? (
                  <div className="space-y-2">
                    {bridges.map(b => (
                      <button
                        key={b.id}
                        onClick={() => setSelectedBridge(b)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          selectedBridge?.id === b.id
                            ? 'border-amber-400 bg-amber-400/10'
                            : 'border-slate-700 bg-slate-800'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-lg">🌉</div>
                        <div className="text-left">
                          <p className="text-sm text-white font-medium">Hue Bridge</p>
                          <p className="text-xs text-slate-400">{b.ip}</p>
                        </div>
                        {selectedBridge?.id === b.id && <span className="ml-auto text-amber-400">✓</span>}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Geen bridge gevonden. Handmatig IP:</p>
                    <input
                      value={manualIp}
                      onChange={e => setManualIp(e.target.value)}
                      placeholder="192.168.1.x"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-amber-400"
                    />
                    <button onClick={discover} className="mt-2 text-xs text-amber-400 underline">
                      Opnieuw zoeken
                    </button>
                  </div>
                )}

                {error && <p className="text-red-400 text-xs">{error}</p>}

                <button
                  onClick={handlePair}
                  disabled={!selectedBridge && !manualIp.trim()}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900 font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed active:scale-98 transition-all"
                >
                  Verbinden →
                </button>
              </div>
            )}

            {step === 'press' && (
              <div className="text-center space-y-4 py-2">
                <div className="relative mx-auto w-24 h-24">
                  <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
                  <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center shadow-lg">
                    <span className="text-4xl">🔘</span>
                  </div>
                </div>
                <h2 className="text-white font-semibold text-lg">Druk op de knop</h2>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Druk nu op de grote ronde knop op uw <strong className="text-white">Philips Hue Bridge</strong>.
                </p>
                {error && (
                  <div>
                    <p className="text-red-400 text-xs">{error}</p>
                    <button onClick={() => setStep('discover')} className="mt-2 text-amber-400 text-xs underline">
                      Probeer opnieuw
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-center gap-2 text-slate-500 text-xs">
                  <div className="w-3 h-3 border border-slate-500 border-t-amber-400 rounded-full animate-spin" />
                  Wachten op koppeling...
                </div>
              </div>
            )}

            {step === 'done' && (
              <div className="text-center space-y-4 py-2">
                <div className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mx-auto text-3xl">
                  ✓
                </div>
                <h2 className="text-white font-semibold text-lg">Verbonden!</h2>
                <p className="text-slate-400 text-sm">Uw Hue Bridge is gekoppeld.</p>
                <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            )}
          </div>

          <p className="text-slate-600 text-xs mt-8 text-center">
            Werkt op hetzelfde WiFi-netwerk als de bridge
          </p>
        </>
      )}

      {/* ── REMOTE MODE ── */}
      {mode === 'remote' && (
        <div className="w-full max-w-sm space-y-4">

          {/* Stap 1 – Callback URL */}
          <div className="bg-slate-800/50 rounded-3xl border border-amber-500/40 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-900 text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
              <p className="text-white font-semibold text-sm">Callback URL registreren</p>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Kopieer deze URL en plak hem <strong className="text-white">exact</strong> in jouw Hue developer app op{' '}
              <span className="text-amber-400">developers.meethue.com</span> → jouw app → <em>Callback URL</em>:
            </p>
            <div className="flex items-center gap-2 bg-slate-900 rounded-xl px-3 py-2.5 border border-amber-500/30">
              <code className="text-xs text-amber-300 break-all flex-1 select-all">{getOAuthRedirectUri()}</code>
              <button
                onClick={() => navigator.clipboard.writeText(getOAuthRedirectUri())}
                className="text-slate-400 hover:text-amber-400 text-lg flex-shrink-0 transition-colors"
                title="Kopieer"
              >📋</button>
            </div>
            <p className="text-orange-300/80 text-xs">
              ⚠️ De fout <em>"Er is iets misgegaan"</em> bij Hue login wordt bijna altijd veroorzaakt door een <strong>onjuiste of ontbrekende Callback URL</strong>.
            </p>
          </div>

          {/* Stap 2 – Client ID invoeren + inloggen */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-3xl border border-slate-700/50 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-900 text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
              <p className="text-white font-semibold text-sm">Client ID invullen &amp; inloggen</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-medium">Client ID</label>
              <input
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                placeholder="Uw Hue developer Client ID"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-amber-400 font-mono"
              />
              <p className="text-xs text-slate-500">
                Te vinden op <span className="text-amber-400">developers.meethue.com</span> → jouw app
              </p>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-3">
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            <button
              onClick={handleRemoteLogin}
              disabled={!clientId.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900 font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed active:scale-98 transition-all"
            >
              Inloggen met Hue account →
            </button>
          </div>

          {/* Checklist */}
          <div className="bg-slate-800/30 rounded-2xl border border-slate-700/30 p-4 space-y-3">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Checklist developers.meethue.com</p>
            {[
              { text: 'App type is ingesteld op "Remote API"' },
              { text: `Callback URL = ${getOAuthRedirectUri()}` },
              { text: 'Client ID gekopieerd en hierboven ingevoerd' },
              { text: 'Vercel env vars: HUE_CLIENT_ID + HUE_CLIENT_SECRET ingesteld' },
            ].map(({ text }, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="text-amber-400 mt-0.5 flex-shrink-0">□</span>
                <p className="text-xs text-slate-400 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
