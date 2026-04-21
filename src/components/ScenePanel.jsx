import { useHueStore } from '../store/useHueStore';

const QUICK_SCENES = [
  { id: 'relax',       name: 'Relax',      emoji: '🌅', ct: 447, bri: 144, desc: 'Warm & gedimd' },
  { id: 'concentrate', name: 'Focus',      emoji: '💡', ct: 233, bri: 219, desc: 'Koel & helder' },
  { id: 'read',        name: 'Lezen',      emoji: '📖', ct: 346, bri: 220, desc: 'Prettig licht' },
  { id: 'nightlight',  name: 'Nachtlamp', emoji: '🌙', ct: 500, bri: 20,  desc: 'Zeer zacht' },
  { id: 'energize',    name: 'Energie',   emoji: '⚡', ct: 156, bri: 254, desc: 'Maximaal helder' },
  { id: 'dimmed',      name: 'Gedimd',    emoji: '🕯️', ct: 447, bri: 80,  desc: 'Sfeervol' },
];

export default function ScenePanel({ groupId, onClose }) {
  const { scenes, activateScene, lights, setLightBrightness, setLightColorTemp, groups } = useHueStore();
  const group = groups?.[groupId];
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center safe-bottom"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-slate-900 rounded-t-3xl border-t border-slate-700/50 sheet-enter">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-slate-700" />
        </div>

        <div className="flex items-center justify-between px-5 pt-1 pb-4">
          <div>
            <h2 className="text-base font-bold text-white">Scenes</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {group?.name ? `Voor: ${group.name}` : `Alle ${Object.keys(lights).length} lampen`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Quick scenes grid */}
        <div className="grid grid-cols-3 gap-2.5 px-5 pb-5">
          {QUICK_SCENES.map(s => (
            <button
              key={s.id}
              onClick={() => applyQuickScene(s)}
              className="flex flex-col items-center gap-2 p-4 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 rounded-2xl active:scale-95 transition-all"
            >
              <span className="text-2xl">{s.emoji}</span>
              <div className="text-center">
                <p className="text-xs text-white font-semibold">{s.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Bridge scenes */}
        {groupScenes.length > 0 && (
          <div className="px-5 pb-6">
            <div className="border-t border-slate-800 pt-4 mb-3">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Jouw Hue Scenes</p>
            </div>
            <div className="space-y-2">
              {groupScenes.slice(0, 8).map(s => (
                <button
                  key={s.id}
                  onClick={() => { activateScene(s.id, groupId); onClose?.(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-750 rounded-2xl border border-slate-700 hover:border-amber-500/30 active:scale-99 text-left transition-all"
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-400/10 flex items-center justify-center text-amber-400 flex-shrink-0">
                    ✨
                  </div>
                  <span className="text-sm text-slate-200 font-medium">{s.name}</span>
                  <svg width="14" height="14" viewBox="0 0 14 14" className="ml-auto text-slate-600">
                    <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
