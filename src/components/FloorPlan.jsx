import { useRef, useState, useCallback } from 'react';
import { useHueStore } from '../store/useHueStore';
import LightBulb from './LightBulb';
import LightControls from './LightControls';

export default function FloorPlan({ room }) {
  const { lights, updateRoom, editMode } = useHueStore();
  const [selectedLight, setSelectedLight] = useState(null);
  const [showControls, setShowControls] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);
  const panStart = useRef(null);
  const pinchStart = useRef(null);
  const lastTap = useRef(0);

  const toggleLight = useHueStore(s => s.toggleLight);

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStart.current = { dist: Math.hypot(dx, dy), zoom };
      panStart.current = null;
    } else if (e.touches.length === 1 && !editMode) {
      panStart.current = {
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      };
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && pinchStart.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const newZoom = Math.min(3, Math.max(0.5, pinchStart.current.zoom * (dist / pinchStart.current.dist)));
      setZoom(newZoom);
    } else if (e.touches.length === 1 && panStart.current) {
      setPan({
        x: e.touches[0].clientX - panStart.current.x,
        y: e.touches[0].clientY - panStart.current.y,
      });
    }
  };

  const handleTouchEnd = () => {
    pinchStart.current = null;
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
    lastTap.current = now;
  };

  const handleLightDrag = useCallback((lightPlacement, delta) => {
    if (!editMode) return;
    const updatedPlacements = room.lightPlacements.map(lp =>
      lp.lightId === lightPlacement.lightId
        ? { ...lp, x: lp.x + delta.dx / zoom, y: lp.y + delta.dy / zoom }
        : lp
    );
    updateRoom(room.id, { lightPlacements: updatedPlacements });
  }, [editMode, room, zoom, updateRoom]);

  const W = room.width || 800;
  const H = room.height || 600;
  const isZoomed = zoom !== 1 || pan.x !== 0 || pan.y !== 0;

  const placedLightCount = (room.lightPlacements || []).filter(lp => lights[lp.lightId]).length;

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      {/* Empty floor plan hint */}
      {placedLightCount === 0 && !editMode && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="text-center space-y-2 px-8">
            <div className="text-4xl opacity-30">💡</div>
            <p className="text-slate-600 text-sm">Geen lampen op de plattegrond</p>
            <p className="text-slate-700 text-xs">Druk op ✏️ om lampen te plaatsen</p>
          </div>
        </div>
      )}

      {/* SVG Floor Plan */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full touch-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: pinchStart.current ? 'none' : 'transform 0.1s ease',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleDoubleTap}
      >
        {/* Grid (subtle) */}
        <defs>
          <pattern id="fp-grid" width={40} height={40} patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth={0.4} />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#fp-grid)" opacity={0.5} />

        {/* Background photo */}
        {room.backgroundImage && (
          <image
            href={room.backgroundImage}
            x={0} y={0} width={W} height={H}
            preserveAspectRatio="xMidYMid meet"
            opacity={0.22}
          />
        )}

        {/* Furniture */}
        {(room.furniture || []).map((f, i) => (
          <g key={i}>
            <rect
              x={f.x} y={f.y} width={f.w} height={f.h}
              fill={f.style === 'door' ? 'rgba(96,165,250,0.12)' : 'rgba(30,58,95,0.35)'}
              stroke={f.style === 'door' ? '#60a5fa' : '#1e3a5f'}
              strokeWidth={1.5} rx={3}
            />
            <text x={f.x + f.w / 2} y={f.y + f.h / 2 + 4}
              textAnchor="middle" fontSize={9} fill="#374151"
              style={{ pointerEvents: 'none' }}>
              {f.label}
            </text>
          </g>
        ))}

        {/* Room outline */}
        {room.walls && room.walls.length > 1 && (
          <polyline
            points={room.walls.map(p => `${p.x},${p.y}`).join(' ')}
            fill="rgba(148,163,184,0.05)"
            stroke="#2d3f57"
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        )}

        {/* Room name label */}
        <text x={16} y={26} fontSize={13} fill="#334155" fontWeight="600"
          style={{ fontFamily: 'inherit', pointerEvents: 'none' }}>
          {room.name}
        </text>

        {/* Light placements */}
        {(room.lightPlacements || []).map(lp => {
          const light = lights[lp.lightId];
          if (!light) return null;
          return (
            <LightBulb
              key={lp.lightId}
              light={light}
              x={lp.x}
              y={lp.y}
              editMode={editMode}
              onTap={() => { if (!editMode) toggleLight(lp.lightId); }}
              onLongPress={() => {
                setSelectedLight(lp.lightId);
                setShowControls(true);
              }}
              onDrag={(delta) => handleLightDrag(lp, delta)}
            />
          );
        })}
      </svg>

      {/* Zoom reset — only shown when zoomed */}
      {isZoomed && (
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="absolute top-3 right-3 bg-slate-800/90 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full border border-slate-700 shadow-lg"
        >
          ⊙ Reset weergave
        </button>
      )}

      {/* Zoom level indicator */}
      {zoom !== 1 && (
        <div className="absolute bottom-3 right-3 bg-slate-800/70 text-slate-400 text-xs px-2 py-1 rounded-full pointer-events-none">
          {Math.round(zoom * 100)}%
        </div>
      )}

      {/* Double-tap hint */}
      {isZoomed && (
        <div className="absolute bottom-3 left-3 text-slate-700 text-xs pointer-events-none">
          Dubbel tik om terug te zetten
        </div>
      )}

      {/* Light controls sheet */}
      {showControls && selectedLight && (
        <LightControls
          lightId={selectedLight}
          onClose={() => { setShowControls(false); setSelectedLight(null); }}
        />
      )}
    </div>
  );
}
