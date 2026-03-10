/**
 * RoomEditor – create or edit a floor plan room
 * - Upload a photo to use as background
 * - Draw room walls by tapping on the SVG canvas
 * - Place Hue lights on the floor plan
 */
import { useState, useRef, useCallback } from 'react';
import { useHueStore } from '../store/useHueStore';

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function RoomEditor({ room, onSave, onCancel }) {
  const { lights } = useHueStore();
  const lightList = Object.values(lights);

  const [name, setName] = useState(room?.name || 'Nieuwe kamer');
  const [backgroundImage, setBackgroundImage] = useState(room?.backgroundImage || null);
  const [walls, setWalls] = useState(room?.walls || []);
  const [lightPlacements, setLightPlacements] = useState(room?.lightPlacements || []);
  const [mode, setMode] = useState('view'); // 'walls' | 'lights' | 'view'
  const [pendingLight, setPendingLight] = useState(null);
  const svgRef = useRef(null);

  const W = 800, H = 600;

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setBackgroundImage(ev.target.result);
    reader.readAsDataURL(file);
  };

  const getSvgPoint = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.touches ? e.touches[0].clientX : e.clientX;
    pt.y = e.touches ? e.touches[0].clientY : e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: svgP.x, y: svgP.y };
  }, []);

  const handleSvgClick = (e) => {
    const pt = getSvgPoint(e);
    if (!pt) return;

    if (mode === 'walls') {
      setWalls(prev => [...prev, pt]);
    } else if (mode === 'lights' && pendingLight) {
      setLightPlacements(prev => {
        // Remove existing placement for same light
        const filtered = prev.filter(lp => lp.lightId !== pendingLight);
        return [...filtered, { lightId: pendingLight, x: pt.x, y: pt.y }];
      });
      setPendingLight(null);
    }
  };

  const handleSave = () => {
    onSave({
      id: room?.id || generateId(),
      name,
      backgroundImage,
      walls,
      lightPlacements,
      width: W,
      height: H,
    });
  };

  const removePlacement = (lightId) => {
    setLightPlacements(prev => prev.filter(lp => lp.lightId !== lightId));
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 safe-top">
        <button onClick={onCancel} className="text-slate-400 text-sm">Annuleren</button>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="flex-1 bg-transparent text-center text-white font-semibold text-base outline-none"
          placeholder="Kamernaam"
        />
        <button
          onClick={handleSave}
          className="text-amber-400 text-sm font-semibold"
        >
          Opslaan
        </button>
      </div>

      {/* Tool bar */}
      <div className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar">
        {/* Upload image */}
        <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 rounded-xl text-xs text-slate-300 cursor-pointer whitespace-nowrap border border-slate-700">
          <span>📷</span> Foto
          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </label>

        <button
          onClick={() => setMode(mode === 'walls' ? 'view' : 'walls')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs whitespace-nowrap border transition-all ${
            mode === 'walls'
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-slate-800 border-slate-700 text-slate-300'
          }`}
        >
          <span>✏️</span> Muren tekenen
        </button>

        {walls.length > 0 && (
          <button
            onClick={() => setWalls(prev => prev.slice(0, -1))}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 rounded-xl text-xs text-slate-300 border border-slate-700"
          >
            ↩ Ongedaan
          </button>
        )}

        {walls.length > 0 && (
          <button
            onClick={() => setWalls([])}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-900/50 rounded-xl text-xs text-red-400 border border-red-800"
          >
            🗑 Wissen
          </button>
        )}
      </div>

      {/* SVG canvas */}
      <div className="flex-1 relative overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-full"
          style={{ cursor: mode === 'walls' ? 'crosshair' : mode === 'lights' && pendingLight ? 'crosshair' : 'default' }}
          onClick={handleSvgClick}
        >
          {backgroundImage && (
            <image href={backgroundImage} x={0} y={0} width={W} height={H}
              preserveAspectRatio="xMidYMid meet" opacity={0.4} />
          )}

          {/* Grid */}
          <defs>
            <pattern id="grid" width={40} height={40} patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth={0.5} />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#grid)" />

          {/* Walls */}
          {walls.length > 1 && (
            <polyline
              points={walls.map(p => `${p.x},${p.y}`).join(' ')}
              fill="rgba(148,163,184,0.1)"
              stroke="#475569"
              strokeWidth={3}
              strokeLinejoin="round"
            />
          )}
          {walls.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={5}
              fill={i === 0 ? '#3b82f6' : '#64748b'}
              stroke="#0f172a" strokeWidth={1.5} />
          ))}

          {/* Light placements */}
          {lightPlacements.map(lp => {
            const light = lights[lp.lightId];
            return (
              <g key={lp.lightId} transform={`translate(${lp.x},${lp.y})`}>
                <circle r={16} fill="#fbbf24" opacity={0.8} />
                <text y={5} textAnchor="middle" fontSize={16}>💡</text>
                <text y={30} textAnchor="middle" fontSize={9} fill="#f1f5f9">
                  {light?.name?.slice(0, 10) || lp.lightId}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Mode hint */}
        {mode === 'walls' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-600/90 text-white text-xs px-4 py-2 rounded-full backdrop-blur-sm">
            Tik op de kaart om muren te tekenen
          </div>
        )}
        {mode === 'lights' && pendingLight && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-amber-500/90 text-white text-xs px-4 py-2 rounded-full backdrop-blur-sm">
            Tik op de kaart om <strong>{lights[pendingLight]?.name}</strong> te plaatsen
          </div>
        )}
      </div>

      {/* Light list for placement */}
      <div className="border-t border-slate-800 px-4 py-3">
        <p className="text-xs text-slate-500 mb-2 font-medium">Lampen plaatsen</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {lightList.map(light => {
            const placed = lightPlacements.find(lp => lp.lightId === light.id);
            const isPending = pendingLight === light.id;
            return (
              <button
                key={light.id}
                onClick={() => {
                  setMode('lights');
                  setPendingLight(isPending ? null : light.id);
                }}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border text-xs whitespace-nowrap transition-all ${
                  isPending
                    ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                    : placed
                    ? 'border-green-600/50 bg-green-900/20 text-green-400'
                    : 'border-slate-700 bg-slate-800 text-slate-400'
                }`}
              >
                <span>{placed ? '✅' : '💡'}</span>
                <span>{light.name.slice(0, 10)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
