import { useState, useEffect } from 'react';
import {
  discoverBridges, pairWithBridge, fetchLights, fetchGroups, fetchScenes,
  getOAuthUrl, saveClientId, getClientId, getOAuthRedirectUri,
} from '../services/hue';
import { useHueStore } from '../store/useHueStore';

const IS_HTTPS = window.location.protocol === 'https:';

function StepDot({ num, active, done }) {
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
      done ? 'bg-green-500 text-white scale-90'
           : active ? 'bg-amber-400 text-slate-900 scale-110 shadow-lg shadow-amber-400/40'
           : 'bg-slate-800 text-slate-600'
    }`}>
      {done ? '✓' : num}
    </div>
  );
}

export default function SetupWizard() {
  const [mode, setMode] = useState(IS_HTTPS ? 'remote' : 'local');
  const [step, setStep] = useState('discover');
  const [bridges, setBridges] = useState([]);
  const [selectedBridge, setSelectedBridge] = useState(null);
  const [manualIp, setManualIp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pairing, setPairing] = useState(false);
  const [pairingSeconds, setPairingSeconds] = useState(0);
  const [clientId, setClientId] = useState(getClientId() || '');
  const [copied, setCopied] = useState(false);

  const { setConnection, setLights, setGroups, setScenes, startPolling } = useHueStore();

  useEffect(() => {
    if (mode === 'local') discover();
  }, [mode]);

  // Count up while pairing so user sees progress
  useEffect(() => {
    if (step !== 'press') { setPairingSeconds(0); return; }
    const t = setInterval(() => setPairingSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [step]);

  const discover = async () => {
    setLoading(true);
    setError(null);
    setBridges([]);
    setSelectedBridge(null);
    try {
      const found = await discoverBridges();
      const valid = found.filter(b => b.ip);
      setBridges(valid);
      if (valid.length === 1) setSelectedBridge(valid[0]);
    } catch {
      setError('Zoekopdracht mislukt. Voer het IP-adres handmatig in.');
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
          setError('Knop niet ingedrukt binnen 60 seconden.');
          setStep('discover');
          setPairing(false);
        } else if (e.name === 'TypeError' || e.message?.includes('fetch')) {
          setError(`Bridge niet bereikbaar op ${ip}. Controleer het IP-adres.`);
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

  const handleCopy = () => {
    navigator.clipboard.writeText(getOAuthRedirectUri());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stepIndex = { discover: 0, press: 1, done: 2 }[step];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-5 safe-top safe-bottom overflow-y-auto">

      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-amber-500/25">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z" fill="currentColor" className="text-slate-900"/>
            <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1z" fill="currentColor" className="text-slate-900"/>
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">HUE Room</h1>
        <p className="text-slate-500 text-sm mt-1">Slim licht bedienen</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1.5 mb-6 bg-slate-900 rounded-2xl p-1.5 border border-slate-800 w-full max-w-sm">
        <button
          onClick={() => { setMode('local'); setError(null); setStep('discover'); }}
          className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
            mode === 'local'
              ? 'bg-amber-400 text-slate-900 shadow-lg'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          🏠 Thuis
        </button>
        <button
          onClick={() => { setMode('remote'); setError(null); }}
          className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
            mode === 'remote'
              ? 'bg-amber-400 text-slate-900 shadow-lg'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          🌍 Overal
        </button>
      </div>

      {/* ── HTTPS waarschuwing ── */}
      {mode === 'local' && IS_HTTPS && (
        <div className="w-full max-w-sm mb-5 bg-orange-950/50 border border-orange-600/50 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-orange-400 text-lg mt-0.5">⚠️</span>
            <div>
              <p className="text-orange-300 text-sm font-semibold">Lokale modus werkt niet via HTTPS</p>
              <p className="text-orange-200/70 text-xs mt-1 leading-relaxed">
                De browser blokkeert verbindingen met de bridge. Schakel over naar <strong>Overal</strong> modus of open de app via <code className="bg-orange-900/40 px-1 rounded">http://</code>.
              </p>
            </div>
          </div>
          <button
            onClick={() => { setMode('remote'); setError(null); }}
            className="w-full py-2.5 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            Schakel over naar Overal modus →
          </button>
        </div>
      )}

      {/* ── LOCAL MODE ── */}
      {mode === 'local' && !IS_HTTPS && (
        <div className="w-full max-w-sm space-y-4">

          {/* Progress steps */}
          <div className="flex items-center justify-center gap-3 mb-2">
            {['Zoeken', 'Koppelen', 'Klaar'].map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <StepDot num={i + 1} active={stepIndex === i} done={stepIndex > i} />
                  <span className={`text-xs transition-colors ${
                    stepIndex === i ? 'text-white' : stepIndex > i ? 'text-green-400' : 'text-slate-600'
                  }`}>{label}</span>
                </div>
                {i < 2 && (
                  <div className={`w-8 h-px mb-4 transition-colors ${stepIndex > i ? 'bg-green-500' : 'bg-slate-800'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">

            {/* STEP: discover */}
            {step === 'discover' && (
              <div className="space-y-4">
                <h2 className="text-white font-semibold">Hue Bridge zoeken</h2>
                <p className="text-slate-400 text-sm">Zorg dat je bridge aan staat en op hetzelfde netwerk zit.</p>

                {loading ? (
                  <div className="flex items-center gap-3 py-5 justify-center">
                    <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-slate-400 text-sm">Bridges zoeken...</span>
                  </div>
                ) : bridges.length > 0 ? (
                  <div className="space-y-2">
                    {bridges.map(b => (
                      <button
                        key={b.id}
                        onClick={() => setSelectedBridge(b)}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
                          selectedBridge?.id === b.id
                            ? 'border-amber-400 bg-amber-400/10'
                            : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xl flex-shrink-0">🌉</div>
                        <div className="text-left flex-1">
                          <p className="text-sm text-white font-semibold">Hue Bridge</p>
                          <p className="text-xs text-slate-400 font-mono">{b.ip}</p>
                        </div>
                        {selectedBridge?.id === b.id && (
                          <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-slate-900 text-xs font-bold">✓</div>
                        )}
                      </button>
                    ))}
                    <button onClick={discover} className="w-full text-xs text-slate-500 hover:text-amber-400 py-2 transition-colors">
                      Opnieuw zoeken
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-slate-800/60 rounded-xl p-3 text-xs text-slate-400 leading-relaxed">
                      Geen bridge gevonden. Voer het IP-adres handmatig in (te vinden in de Hue app → Instellingen → Bridge):
                    </div>
                    <input
                      value={manualIp}
                      onChange={e => setManualIp(e.target.value)}
                      placeholder="192.168.1.x"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-amber-400 font-mono transition-colors"
                    />
                    <button onClick={discover} className="text-xs text-amber-400 hover:text-amber-300 underline transition-colors">
                      Nogmaals automatisch zoeken
                    </button>
                  </div>
                )}

                {error && (
                  <div className="bg-red-950/50 border border-red-700/50 rounded-xl p-3">
                    <p className="text-red-400 text-xs">{error}</p>
                  </div>
                )}

                <button
                  onClick={handlePair}
                  disabled={!selectedBridge && !manualIp.trim()}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900 font-bold rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-98 shadow-lg shadow-amber-400/20"
                >
                  Verbinden →
                </button>
              </div>
            )}

            {/* STEP: press button */}
            {step === 'press' && (
              <div className="text-center space-y-5 py-3">
                <div className="relative mx-auto w-28 h-28">
                  <div className="absolute inset-0 rounded-full bg-amber-400/15 animate-ping" />
                  <div className="absolute inset-2 rounded-full bg-amber-400/10 animate-ping" style={{ animationDelay: '0.5s' }} />
                  <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 flex items-center justify-center shadow-2xl shadow-amber-400/30">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="8" fill="rgba(0,0,0,0.3)" />
                      <circle cx="12" cy="12" r="5" fill="rgba(0,0,0,0.5)" />
                    </svg>
                  </div>
                </div>

                <div>
                  <h2 className="text-white font-bold text-lg">Druk op de knop</h2>
                  <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                    Druk nu op de grote ronde knop op de <strong className="text-white">Philips Hue Bridge</strong>.
                  </p>
                </div>

                <div className="bg-slate-800 rounded-xl p-3 text-xs text-slate-400 text-left space-y-1">
                  <p>• Je hebt <strong className="text-white">30 seconden</strong> de tijd</p>
                  <p>• De bridge knippert als je hem indrukt</p>
                </div>

                {/* Timer */}
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-slate-400 text-sm">
                    Wachten... ({pairingSeconds}s)
                  </span>
                </div>

                {error && (
                  <div className="space-y-2">
                    <p className="text-red-400 text-xs">{error}</p>
                    <button
                      onClick={() => { setStep('discover'); setError(null); }}
                      className="text-amber-400 text-sm font-medium underline"
                    >
                      Opnieuw proberen
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STEP: done */}
            {step === 'done' && (
              <div className="text-center space-y-4 py-3">
                <div className="w-20 h-20 rounded-full bg-green-500/15 border-2 border-green-500 flex items-center justify-center mx-auto text-3xl">
                  ✓
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Verbonden!</h2>
                  <p className="text-slate-400 text-sm mt-1">Je Hue Bridge is gekoppeld. De app wordt geladen...</p>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-slate-500 text-xs">Even geduld...</span>
                </div>
              </div>
            )}
          </div>

          <p className="text-slate-700 text-xs text-center">
            Werkt alleen op hetzelfde WiFi-netwerk als de bridge
          </p>
        </div>
      )}

      {/* ── REMOTE MODE ── */}
      {mode === 'remote' && (
        <div className="w-full max-w-sm space-y-3">

          {/* Stap 1 – Callback URL */}
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-900 text-xs font-bold flex items-center justify-center flex-shrink-0">1</div>
              <p className="text-white font-semibold text-sm">Callback URL registreren</p>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Kopieer deze URL en voeg hem toe in jouw Hue developer app op{' '}
              <span className="text-amber-400 font-medium">developers.meethue.com</span> → jouw app → <em>Callback URL</em>:
            </p>
            <div className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2.5 border border-slate-700">
              <code className="text-xs text-amber-300 break-all flex-1 select-all leading-relaxed">{getOAuthRedirectUri()}</code>
              <button
                onClick={handleCopy}
                className={`flex-shrink-0 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                  copied ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {copied ? '✓ Gekopieerd' : 'Kopieer'}
              </button>
            </div>
            <div className="flex items-start gap-2 bg-orange-950/40 border border-orange-700/30 rounded-xl p-2.5">
              <span className="text-orange-400 text-sm flex-shrink-0">⚠️</span>
              <p className="text-orange-200/70 text-xs leading-relaxed">
                De fout <em>"Er is iets misgegaan"</em> bij de Hue login wordt bijna altijd veroorzaakt door een <strong className="text-orange-200">onjuiste Callback URL</strong>.
              </p>
            </div>
          </div>

          {/* Stap 2 – Client ID + Login */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-900 text-xs font-bold flex items-center justify-center flex-shrink-0">2</div>
              <p className="text-white font-semibold text-sm">Client ID invoeren &amp; inloggen</p>
            </div>

            <div className="space-y-2">
              <input
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                placeholder="Client ID van developers.meethue.com"
                className="w-full bg-slate-800 border border-slate-700 focus:border-amber-400 rounded-2xl px-4 py-3.5 text-white text-sm outline-none font-mono transition-colors"
              />
              <p className="text-xs text-slate-600">
                Vind je Client ID op <span className="text-amber-500">developers.meethue.com</span> → Apps → jouw app
              </p>
            </div>

            {error && (
              <div className="bg-red-950/50 border border-red-700/50 rounded-xl p-3">
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            <button
              onClick={handleRemoteLogin}
              disabled={!clientId.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900 font-bold rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-98 shadow-lg shadow-amber-400/20"
            >
              Inloggen met Hue account →
            </button>
          </div>

          {/* Checklist */}
          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-4 space-y-2.5">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Checklist</p>
            {[
              'App type → "Remote API"',
              `Callback URL exact gelijk aan bovenstaande URL`,
              'Client ID hierboven ingevoerd',
              'Vercel: HUE_CLIENT_ID + HUE_CLIENT_SECRET ingesteld',
            ].map((text, i) => (
              <div key={i} className="flex gap-2.5 items-start">
                <div className="w-4 h-4 rounded border border-slate-700 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
