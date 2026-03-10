import { useRef, useState, useCallback } from 'react';
import { getLightColor } from '../services/hue';

const LONG_PRESS_MS = 450;

export default function LightBulb({ light, x, y, onTap, onLongPress, editMode, onDrag }) {
  const [pressing, setPressing] = useState(false);
  const timerRef = useRef(null);
  const movedRef = useRef(false);
  const startPosRef = useRef(null);

  const color = getLightColor(light);
  const isOn = light.on;
  const brightness = isOn ? (light.bri / 254) : 0;

  const handleStart = useCallback((clientX, clientY) => {
    movedRef.current = false;
    startPosRef.current = { x: clientX, y: clientY };
    setPressing(true);
    timerRef.current = setTimeout(() => {
      if (!movedRef.current) {
        setPressing(false);
        onLongPress?.();
      }
    }, LONG_PRESS_MS);
  }, [onLongPress]);

  const handleEnd = useCallback((clientX, clientY) => {
    clearTimeout(timerRef.current);
    setPressing(false);
    if (!movedRef.current) {
      onTap?.();
    }
  }, [onTap]);

  const handleMove = useCallback((clientX, clientY) => {
    if (!startPosRef.current) return;
    const dx = clientX - startPosRef.current.x;
    const dy = clientY - startPosRef.current.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      movedRef.current = true;
      clearTimeout(timerRef.current);
      setPressing(false);
      if (editMode) {
        onDrag?.({ dx, dy });
        startPosRef.current = { x: clientX, y: clientY };
      }
    }
  }, [editMode, onDrag]);

  // Touch handlers
  const onTouchStart = (e) => {
    const t = e.touches[0];
    handleStart(t.clientX, t.clientY);
  };
  const onTouchMove = (e) => {
    const t = e.touches[0];
    handleMove(t.clientX, t.clientY);
  };
  const onTouchEnd = (e) => {
    const t = e.changedTouches[0];
    handleEnd(t.clientX, t.clientY);
  };

  // Mouse handlers (for desktop) – attach move/up to document so fast drags don't break
  const onMouseDown = (e) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);

    const onDocMove = (ev) => handleMove(ev.clientX, ev.clientY);
    const onDocUp = (ev) => {
      handleEnd(ev.clientX, ev.clientY);
      document.removeEventListener('mousemove', onDocMove);
      document.removeEventListener('mouseup', onDocUp);
    };
    document.addEventListener('mousemove', onDocMove);
    document.addEventListener('mouseup', onDocUp);
  };

  const glowSize = isOn ? 8 + brightness * 16 : 0;
  const glowOpacity = isOn ? 0.5 + brightness * 0.4 : 0;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ cursor: editMode ? 'grab' : 'pointer' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
    >
      {/* Glow halo */}
      {isOn && (
        <circle
          r={glowSize + 12}
          fill={color}
          opacity={glowOpacity * 0.3}
          className={isOn ? 'light-pulse' : ''}
        />
      )}

      {/* Outer ring */}
      <circle
        r={18}
        fill={pressing ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'}
        stroke={isOn ? color : '#334155'}
        strokeWidth={2}
        style={{ transition: 'all 0.25s ease' }}
      />

      {/* Main bulb body */}
      <circle
        r={13}
        fill={isOn ? color : '#1e293b'}
        style={{
          transition: 'fill 0.35s ease',
          filter: isOn ? `drop-shadow(0 0 ${glowSize}px ${color})` : 'none',
        }}
      />

      {/* Bulb icon - simplified */}
      <g fill={isOn ? '#0f172a' : '#475569'} opacity={0.7}>
        {/* Top oval */}
        <ellipse cx={0} cy={-2} rx={4.5} ry={5} />
        {/* Bottom cap */}
        <rect x={-2.5} y={4} width={5} height={2} rx={1} />
        <rect x={-3.5} y={6} width={7} height={1.5} rx={0.75} />
      </g>

      {/* Press ripple */}
      {pressing && (
        <circle r={18} fill="white" opacity={0.1} className="ripple" />
      )}

      {/* Light name */}
      <text
        y={28}
        textAnchor="middle"
        fontSize={9}
        fill={isOn ? '#f1f5f9' : '#64748b'}
        style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
      >
        {light.name.length > 12 ? light.name.slice(0, 11) + '…' : light.name}
      </text>

      {/* Brightness bar (small arc below) */}
      {isOn && (
        <rect
          x={-13}
          y={20}
          width={Math.round(26 * brightness)}
          height={2}
          rx={1}
          fill={color}
          opacity={0.7}
        />
      )}

      {/* Edit mode drag handle */}
      {editMode && (
        <circle r={5} cx={13} cy={-13} fill="#3b82f6" stroke="#1e40af" strokeWidth={1} />
      )}
    </g>
  );
}
