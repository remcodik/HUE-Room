/**
 * ShortcutsGuide – genereer iPhone Opdrachten (Shortcuts) voor Hue
 * Leest bridge-IP en username uit localStorage, toont kant-en-klare
 * URL-commando's die de gebruiker in de Opdrachten-app kan plakken.
 */
import { useState, useEffect } from 'react';
import { useHueStore } from '../store/useHueStore';

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function CopyRow({ label, url, body }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="bg-slate-900 rounded-2xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-white text-sm font-medium">{label}</p>
        <button
          onClick={copy}
          className={`text-xs px-3 py-1 rounded-full transition-all ${
            copied ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'
          }`}
        >
          {copied ? '✓ Gekopieerd' : '📋 URL'}
        </button>
      </div>
      <code className="text-xs text-amber-300/80 break-all block">{url}</code>
      {body && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-slate-500">Body (JSON):</span>
          <code className="text-xs text-slate-400">{body}</code>
          <button
            onClick={() => navigator.clipboard.writeText(body)}
            className="text-slate-600 hover:text-slate-300 text-xs"
          >📋</button>
        </div>
      )}
    </div>
  );
}

export default function ShortcutsGuide({ onClose }) {
  const { lights, groups } = useHueStore();

  const [ip, setIp] = useState(() => load('hue_bridge_ip') || '192.168.2.1');
  const [username, setUsername] = useState(() => load('hue_username') || '');
  const [showManual, setShowManual] = useState(false);

  const hasCredentials = ip && username;
  const base = `http://${ip}/api/${username}`;

  const groupList = Object.values(groups).filter(g => g.type !== 'Entertainment');
  const lightList = Object.values(lights);

  return (
    <div className="flex flex-col h-full bg-slate-950 safe-top">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
        <button onClick={onClose} className="text-slate-400 text-sm">← Terug</button>
        <span className="flex-1 text-center text-white font-semibold">iPhone Opdrachten</span>
        <span className="w-14" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {/* Credentials banner */}
        <div className={`rounded-2xl p-4 border ${hasCredentials
          ? 'bg-green-900/20 border-green-700/40'
          : 'bg-orange-900/20 border-orange-700/40'}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={`text-sm font-semibold ${hasCredentials ? 'text-green-400' : 'text-orange-400'}`}>
                {hasCredentials ? '✓ Bridge-gegevens gevonden' : '⚠️ Bridge-gegevens ontbreken'}
              </p>
              {hasCredentials ? (
                <p className="text-xs text-slate-400 mt-0.5">
                  Bridge: <code className="text-amber-300">{ip}</code> ·{' '}
                  Gebruikersnaam: <code className="text-amber-300">{username.slice(0, 8)}…</code>
                </p>
              ) : (
                <p className="text-xs text-slate-400 mt-0.5">
                  Koppel eerst de bridge via Instellingen, of vul hieronder handmatig in.
                </p>
              )}
            </div>
            <button
              onClick={() => setShowManual(v => !v)}
              className="text-xs text-slate-500 underline flex-shrink-0"
            >
              {showManual ? 'Verbergen' : 'Bewerken'}
            </button>
          </div>

          {showManual && (
            <div className="mt-3 space-y-2">
              <div>
                <label className="text-xs text-slate-400">Bridge IP</label>
                <input value={ip} onChange={e => setIp(e.target.value)}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-mono outline-none focus:border-amber-400"
                  placeholder="192.168.2.1" />
              </div>
              <div>
                <label className="text-xs text-slate-400">API Gebruikersnaam</label>
                <input value={username} onChange={e => setUsername(e.target.value)}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-mono outline-none focus:border-amber-400"
                  placeholder="abc123def456..." />
                <p className="text-xs text-slate-500 mt-1">
                  Te vinden in de Hue app: Instellingen → Mijn Hue-systeem → bridge-knop → Software-info
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Hoe te gebruiken */}
        <div className="bg-slate-800/50 rounded-2xl p-4 space-y-2">
          <p className="text-white font-semibold text-sm">Hoe gebruik je dit?</p>
          <ol className="space-y-1.5 text-xs text-slate-400 list-decimal list-inside leading-relaxed">
            <li>Open de <strong className="text-white">Opdrachten-app</strong> op je iPhone</li>
            <li>Maak een nieuwe opdracht → tik <strong className="text-white">+</strong></li>
            <li>Zoek op <strong className="text-white">"URL-inhoud ophalen"</strong></li>
            <li>Plak de URL hieronder, stel methode in op <strong className="text-white">PUT</strong></li>
            <li>Voeg <strong className="text-white">Verzoektekst</strong> toe → kies JSON → plak de body</li>
            <li>Optioneel: voeg toe aan beginscherm of Siri</li>
          </ol>
        </div>

        {!hasCredentials && (
          <div className="bg-slate-800/30 rounded-2xl p-4 text-center">
            <p className="text-slate-500 text-sm">Vul bridge IP en gebruikersnaam in om commando's te genereren.</p>
          </div>
        )}

        {hasCredentials && (
          <>
            {/* Alle lampen */}
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Alle lampen</p>
              <div className="space-y-2">
                <CopyRow
                  label="🌑 Alle lampen UIT"
                  url={`${base}/groups/0/action`}
                  body='{"on": false}'
                />
                <CopyRow
                  label="💡 Alle lampen AAN"
                  url={`${base}/groups/0/action`}
                  body='{"on": true}'
                />
                <CopyRow
                  label="🌙 Nacht (warm, dim)"
                  url={`${base}/groups/0/action`}
                  body='{"on": true, "ct": 500, "bri": 40}'
                />
                <CopyRow
                  label="☀️ Dag (koel, helder)"
                  url={`${base}/groups/0/action`}
                  body='{"on": true, "ct": 233, "bri": 220}'
                />
              </div>
            </div>

            {/* Per groep/kamer */}
            {groupList.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Per kamer / groep</p>
                <div className="space-y-2">
                  {groupList.map(g => (
                    <CopyRow
                      key={g.id}
                      label={`${g.on ? '💡' : '○'} ${g.name}`}
                      url={`${base}/groups/${g.id}/action`}
                      body={`{"on": ${g.on ? 'false' : 'true'}}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Per lamp */}
            {lightList.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Per lamp</p>
                <div className="space-y-2">
                  {lightList.map(l => (
                    <CopyRow
                      key={l.id}
                      label={`${l.on ? '💡' : '○'} ${l.name}`}
                      url={`${base}/lights/${l.id}/state`}
                      body={`{"on": ${l.on ? 'false' : 'true'}}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Voorbeeld volledige Shortcut stap */}
            <div className="bg-slate-800/30 rounded-2xl border border-slate-700/30 p-4 space-y-3">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Voorbeeld: "Alles uit" Siri-opdracht</p>
              {[
                { n: '1', text: 'Opdracht → + → Zoek "URL-inhoud ophalen"' },
                { n: '2', text: `URL: ${base}/groups/0/action` },
                { n: '3', text: 'Methode: PUT' },
                { n: '4', text: 'Verzoektekst: JSON → Sleutel "on" → waarde false' },
                { n: '5', text: 'Opdrachtnaam: "Hue uit" → voeg toe aan Siri' },
                { n: '6', text: 'Zeg: "Hey Siri, Hue uit"' },
              ].map(({ n, text }) => (
                <div key={n} className="flex gap-3 items-start">
                  <div className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{n}</div>
                  <p className="text-xs text-slate-400 leading-relaxed font-mono">{text}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
