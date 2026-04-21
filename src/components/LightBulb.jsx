import { useRef, useState, useCallback } from 'react';
import { getLightColor } from '../services/hue';

const LONG_PRESS_MS = 420;

export default function LightBulb({ light, x, y, onTap, onLongPress, editMode, onDrag }) {
  const [pressing, setPressing] = useState(false);
  const timerRef = useRef(null);
  const movedRef = useRef(false);
  const startPosRef = useRef(null);

  const color = getLightColor(light);
  const isOn = light.on;
  const brightness = isOn ? (light.bri / 254) : 0;
  const glowRadius = isOn ? 10 + brightness * 18 : 0;
  const glowOpacity = isOn ? 0.15 + brightness * 0.25 : 0;

  const handleStart = useCallback((clientX, clientY) => {
    movedRef.current = false;
    startPosRef.current = { x: clientX, y: clientY };
    setPressing(true);
    timerRef.current = setTimeout(() => {
      if (!movedRef.current) {
        setPressing(false);
        if (navigator.vibrate) navigator.vibrate(30);
        onLongPress?.();
      }
    }, LONG_PRESS_MS);
  }, [onLongPress]);

  const handleEnd = useCallback(() => {
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
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      if (!movedRef.current) {
        movedRef.current = true;
        clearTimeout(timerRef.current);
        setPressing(false);
      }
      if (editMode) {
        onDrag?.({ dx, dy });
        startPosRef.current = { x: clientX, y: clientY };
      }
    }
  }, [editMode, onDrag]);

  const onTouchStart = (e) => {
    const t = e.touches[0];
    handleStart(t.clientX, t.clientY);
  };
  const onTouchMove = (e) => {
    const t = e.touches[0];
    handleMove(t.clientX, t.clientY);
  };
  const onTouchEnd = () => handleEnd();

  const onMouseDown = (e) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
    const onDocMove = (ev) => handleMove(ev.clientX, ev.clientY);
    const onDocUp = () => {
      handleEnd();
      document.removeEventListener('mousemove', onDocMove);
      document.removeEventListener('mouseup', onDocUp);
    };
    document.addEventListener('mousemove', onDocMove);
    document.addEventListener('mouseup', onDocUp);
  };

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ cursor: editMode ? 'grab' : 'pointer' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
    >
      {/* Glow ring */}
      {isOn && (
        <circle
          r={glowRadius + 16}
          fill={color}
          opacity={glowOpacity}
          className="light-pulse"
        />
      )}

      {/* Outer border */}
      <circle
        r={20}
        fill={pressing ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'}
        stroke={isOn ? color : '#1e3a5f'}
        strokeWidth={editMode ? 2.5 : 1.5}
        style={{ transition: 'stroke 0.3s ease, fill 0.15s ease' }}
      />

      {/* Main fill */}
      <circle
        r={14}
        fill={isOn ? color : '#0f172a'}
        style={{
          transition: 'fill 0.4s ease',
          filter: isOn ? `drop-shadow(0 0 ${4 + brightness * 8}px ${color})` : 'none',
        }}
      />

      {/* Bulb icon */}
      <g fill={isOn ? 'rgba(0,0,0,0.45)' : '#334155'} style={{ pointerEvents: 'none' }}>
        <ellipse cx={0} cy={-2} rx={4.5} ry={5.2} />
        <rect x={-3} y={4.5} width={6} height={2} rx={1} />
        <rect x={-3.5} y={6.5} width={7} height={1.5} rx={0.75} />
      </g>

      {/* Press feedback */}
      {pressing && (
        <circle r={20} fill="white" opacity={0.08} />
      )}

      {/* Label */}
      <text
        y={32}
        textAnchor="middle"
        fontSize={9}
        fontWeight={isOn ? '600' : '400'}
        fill={isOn ? '#e2e8f0' : '#475569'}
        style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
      >
        {light.name.length > 13 ? light.name.slice(0, 12) + '…' : light.name}
      </text>

      {/* Brightness bar */}
      {isOn && (
        <rect
          x={-14}
          y={22}
          width={Math.round(28 * brightness)}
          height={2.5}
          rx={1.25}
          fill={color}
          opacity={0.65}
        />
      )}
      {/* Brightness bar track */}
      <rect x={-14} y={22} width={28} height={2.5} rx={1.25} fill="none" stroke="#1e293b" strokeWidth={0.5} opacity={0.5} />

      {/* Edit drag handle */}
      {editMode && (
        <g transform="translate(15,-15)">
          <circle r={6} fill="#2563eb" stroke="#1d4ed8" strokeWidth={1.5} />
          <path d="M-2-2 L2-2 L0 2 Z" fill="white" opacity={0.8} />
        </g>
      )}
    </g>
  );
}
