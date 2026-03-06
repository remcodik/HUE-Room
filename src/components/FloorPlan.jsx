import { useRef, useState, useCallback, useEffect } from 'react';
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

  const toggleLight = useHueStore(s => s.toggleLight);

  // Touch: pinch-zoom + pan
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

  // Double-tap to reset view
  const lastTap = useRef(0);
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

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
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
        {/* Background photo/image */}
        {room.backgroundImage && (
          <image
            href={room.backgroundImage}
            x={0}
            y={0}
            width={W}
            height={H}
            preserveAspectRatio="xMidYMid meet"
            opacity={0.25}
          />
        )}

        {/* Room outline (walls) */}
        {room.walls && room.walls.length > 1 && (
          <polyline
            points={room.walls.map(p => `${p.x},${p.y}`).join(' ')}
            fill="rgba(148,163,184,0.08)"
            stroke="#334155"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}

        {/* Room name */}
        <text
          x={20}
          y={30}
          fontSize={14}
          fill="#64748b"
          fontWeight="500"
          style={{ fontFamily: 'inherit' }}
        >
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
              onTap={() => {
                if (!editMode) toggleLight(lp.lightId);
              }}
              onLongPress={() => {
                setSelectedLight(lp.lightId);
                setShowControls(true);
              }}
              onDrag={(delta) => handleLightDrag(lp, delta)}
            />
          );
        })}
      </svg>

      {/* Zoom reset button */}
      {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="absolute top-4 right-4 bg-slate-800/80 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full border border-slate-700"
        >
          Reset weergave
        </button>
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
