import React, { useRef, useCallback, useEffect } from 'react';

export default function Dial({ 
  value, 
  onChange, 
  min = 0, 
  max = 100, 
  step = 1, 
  label, 
  unit = '', 
  size = 'medium',
  scale = 'linear',
  className = ''
}) {
  const dialRef = useRef(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  const sizes = {
    xsmall: { dial: 28, stroke: 3 },
    small: { dial: 36, stroke: 3 },
    medium: { dial: 48, stroke: 4 },
  };

  const { dial: dialSize, stroke } = sizes[size] || sizes.medium;
  const radius = (dialSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 270 degrees

  // Convert value to normalized 0-1 range
  const valueToNormalized = useCallback((val) => {
    if (scale === 'log') {
      const logMin = Math.log10(min);
      const logMax = Math.log10(max);
      const logVal = Math.log10(Math.max(min, val));
      return (logVal - logMin) / (logMax - logMin);
    }
    return (val - min) / (max - min);
  }, [min, max, scale]);

  // Convert normalized 0-1 to actual value
  const normalizedToValue = useCallback((norm) => {
    if (scale === 'log') {
      const logMin = Math.log10(min);
      const logMax = Math.log10(max);
      const logVal = logMin + norm * (logMax - logMin);
      return Math.pow(10, logVal);
    }
    return min + norm * (max - min);
  }, [min, max, scale]);

  const normalized = valueToNormalized(value);
  const rotation = -135 + normalized * 270; // -135 to 135 degrees

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;
    startY.current = e.clientY;
    startValue.current = valueToNormalized(value);
    
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }, [value, valueToNormalized]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging.current) return;
    
    const deltaY = startY.current - e.clientY;
    const sensitivity = 0.005;
    let newNormalized = startValue.current + deltaY * sensitivity;
    newNormalized = Math.max(0, Math.min(1, newNormalized));
    
    let newValue = normalizedToValue(newNormalized);
    
    // Apply step
    newValue = Math.round(newValue / step) * step;
    newValue = Math.max(min, Math.min(max, newValue));
    
    onChange(parseFloat(newValue.toFixed(step < 1 ? 1 : 0)));
  }, [normalizedToValue, onChange, step, min, max]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
  }, [handlePointerMove]);

  useEffect(() => {
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const formatValue = (val) => {
    if (unit === 'Hz' && val >= 1000) {
      return `${(val / 1000).toFixed(1)}k`;
    }
    if (unit === 'dB') {
      return val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1);
    }
    return val.toFixed(step < 1 ? 1 : 0);
  };

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <div 
        ref={dialRef}
        className="relative cursor-ns-resize touch-none"
        style={{ width: dialSize, height: dialSize }}
        onPointerDown={handlePointerDown}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Background arc */}
        <svg width={dialSize} height={dialSize} className="absolute">
          <circle
            cx={dialSize / 2}
            cy={dialSize / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={stroke}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={-circumference * 0.375}
            strokeLinecap="round"
          />
        </svg>
        
        {/* Value arc */}
        <svg width={dialSize} height={dialSize} className="absolute">
          <circle
            cx={dialSize / 2}
            cy={dialSize / 2}
            r={radius}
            fill="none"
            stroke="url(#dialGradient)"
            strokeWidth={stroke}
            strokeDasharray={`${arcLength * normalized} ${circumference}`}
            strokeDashoffset={-circumference * 0.375}
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="dialGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Pointer */}
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div 
            className="bg-white rounded-full"
            style={{ 
              width: stroke + 2, 
              height: stroke + 2,
              marginTop: -(radius - stroke)
            }}
          />
        </div>
      </div>
      
      {/* Value display - fixed width to prevent layout shift */}
      <span className="text-[10px] text-white/60 font-mono tabular-nums text-center" style={{ minWidth: '3.5em' }}>
        {formatValue(value)}{unit && <span className="text-white/40 ml-0.5">{unit}</span>}
      </span>
      
      {label && (
        <span className="text-[9px] text-white/40 uppercase tracking-wider">{label}</span>
      )}
    </div>
  );
}