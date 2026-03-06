import { useHueStore } from '../store/useHueStore';

const QUICK_SCENES = [
  { id: 'relax',     name: 'Relax',     emoji: '🌅', ct: 447, bri: 144 },
  { id: 'concentrate', name: 'Focus',   emoji: '💡', ct: 233, bri: 219 },
  { id: 'read',      name: 'Lezen',     emoji: '📖', ct: 346, bri: 220 },
  { id: 'nightlight', name: 'Nachtlamp', emoji: '🌙', ct: 500, bri: 20 },
  { id: 'energize',  name: 'Energie',   emoji: '⚡', ct: 156, bri: 254 },
  { id: 'dimmed',    name: 'Gedimd',    emoji: '🕯️',  ct: 447, bri: 80 },
];

export default function ScenePanel({ groupId, onClose }) {
  const { scenes, activateScene, lights, setLightBrightness, setLightColorTemp, groups } = useHueStore();
  const group = groups[groupId];
  const groupScenes = scenes.filter(s => s.group === groupId);

  const applyQuickScene = (preset) => {
    const targetLights = group?.lights || Object.keys(lights);
    targetLights.forEach(lid => {
      setLightBrightness(lid, preset.bri);
      setLightColorTemp(lid, preset.ct);
    });
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center safe-bottom"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-slate-900 rounded-t-3xl border-t border-slate-700/50 sheet-enter">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-600" />
        </div>

        <div className="px-5 py-3">
          <h2 className="text-base font-semibold text-white">Scenes</h2>
          <p className="text-xs text-slate-400 mt-0.5">{group?.name || 'Alle lampen'}</p>
        </div>

        {/* Quick scenes grid */}
        <div className="grid grid-cols-3 gap-3 px-5 pb-4">
          {QUICK_SCENES.map(s => (
            <button
              key={s.id}
              onClick={() => applyQuickScene(s)}
              className="flex flex-col items-center gap-2 p-4 bg-slate-800 rounded-2xl border border-slate-700 hover:border-slate-500 active:scale-95 transition-all"
            >
              <span className="text-2xl">{s.emoji}</span>
              <span className="text-xs text-slate-300 font-medium">{s.name}</span>
            </button>
          ))}
        </div>

        {/* Bridge scenes if any */}
        {groupScenes.length > 0 && (
          <div className="px-5 pb-6">
            <p className="text-xs text-slate-500 font-medium mb-3">Hue Scenes</p>
            <div className="space-y-2">
              {groupScenes.slice(0, 8).map(s => (
                <button
                  key={s.id}
                  onClick={() => { activateScene(s.id, groupId); onClose?.(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 rounded-xl border border-slate-700 hover:border-amber-500/50 active:scale-98 text-left transition-all"
                >
                  <span className="text-amber-400">✨</span>
                  <span className="text-sm text-slate-200">{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
