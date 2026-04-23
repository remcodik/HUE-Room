import { useState, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';
import { useHueStore } from '../store/useHueStore';
import { getLightColor, hexToXY } from '../services/hue';

const TEMP_PRESETS = [
  { label: 'Kaarslicht', ct: 500, kelvin: 2000, color: '#ff8c42', emoji: '🕯️' },
  { label: 'Warm wit',   ct: 370, kelvin: 2700, color: '#ffcc77', emoji: '🌅' },
  { label: 'Neutraal',   ct: 280, kelvin: 3571, color: '#fff5e0', emoji: '☀️' },
  { label: 'Daglicht',   ct: 200, kelvin: 5000, color: '#e8f0ff', emoji: '🌤️' },
  { label: 'Koel wit',   ct: 153, kelvin: 6536, color: '#cce4ff', emoji: '❄️' },
];

const QUICK_COLORS = [
  { hex: '#ff3b30', label: 'Rood' },
  { hex: '#ff9500', label: 'Oranje' },
  { hex: '#ffd700', label: 'Geel' },
  { hex: '#34c759', label: 'Groen' },
  { hex: '#007aff', label: 'Blauw' },
  { hex: '#af52de', label: 'Paars' },
  { hex: '#ff2d55', label: 'Roze' },
  { hex: '#ffffff', label: 'Wit' },
];

const BRIGHTNESS_PRESETS = [
  { pct: 10,  label: '10%' },
  { pct: 25,  label: '25%' },
  { pct: 50,  label: '50%' },
  { pct: 75,  label: '75%' },
  { pct: 100, label: '100%' },
];

export default function LightControls({ lightId, onClose }) {
  const { lights, toggleLight, setLightBrightness, setLightColor, setLightColorTemp, setLightAlert } = useHueStore();
  const light = lights[lightId];
  const [tab, setTab] = useState('brightness');
  const [color, setColor] = useState('#ffffff');
  const [colorDebounce, setColorDebounce] = useState(null);

  useEffect(() => {
    if (light) setColor(getLightColor(light));
  }, [lightId]);

  if (!light) return null;

  const displayColor = getLightColor(light);
  const brightnessPct = Math.round((light.bri / 254) * 100);

  const handleBrightness = (e) => {
    setLightBrightness(lightId, parseInt(e.target.value));
  };

  const handleBrightnessPreset = (pct) => {
    setLightBrightness(lightId, Math.round(pct / 100 * 254));
  };

  const handleColorChange = (hex) => {
    setColor(hex);
    clearTimeout(colorDebounce);
    const t = setTimeout(() => {
      setLightColor(lightId, hexToXY(hex));
    }, 120);
    setColorDebounce(t);
  };

  const handleIdentify = () => {
    setLightAlert(lightId, 'select');
  };

  const TABS = [
    { id: 'brightness', label: 'Helderheid', icon: '☀️' },
    { id: 'color',      label: 'Kleur',      icon: '🎨' },
    { id: 'white',      label: 'Wit',         icon: '💎' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center safe-bottom"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-slate-900 rounded-t-3xl border-t border-slate-700/50 sheet-enter overflow-hidden">

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-slate-700" />
        </div>

        {/* Color preview bar */}
        <div
          className="h-1 mx-5 rounded-full mb-3 transition-all duration-500"
          style={{ background: light.on ? `linear-gradient(to right, transparent, ${displayColor}, transparent)` : '#1e293b' }}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl border-2 border-slate-700 transition-all duration-500 flex items-center justify-center"
              style={{ background: light.on ? displayColor : '#1e293b' }}
            >
              {!light.on && <span className="text-slate-600 text-sm">💡</span>}
            </div>
            <div>
              <p className="font-bold text-white text-base leading-tight">{light.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  !light.reachable ? 'bg-red-500'
                  : light.on ? 'bg-green-400 animate-pulse'
                  : 'bg-slate-600'
                }`} />
                <p className="text-xs text-slate-400">
                  {!light.reachable ? 'Niet bereikbaar' : light.on ? `Aan · ${brightnessPct}%` : 'Uit'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Identify button */}
            <button
              onClick={handleIdentify}
              className="w-9 h-9 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors text-base"
              title="Lamp identificeren (laat knipperen)"
            >
              🔦
            </button>

            {/* Power toggle */}
            <button
              onClick={() => toggleLight(lightId)}
              className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                light.on ? 'bg-amber-400 shadow-lg shadow-amber-400/30' : 'bg-slate-700'
              }`}
            >
              <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${
                light.on ? 'left-7' : 'left-0.5'
              }`} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mx-5 mb-4 bg-slate-800 rounded-2xl p-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                tab === t.id
                  ? 'bg-slate-600 text-white shadow'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-5 pb-7">

          {/* BRIGHTNESS */}
          {tab === 'brightness' && (
            <div className="space-y-5">
              {/* Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Helderheid</span>
                  <span className="text-white font-bold text-sm">{brightnessPct}%</span>
                </div>
                <div className="relative h-12 flex items-center">
                  <div
                    className="absolute inset-y-4 left-0 right-0 rounded-full"
                    style={{ background: `linear-gradient(to right, #0f172a 0%, ${light.on ? displayColor : '#fbbf24'} 100%)` }}
                  />
                  <input
                    type="range"
                    min={1}
                    max={254}
                    value={light.bri || 1}
                    onChange={handleBrightness}
                    className="relative w-full h-12 appearance-none bg-transparent cursor-pointer"
                    style={{ WebkitAppearance: 'none' }}
                  />
                </div>
              </div>

              {/* Preset buttons */}
              <div className="flex gap-2">
                {BRIGHTNESS_PRESETS.map(({ pct, label }) => {
                  const active = Math.abs(brightnessPct - pct) < 4;
                  return (
                    <button
                      key={pct}
                      onClick={() => handleBrightnessPreset(pct)}
                      className={`flex-1 py-2.5 text-xs rounded-xl border font-semibold transition-all ${
                        active
                          ? 'border-amber-400 text-amber-400 bg-amber-400/10'
                          : 'border-slate-700 text-slate-500 bg-slate-800 hover:border-slate-600 hover:text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* COLOR */}
          {tab === 'color' && (
            <div className="space-y-4">
              <HexColorPicker
                color={color}
                onChange={handleColorChange}
                style={{ width: '100%', height: '180px', borderRadius: '16px' }}
              />
              <div className="flex gap-2 flex-wrap">
                {QUICK_COLORS.map(({ hex, label }) => (
                  <button
                    key={hex}
                    onClick={() => handleColorChange(hex)}
                    className={`w-10 h-10 rounded-full border-2 transition-all active:scale-90 shadow-sm ${
                      color.toLowerCase() === hex.toLowerCase()
                        ? 'border-white scale-110 shadow-lg'
                        : 'border-transparent hover:border-slate-400'
                    }`}
                    style={{ background: hex }}
                    title={label}
                  />
                ))}
              </div>
            </div>
          )}

          {/* WHITE TEMP */}
          {tab === 'white' && (
            <div className="space-y-2">
              {TEMP_PRESETS.map(p => {
                const active = light.ct && Math.abs(light.ct - p.ct) < 25;
                return (
                  <button
                    key={p.ct}
                    onClick={() => setLightColorTemp(lightId, p.ct)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                      active
                        ? 'border-amber-400 bg-amber-400/08 shadow-sm'
                        : 'border-slate-800 bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-lg">{p.emoji}</span>
                    <div
                      className="w-5 h-5 rounded-full border border-slate-600 flex-shrink-0"
                      style={{ background: p.color }}
                    />
                    <span className={`text-sm font-medium ${active ? 'text-white' : 'text-slate-300'}`}>
                      {p.label}
                    </span>
                    <span className="ml-auto text-xs text-slate-500">{p.kelvin.toLocaleString()}K</span>
                    {active && <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
