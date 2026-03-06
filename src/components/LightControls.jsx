import { useState, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';
import { useHueStore } from '../store/useHueStore';
import { getLightColor, hexToXY } from '../services/hue';

const TEMP_PRESETS = [
  { label: 'Kaarslicht', ct: 500, color: '#ff8c42' },
  { label: 'Warm', ct: 370, color: '#ffcc77' },
  { label: 'Neutraal', ct: 280, color: '#fff5e0' },
  { label: 'Daglicht', ct: 200, color: '#e8f0ff' },
  { label: 'Koel', ct: 153, color: '#cce4ff' },
];

const SCENE_COLORS = [
  '#ff4444', '#ff8c42', '#ffd700', '#90ee90',
  '#42a5f5', '#7c4dff', '#ff69b4', '#ffffff',
];

export default function LightControls({ lightId, onClose }) {
  const { lights, toggleLight, setLightBrightness, setLightColor, setLightColorTemp } = useHueStore();
  const light = lights[lightId];
  const [tab, setTab] = useState('brightness');
  const [color, setColor] = useState(getLightColor(light));
  const [colorDebounce, setColorDebounce] = useState(null);

  useEffect(() => {
    if (light) setColor(getLightColor(light));
  }, [lightId]);

  if (!light) return null;

  const handleBrightness = (e) => {
    const val = parseInt(e.target.value);
    setLightBrightness(lightId, val);
  };

  const handleColorChange = (hex) => {
    setColor(hex);
    clearTimeout(colorDebounce);
    const t = setTimeout(() => {
      const xy = hexToXY(hex);
      setLightColor(lightId, xy);
    }, 150);
    setColorDebounce(t);
  };

  const handleTempPreset = (ct) => {
    setLightColorTemp(lightId, ct);
  };

  const displayColor = getLightColor(light);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center safe-bottom"
      onClick={(e) => e.target === e.currentTarget && onClose()}>

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-slate-900 rounded-t-3xl border-t border-slate-700/50 sheet-enter overflow-hidden">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            {/* Color dot */}
            <div
              className="w-8 h-8 rounded-full border-2 border-slate-600 transition-spring"
              style={{ background: light.on ? displayColor : '#1e293b' }}
            />
            <div>
              <p className="font-semibold text-sm text-white">{light.name}</p>
              <p className="text-xs text-slate-400">{light.reachable ? (light.on ? 'Aan' : 'Uit') : 'Niet bereikbaar'}</p>
            </div>
          </div>

          {/* Power toggle */}
          <button
            onClick={() => toggleLight(lightId)}
            className={`w-14 h-7 rounded-full transition-all duration-300 relative ${
              light.on ? 'bg-amber-400' : 'bg-slate-700'
            }`}
          >
            <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${
              light.on ? 'left-7' : 'left-0.5'
            }`} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mx-5 mb-3 bg-slate-800 rounded-xl p-1">
          {['brightness', 'color', 'white'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                tab === t
                  ? 'bg-slate-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'brightness' ? 'Helderheid' : t === 'color' ? 'Kleur' : 'Wit'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-5 pb-6">
          {tab === 'brightness' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-slate-400 mb-1">
                <span>Helderheid</span>
                <span className="text-white font-medium">{Math.round((light.bri / 254) * 100)}%</span>
              </div>
              <div className="relative h-10 flex items-center">
                <div
                  className="absolute inset-y-3 left-0 right-0 rounded-full"
                  style={{
                    background: `linear-gradient(to right, #1e293b, ${light.on ? displayColor : '#ffd700'})`,
                  }}
                />
                <input
                  type="range"
                  min={1}
                  max={254}
                  value={light.bri}
                  onChange={handleBrightness}
                  className="relative w-full h-10 appearance-none bg-transparent cursor-pointer"
                  style={{ WebkitAppearance: 'none' }}
                />
              </div>

              {/* Quick presets */}
              <div className="flex gap-2 mt-2">
                {[25, 50, 75, 100].map(pct => (
                  <button
                    key={pct}
                    onClick={() => setLightBrightness(lightId, Math.round(pct / 100 * 254))}
                    className={`flex-1 py-2 text-xs rounded-lg border transition-all ${
                      Math.round((light.bri / 254) * 100) === pct
                        ? 'border-amber-400 text-amber-400 bg-amber-400/10'
                        : 'border-slate-700 text-slate-400 bg-slate-800 hover:border-slate-500'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'color' && (
            <div className="space-y-4">
              <HexColorPicker
                color={color}
                onChange={handleColorChange}
                style={{ width: '100%', height: '180px', borderRadius: '12px' }}
              />
              {/* Quick colors */}
              <div className="flex gap-2 flex-wrap mt-2">
                {SCENE_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => handleColorChange(c)}
                    className="w-9 h-9 rounded-full border-2 transition-spring"
                    style={{
                      background: c,
                      borderColor: color.toLowerCase() === c.toLowerCase() ? 'white' : 'transparent',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {tab === 'white' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 mb-2">Kleurtemperatuur</p>
              {TEMP_PRESETS.map(p => (
                <button
                  key={p.ct}
                  onClick={() => handleTempPreset(p.ct)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                    light.ct && Math.abs(light.ct - p.ct) < 30
                      ? 'border-amber-400 bg-amber-400/10'
                      : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full border border-slate-600" style={{ background: p.color }} />
                  <span className="text-sm text-slate-200">{p.label}</span>
                  <span className="ml-auto text-xs text-slate-500">{Math.round(1000000 / p.ct)}K</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
