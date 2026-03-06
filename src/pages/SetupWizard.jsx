import { useState, useEffect } from 'react';
import { discoverBridges, pairWithBridge, fetchLights, fetchGroups, fetchScenes } from '../services/hue';
import { useHueStore } from '../store/useHueStore';

const STEPS = ['discover', 'press', 'done'];

export default function SetupWizard() {
  const [step, setStep] = useState('discover');
  const [bridges, setBridges] = useState([]);
  const [selectedBridge, setSelectedBridge] = useState(null);
  const [manualIp, setManualIp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pairing, setPairing] = useState(false);

  const { setConnection, setLights, setGroups, setScenes, startPolling } = useHueStore();

  useEffect(() => {
    discover();
  }, []);

  const discover = async () => {
    setLoading(true);
    setError(null);
    try {
      const found = await discoverBridges();
      setBridges(found.filter(b => b.ip));
      if (found.length === 1 && found[0].ip) {
        setSelectedBridge(found[0]);
      }
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

    // Poll for button press
    let attempts = 0;
    const maxAttempts = 30;

    const tryPair = async () => {
      attempts++;
      setPairing(true);
      try {
        const result = await pairWithBridge(ip);
        setConnection(result.ip, result.username);

        // Load initial data
        const [lights, groups, scenes] = await Promise.all([
          fetchLights(), fetchGroups(), fetchScenes(),
        ]);
        setLights(lights);
        setGroups(groups);
        setScenes(scenes);
        startPolling();
        setStep('done');
      } catch (e) {
        if (e.message === 'PRESS_BUTTON' && attempts < maxAttempts) {
          setTimeout(tryPair, 2000);
        } else {
          setError(e.message || 'Koppeling mislukt');
          setStep('discover');
          setPairing(false);
        }
      }
    };

    tryPair();
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

      {/* Content card */}
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
                <button
                  onClick={discover}
                  className="mt-2 text-xs text-amber-400 underline"
                >
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
              Druk nu op de grote ronde knop op uw <strong className="text-white">Philips Hue Bridge</strong> om de koppeling toe te staan.
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
            <p className="text-slate-400 text-sm">Uw Hue Bridge is gekoppeld. U kunt nu uw plattegrond instellen.</p>
            <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-slate-600 text-xs mt-8 text-center">
        Werkt op hetzelfde WiFi-netwerk als de bridge
      </p>
    </div>
  );
}
