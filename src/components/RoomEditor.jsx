/**
 * RoomEditor – create or edit a floor plan room
 */
import { useState, useRef, useCallback } from 'react';
import { useHueStore } from '../store/useHueStore';
import { ROOM_TEMPLATES } from '../data/roomTemplates';

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

const TOOLS = [
  { id: 'view',   icon: '👆', label: 'Bekijken' },
  { id: 'walls',  icon: '✏️', label: 'Muren' },
  { id: 'lights', icon: '💡', label: 'Lampen' },
];

export default function RoomEditor({ room, onSave, onCancel }) {
  const { lights } = useHueStore();
  const lightList = Object.values(lights);

  const [name, setName] = useState(room?.name || 'Nieuwe kamer');
  const [backgroundImage, setBackgroundImage] = useState(room?.backgroundImage || null);
  const [walls, setWalls] = useState(room?.walls || []);
  const [furniture, setFurniture] = useState(room?.furniture || []);
  const [lightPlacements, setLightPlacements] = useState(room?.lightPlacements || []);
  const [tool, setTool] = useState('view');
  const [pendingLight, setPendingLight] = useState(null);
  const [showTemplates, setShowTemplates] = useState(!room);
  const [wallClosed, setWallClosed] = useState(walls.length > 1 && walls[0]?.x === walls[walls.length - 1]?.x);
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
    const src = e.touches ? e.touches[0] : e;
    pt.x = src.clientX;
    pt.y = src.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }, []);

  const handleSvgClick = (e) => {
    if (e.target.closest('[data-no-click]')) return;
    const pt = getSvgPoint(e);
    if (!pt) return;

    if (tool === 'walls' && !wallClosed) {
      // Snap to first point if close enough to close wall
      if (walls.length > 2) {
        const first = walls[0];
        const dist = Math.hypot(pt.x - first.x, pt.y - first.y);
        if (dist < 25) {
          setWalls(prev => [...prev, { x: first.x, y: first.y }]);
          setWallClosed(true);
          setTool('view');
          return;
        }
      }
      setWalls(prev => [...prev, { x: pt.x, y: pt.y }]);
    } else if (tool === 'lights' && pendingLight) {
      setLightPlacements(prev => {
        const filtered = prev.filter(lp => lp.lightId !== pendingLight);
        return [...filtered, { lightId: pendingLight, x: pt.x, y: pt.y }];
      });
      // Move to next unplaced light automatically
      const placedIds = [...lightPlacements.filter(lp => lp.lightId !== pendingLight).map(l => l.lightId), pendingLight];
      const nextLight = lightList.find(l => !placedIds.includes(l.id));
      setPendingLight(nextLight?.id || null);
    }
  };

  const undoWall = () => {
    if (wallClosed) {
      setWalls(prev => prev.slice(0, -1));
      setWallClosed(false);
    } else {
      setWalls(prev => prev.slice(0, -1));
    }
  };

  const closeWall = () => {
    if (walls.length < 3) return;
    setWalls(prev => [...prev, { x: prev[0].x, y: prev[0].y }]);
    setWallClosed(true);
    setTool('view');
  };

  const clearWalls = () => {
    setWalls([]);
    setWallClosed(false);
  };

  const applyTemplate = (tpl) => {
    setName(tpl.name);
    setWalls(tpl.walls);
    setFurniture(tpl.furniture || []);
    setLightPlacements([]);
    setWallClosed(true);
    setShowTemplates(false);
  };

  const handleSave = () => {
    onSave({
      id: room?.id || generateId(),
      name,
      backgroundImage,
      walls,
      furniture,
      lightPlacements,
      width: W,
      height: H,
    });
  };

  const removePlacement = (lightId) => {
    setLightPlacements(prev => prev.filter(lp => lp.lightId !== lightId));
  };

  const selectLight = (lightId) => {
    if (tool !== 'lights') setTool('lights');
    setPendingLight(pendingLight === lightId ? null : lightId);
  };

  // ── Template picker ──────────────────────────────────────────────────
  if (showTemplates) {
    return (
      <div className="flex flex-col h-full bg-slate-950">
        <div className="flex items-center px-4 py-3 border-b border-slate-800 safe-top">
          <button onClick={onCancel} className="text-slate-400 text-sm w-20">Annuleren</button>
          <span className="flex-1 text-center text-white font-semibold">Kies een template</span>
          <button onClick={() => setShowTemplates(false)} className="text-amber-400 text-sm w-20 text-right">Overslaan</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          <p className="text-slate-400 text-sm text-center">
            Begin met een kant-en-klare plattegrond of start leeg.
          </p>

          {ROOM_TEMPLATES.map(tpl => (
            <button
              key={tpl.id}
              onClick={() => applyTemplate(tpl)}
              className="w-full bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 text-left transition-all active:scale-99"
            >
              {/* Mini preview */}
              <svg viewBox={`0 0 ${tpl.width} ${tpl.height}`} className="w-full h-36 mb-3 rounded-xl bg-slate-800">
                <defs>
                  <pattern id={`grid-${tpl.id}`} width={40} height={40} patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth={0.5} />
                  </pattern>
                </defs>
                <rect width={tpl.width} height={tpl.height} fill={`url(#grid-${tpl.id})`} />
                {(tpl.furniture || []).map((f, i) => (
                  <rect key={i} x={f.x} y={f.y} width={f.w} height={f.h}
                    fill={f.style === 'door' ? 'rgba(96,165,250,0.3)' : 'rgba(30,58,95,0.6)'}
                    stroke={f.style === 'door' ? '#60a5fa' : '#334155'} strokeWidth={2} rx={3} />
                ))}
                {tpl.walls.length > 1 && (
                  <polyline
                    points={tpl.walls.map(p => `${p.x},${p.y}`).join(' ')}
                    fill="rgba(148,163,184,0.07)"
                    stroke="#475569" strokeWidth={5} strokeLinejoin="round"
                  />
                )}
                {(tpl.lightSuggestions || []).map(ls => (
                  <g key={ls.key}>
                    <circle cx={ls.x} cy={ls.y} r={22} fill="#fbbf24" opacity={0.15} />
                    <circle cx={ls.x} cy={ls.y} r={12} fill="#fbbf24" opacity={0.6} />
                    <text x={ls.x} y={ls.y + 4} textAnchor="middle" fontSize={12} fill="#000">💡</text>
                  </g>
                ))}
              </svg>

              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white font-semibold">{tpl.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {tpl.lightSuggestions?.length || 0} lamp-posities · {tpl.furniture?.length || 0} meubels
                  </p>
                </div>
                <div className="w-7 h-7 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 text-sm">
                  →
                </div>
              </div>
            </button>
          ))}

          <button
            onClick={() => setShowTemplates(false)}
            className="w-full py-4 bg-slate-900/50 border border-dashed border-slate-700 hover:border-slate-600 rounded-2xl text-slate-400 text-sm transition-colors"
          >
            + Lege kamer
          </button>
        </div>
      </div>
    );
  }

  // ── Main editor ──────────────────────────────────────────────────────
  const placedLightIds = lightPlacements.map(lp => lp.lightId);
  const unplacedLights = lightList.filter(l => !placedLightIds.includes(l.id));
  const placedLights = lightList.filter(l => placedLightIds.includes(l.id));

  return (
    <div className="flex flex-col h-full bg-slate-950">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 safe-top">
        <button onClick={onCancel} className="text-slate-400 text-sm w-20">Annuleren</button>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="flex-1 bg-transparent text-center text-white font-semibold text-base outline-none placeholder:text-slate-600"
          placeholder="Kamernaam"
        />
        <button
          onClick={handleSave}
          className="text-amber-400 text-sm font-bold w-20 text-right"
        >
          Opslaan
        </button>
      </div>

      {/* ── Tool bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800/60 overflow-x-auto no-scrollbar">

        {/* Mode selector */}
        <div className="flex gap-1 bg-slate-900 rounded-xl p-1 border border-slate-800 flex-shrink-0">
          {TOOLS.map(t => (
            <button
              key={t.id}
              onClick={() => {
                setTool(t.id);
                if (t.id !== 'lights') setPendingLight(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tool === t.id
                  ? 'bg-amber-400 text-slate-900'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-slate-800 flex-shrink-0" />

        {/* Wall actions */}
        {tool === 'walls' && walls.length > 2 && !wallClosed && (
          <button
            onClick={closeWall}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-800/50 border border-green-700 rounded-xl text-xs text-green-400 whitespace-nowrap flex-shrink-0"
          >
            ⬡ Sluit muur
          </button>
        )}
        {walls.length > 0 && (
          <button
            onClick={undoWall}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-300 flex-shrink-0"
          >
            ↩ Ongedaan
          </button>
        )}
        {walls.length > 0 && (
          <button
            onClick={clearWalls}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-400 flex-shrink-0"
          >
            🗑 Wis muren
          </button>
        )}

        {/* Other actions */}
        <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-300 cursor-pointer whitespace-nowrap flex-shrink-0">
          📷 Foto
          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </label>

        <button
          onClick={() => setShowTemplates(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-300 whitespace-nowrap flex-shrink-0"
        >
          🏠 Templates
        </button>
      </div>

      {/* ── SVG canvas ── */}
      <div className="flex-1 relative overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-full"
          style={{
            cursor: tool === 'walls' && !wallClosed ? 'crosshair'
                  : tool === 'lights' && pendingLight ? 'crosshair'
                  : 'default',
          }}
          onClick={handleSvgClick}
        >
          {/* Grid */}
          <defs>
            <pattern id="grid-editor" width={40} height={40} patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth={0.5} />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#grid-editor)" />

          {/* Background photo */}
          {backgroundImage && (
            <image href={backgroundImage} x={0} y={0} width={W} height={H}
              preserveAspectRatio="xMidYMid meet" opacity={0.35} />
          )}

          {/* Furniture */}
          {furniture.map((f, i) => (
            <g key={i}>
              <rect
                x={f.x} y={f.y} width={f.w} height={f.h}
                fill={f.style === 'door' ? 'rgba(96,165,250,0.2)' : 'rgba(30,58,95,0.5)'}
                stroke={f.style === 'door' ? '#60a5fa' : '#334155'}
                strokeWidth={1.5} rx={3}
              />
              <text x={f.x + f.w / 2} y={f.y + f.h / 2 + 4}
                textAnchor="middle" fontSize={9} fill="#475569"
                style={{ pointerEvents: 'none' }}>
                {f.label}
              </text>
            </g>
          ))}

          {/* Walls */}
          {walls.length > 1 && (
            <polyline
              points={walls.map(p => `${p.x},${p.y}`).join(' ')}
              fill={wallClosed ? 'rgba(148,163,184,0.08)' : 'none'}
              stroke="#475569"
              strokeWidth={3}
              strokeLinejoin="round"
              strokeDasharray={wallClosed ? 'none' : '8,4'}
            />
          )}
          {/* Wall dots */}
          {walls.map((p, i) => {
            const isFirst = i === 0;
            const isLast = i === walls.length - 1;
            const closeable = tool === 'walls' && isFirst && walls.length > 2 && !wallClosed;
            return (
              <circle
                key={i}
                cx={p.x} cy={p.y} r={isFirst ? 7 : 5}
                fill={isFirst ? '#3b82f6' : isLast && !wallClosed ? '#fbbf24' : '#64748b'}
                stroke="#0f172a" strokeWidth={2}
                data-no-click={closeable ? true : undefined}
                onClick={closeable ? (e) => { e.stopPropagation(); closeWall(); } : undefined}
                style={{ cursor: closeable ? 'pointer' : 'default' }}
              />
            );
          })}

          {/* Light suggestions from templates */}
          {tool === 'lights' && furniture.length === 0 && walls.length === 0 && []}

          {/* Placed lights */}
          {lightPlacements.map(lp => {
            const light = lights[lp.lightId];
            const isPending = pendingLight === lp.lightId;
            return (
              <g key={lp.lightId} transform={`translate(${lp.x},${lp.y})`}>
                <circle r={isPending ? 22 : 18} fill="#fbbf24"
                  opacity={isPending ? 0.9 : 0.75}
                  stroke={isPending ? '#fff' : 'transparent'}
                  strokeWidth={2}
                />
                <text y={6} textAnchor="middle" fontSize={18}>💡</text>
                <text y={32} textAnchor="middle" fontSize={9} fill="#f1f5f9">
                  {light?.name?.slice(0, 12) || lp.lightId}
                </text>
                {/* Remove button */}
                <g
                  transform="translate(14,-14)"
                  data-no-click="true"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); removePlacement(lp.lightId); }}
                >
                  <circle r={8} fill="#ef4444" stroke="#0f172a" strokeWidth={1.5} />
                  <text y={4} textAnchor="middle" fontSize={11} fill="white" fontWeight="bold">×</text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Mode hints */}
        {tool === 'walls' && !wallClosed && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-700/90 text-white text-xs px-4 py-2.5 rounded-full backdrop-blur-sm shadow-lg pointer-events-none">
            {walls.length === 0 ? 'Tik op de plattegrond om te beginnen'
             : walls.length < 3 ? `${walls.length} punt${walls.length > 1 ? 'en' : ''} — tik door om muren te tekenen`
             : 'Tik op het blauwe punt om de muur te sluiten'}
          </div>
        )}
        {tool === 'lights' && pendingLight && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-amber-600/90 text-white text-xs px-4 py-2.5 rounded-full backdrop-blur-sm shadow-lg pointer-events-none">
            Tik op de kaart om <strong>{lights[pendingLight]?.name}</strong> te plaatsen
          </div>
        )}
        {tool === 'lights' && !pendingLight && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-700/90 text-white text-xs px-4 py-2.5 rounded-full backdrop-blur-sm shadow-lg pointer-events-none">
            Selecteer een lamp hieronder om te plaatsen
          </div>
        )}
      </div>

      {/* ── Light list ── */}
      <div className="border-t border-slate-800 bg-slate-950 safe-bottom">
        {/* Placed count */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <p className="text-xs text-slate-500 font-semibold">
            LAMPEN — {placedLights.length}/{lightList.length} geplaatst
          </p>
          {placedLights.length < lightList.length && (
            <button
              onClick={() => {
                setTool('lights');
                const firstUnplaced = unplacedLights[0];
                if (firstUnplaced) setPendingLight(firstUnplaced.id);
              }}
              className="text-xs text-amber-400 font-medium"
            >
              + Lamp toevoegen
            </button>
          )}
        </div>

        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {lightList.length === 0 ? (
            <p className="text-xs text-slate-600 py-2">Geen lampen gevonden in de Hue app</p>
          ) : (
            lightList.map(light => {
              const placed = lightPlacements.find(lp => lp.lightId === light.id);
              const isPending = pendingLight === light.id;
              return (
                <button
                  key={light.id}
                  onClick={() => selectLight(light.id)}
                  className={`flex flex-col items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border text-xs whitespace-nowrap transition-all min-w-[72px] ${
                    isPending
                      ? 'border-amber-400 bg-amber-400/15 text-amber-300 scale-105'
                      : placed
                      ? 'border-green-600/50 bg-green-950/40 text-green-400'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <span className="text-base">{placed ? '✅' : isPending ? '👆' : '💡'}</span>
                  <span className="font-medium text-center leading-tight">{light.name.slice(0, 12)}</span>
                  {placed && (
                    <span className="text-green-500 text-xs">Geplaatst</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
