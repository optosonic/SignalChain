import React, { useRef, useEffect, useCallback, useState } from 'react';
import { SlidersHorizontal, RotateCcw, Activity, Power } from 'lucide-react';
import { Switch } from './ui/switch';
import Dial from './Dial';


const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const MIN_DB = -24;
const MAX_DB = 24;

const freqToX = (freq, width) => {
  const logFreq = Math.log10(freq);
  const logMin = Math.log10(MIN_FREQ);
  const logMax = Math.log10(MAX_FREQ);
  return (logFreq - logMin) / (logMax - logMin) * width;
};

const xToFreq = (x, width) => {
  const logMin = Math.log10(MIN_FREQ);
  const logMax = Math.log10(MAX_FREQ);
  const logFreq = x / width * (logMax - logMin) + logMin;
  return Math.pow(10, logFreq);
};

const dbToY = (db, height) => {
  return (1 - (db - MIN_DB) / (MAX_DB - MIN_DB)) * height;
};

const yToDb = (y, height) => {
  return (1 - y / height) * (MAX_DB - MIN_DB) + MIN_DB;
};

const findDbAtFreq = (freq, response) => {
  if (!response || response.length === 0) return 0;
  let p1 = response[0];
  let p2 = response[response.length - 1];
  for (let i = 0; i < response.length - 1; i++) {
    if (response[i].freq <= freq && response[i + 1].freq >= freq) {
      p1 = response[i];
      p2 = response[i + 1];
      break;
    }
  }
  if (p1.freq === p2.freq) return p1.db;
  const ratio = (freq - p1.freq) / (p2.freq - p1.freq);
  return p1.db + ratio * (p2.db - p1.db);
};

export default function EQPanel({ eq, onEQChange, audioContext, analyzerNode }) {
  const canvasRef = useRef(null);
  const dimensionsRef = useRef({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragPointIdRef = useRef(null);
  const eqRef = useRef(eq);
  const onEQChangeRef = useRef(onEQChange);
  const [showSpectrum, setShowSpectrum] = useState(false);
  const animationRef = useRef(null);

  useEffect(() => { eqRef.current = eq; }, [eq]);
  useEffect(() => { onEQChangeRef.current = onEQChange; }, [onEQChange]);

  const resetEQ = () => {
    onEQChangeRef.current({
      ...eqRef.current,
      lowGain: 0,
      lowFreq: 200,
      midGain: 0,
      midFreq: 1000,
      midQ: 1,
      highGain: 0,
      highFreq: 5000
    });
  };

  // Create a local audio context for visualization if none provided
  const localCtxRef = useRef(null);
  const getAudioContext = useCallback(() => {
    if (audioContext) return audioContext;
    if (!localCtxRef.current) {
      localCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return localCtxRef.current;
  }, [audioContext]);

  const getCombinedFrequencyResponse = useCallback((eqSettings) => {
    const ctx = getAudioContext();
    if (!ctx) return [];

    const freqs = new Float32Array(128);
    for (let i = 0; i < freqs.length; i++) {
      freqs[i] = xToFreq(i, freqs.length - 1);
    }

    const magResponse = new Float32Array(freqs.length);
    const phaseResponse = new Float32Array(freqs.length);
    const totalMag = new Float32Array(freqs.length).fill(1);

    // Low band - shelf or highpass with cascaded filters for steeper slopes
    if (eqSettings.lowCut) {
      const slope = eqSettings.lowSlope || 12;
      const filterCount = slope / 12; // 12dB = 1 filter, 24dB = 2, 48dB = 4
      for (let f = 0; f < filterCount; f++) {
        const lowFilter = ctx.createBiquadFilter();
        lowFilter.type = 'highpass';
        lowFilter.frequency.value = eqSettings.lowFreq;
        lowFilter.getFrequencyResponse(freqs, magResponse, phaseResponse);
        for (let i = 0; i < totalMag.length; i++) totalMag[i] *= magResponse[i];
      }
    } else {
      const lowFilter = ctx.createBiquadFilter();
      lowFilter.type = 'lowshelf';
      lowFilter.frequency.value = eqSettings.lowFreq;
      lowFilter.gain.value = eqSettings.lowGain;
      lowFilter.getFrequencyResponse(freqs, magResponse, phaseResponse);
      for (let i = 0; i < totalMag.length; i++) totalMag[i] *= magResponse[i];
    }

    const midFilter = ctx.createBiquadFilter();
    midFilter.type = 'peaking';
    midFilter.frequency.value = eqSettings.midFreq;
    midFilter.gain.value = eqSettings.midGain;
    midFilter.Q.value = eqSettings.midQ;
    midFilter.getFrequencyResponse(freqs, magResponse, phaseResponse);
    for (let i = 0; i < totalMag.length; i++) totalMag[i] *= magResponse[i];

    // High band - shelf or lowpass with cascaded filters for steeper slopes
    if (eqSettings.highCut) {
      const slope = eqSettings.highSlope || 12;
      const filterCount = slope / 12;
      for (let f = 0; f < filterCount; f++) {
        const highFilter = ctx.createBiquadFilter();
        highFilter.type = 'lowpass';
        highFilter.frequency.value = eqSettings.highFreq;
        highFilter.getFrequencyResponse(freqs, magResponse, phaseResponse);
        for (let i = 0; i < totalMag.length; i++) totalMag[i] *= magResponse[i];
      }
    } else {
      const highFilter = ctx.createBiquadFilter();
      highFilter.type = 'highshelf';
      highFilter.frequency.value = eqSettings.highFreq;
      highFilter.gain.value = eqSettings.highGain;
      highFilter.getFrequencyResponse(freqs, magResponse, phaseResponse);
      for (let i = 0; i < totalMag.length; i++) totalMag[i] *= magResponse[i];
    }

    const dbResponse = [];
    for (let i = 0; i < totalMag.length; i++) {
      dbResponse.push({ freq: freqs[i], db: 20 * Math.log10(totalMag[i]) });
    }
    return dbResponse;
  }, [getAudioContext]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = dimensionsRef.current;
    if (width <= 0 || height <= 0) return;

    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Define custom shape path for background
    const notchHeight = 32; // Increased middle section height
    const leftNotchWidth = 60; // Slightly longer width
    const rightNotchWidth = 140; // Extended right width to fit all buttons

    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, notchHeight);
    ctx.lineTo(leftNotchWidth, notchHeight);
    // Smooth curve up - tighter curve
    ctx.bezierCurveTo(leftNotchWidth + 8, notchHeight, leftNotchWidth + 8, 0, leftNotchWidth + 24, 0);
    
    ctx.lineTo(width - rightNotchWidth - 24, 0);
    // Smooth curve down
    ctx.bezierCurveTo(width - rightNotchWidth - 8, 0, width - rightNotchWidth - 8, notchHeight, width - rightNotchWidth, notchHeight);
    
    ctx.lineTo(width, notchHeight);
    ctx.lineTo(width, height);
    ctx.closePath();

    // Clip all subsequent drawing to this shape
    ctx.save();
    ctx.clip();

    // Draw background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, 'rgba(139, 92, 246, 0.08)');
    bgGradient.addColorStop(1, 'rgba(10, 10, 20, 0.4)');
    ctx.fillStyle = bgGradient;
    ctx.fill();

    // Draw border for the shape
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.stroke();

    // Draw Real-time Spectrum
    if (showSpectrum && analyzerNode) {
      const bufferLength = analyzerNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyzerNode.getByteFrequencyData(dataArray);
      
      ctx.beginPath();
      ctx.moveTo(0, height);
      
      const nyquist = audioContext.sampleRate / 2;
      
      // Calculate all points using hybrid approach
      // Low Freq: Cubic Interpolation (smoothness)
      // High Freq: Peak Detection (accuracy)
      const points = [];
      for (let x = 0; x <= width; x++) {
        const freq = xToFreq(x, width);
        const nextFreq = xToFreq(x + 1, width);
        
        if (freq >= nyquist) {
          points.push(height);
          continue;
        }

        const index = (freq / nyquist) * bufferLength;
        const nextIndex = (nextFreq / nyquist) * bufferLength;
        
        let val;
        
        // If one pixel covers less than 1 bin, interpolate to look smooth
        if (nextIndex - index < 1.0) {
            const i = Math.floor(index);
            const v0 = dataArray[i - 1] || dataArray[i] || 0;
            const v1 = dataArray[i] || 0;
            const v2 = dataArray[i + 1] || v1;
            const v3 = dataArray[i + 2] || v2;
            
            const t = index - i;
            const t2 = t * t;
            const a0 = v3 - v2 - v0 + v1;
            const a1 = v0 - v1 - a0;
            const a2 = v2 - v0;
            const a3 = v1;
            
            val = Math.max(0, a0 * t * t2 + a1 * t2 + a2 * t + a3);
        } else {
            // If one pixel covers multiple bins, take the MAX value to preserve peaks
            const startI = Math.floor(index);
            const endI = Math.ceil(nextIndex);
            let maxVal = 0;
            // Scan all bins in this pixel's range
            for (let i = startI; i <= endI && i < bufferLength; i++) {
                if (dataArray[i] > maxVal) maxVal = dataArray[i];
            }
            val = maxVal;
        }

        const normalized = val / 255;
        const y = height - (normalized * height * 0.9);
        points.push(y);
      }

      // Very light smoothing to link the points without killing peaks
      const smoothPoints = [];
      const windowSize = 2; // Significantly reduced for precision
      
      for (let i = 0; i < points.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = -windowSize; j <= windowSize; j++) {
          if (points[i + j] !== undefined) {
            sum += points[i + j];
            count++;
          }
        }
        smoothPoints.push(sum / count);
      }

      // Draw the smoothed path
      ctx.beginPath();
      ctx.moveTo(0, height);
      
      for (let x = 0; x < smoothPoints.length; x++) {
        ctx.lineTo(x, smoothPoints[x]);
      }
      
      ctx.lineTo(width, height);
      ctx.closePath();
      
      // Gradient fill
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(167, 139, 250, 0.6)');
      gradient.addColorStop(1, 'rgba(167, 139, 250, 0.15)');
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Add a top border line for better definition
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(196, 181, 253, 0.8)';
      ctx.stroke();
    }
    
    // Restore context to remove clip for next frame (but actually we want clip for everything)
    // Actually, in animation loops, we clear rect anyway.
    // But `ctx.save()` was called before clip. We should restore if we want to draw outside.
    // However, we want EVERYTHING inside the shape.
    // The issue is `restore` is needed at the end of draw? 
    // No, `ctx.save()` pushes state. If we don't restore, the clip stack grows? No.
    // But `ctx` is reused? `getContext` returns same context.
    // Wait, in React `draw` is called every frame.
    // We must `restore()` at the end of `draw` to reset the clip for the next `draw` call (which starts with clearRect or fillRect).
    // Actually `canvas.width = ...` resets the context state in most browsers! 
    // Yes, setting width/height resets the context stack.
    // So we don't strictly need to restore, but it's good practice.
    // I'll add restore at the end.

    ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
    ctx.lineWidth = 0.5;
    [50, 100, 200, 500, 1000, 2000, 5000, 10000].forEach((freq) => {
      const x = freqToX(freq, width);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    });
    [-24, -18, -12, -6, 0, 6, 12, 18].forEach((db) => {
      const y = dbToY(db, height);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    });

    ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
    ctx.lineWidth = 1;
    const zeroY = dbToY(0, height);
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(width, zeroY);
    ctx.stroke();



    const response = getCombinedFrequencyResponse(eqRef.current);
    if (response.length === 0) return;

    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#a78bfa';
    ctx.shadowBlur = 8;

    ctx.beginPath();
    ctx.moveTo(freqToX(response[0].freq, width), dbToY(response[0].db, height));
    response.forEach((point) => {
      ctx.lineTo(freqToX(point.freq, width), dbToY(point.db, height));
    });
    ctx.stroke();
    ctx.shadowBlur = 0;

    const points = {
      low: { x: freqToX(eqRef.current.lowFreq, width), y: dbToY(findDbAtFreq(eqRef.current.lowFreq, response), height), color: '#f43f5e' },
      mid: { x: freqToX(eqRef.current.midFreq, width), y: dbToY(findDbAtFreq(eqRef.current.midFreq, response), height), color: '#34d399' },
      high: { x: freqToX(eqRef.current.highFreq, width), y: dbToY(findDbAtFreq(eqRef.current.highFreq, response), height), color: '#a78bfa' }
    };

    Object.values(points).forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(10, 10, 20, 0.8)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = point.color;
      ctx.stroke();
    });
    
    ctx.restore(); // Restore clip state

    // Draw dB labels (outside clip to ensure visibility)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    [-24, -18, -12, -6, 0, 6, 12, 18].forEach((db) => {
      const y = dbToY(db, height);
      ctx.fillText(db > 0 ? `+${db}` : db, width - 4, y + 3);
    });
  }, [getCombinedFrequencyResponse, audioContext, showSpectrum]);

  useEffect(() => {
    let frameId;
    const animate = () => {
      if (showSpectrum) {
        draw();
        frameId = requestAnimationFrame(animate);
      }
    };
    
    if (showSpectrum) {
      animate();
    } else {
      draw();
    }
    
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [showSpectrum, draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      dimensionsRef.current = { width, height };
      draw();
    });
    resizeObserver.observe(canvas);
    return () => resizeObserver.unobserve(canvas);
  }, [draw]);

  useEffect(() => {
    draw();
  }, [eq, audioContext, draw]);

  const handlePointerMoveRef = useRef();
  const handlePointerUpRef = useRef();

  useEffect(() => {
    handlePointerUpRef.current = () => {
      setIsDragging(false);
      dragPointIdRef.current = null;
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.removeEventListener('pointermove', handlePointerMoveRef.current);
      document.removeEventListener('pointerup', handlePointerUpRef.current);
    };

    handlePointerMoveRef.current = (e) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      const dragged = dragPointIdRef.current;
      if (!canvas || !dragged) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const currentEq = eqRef.current;
      const currentResponse = getCombinedFrequencyResponse(currentEq);
      if (currentResponse.length === 0) return;

      const newFreq = xToFreq(x, dimensionsRef.current.width);
      const newGainDbAtPointer = yToDb(y, dimensionsRef.current.height);

      const newEq = { ...currentEq };
      let currentBandFreq, currentBandGain, minFreqBound, maxFreqBound;

      if (dragged === 'low') {
        currentBandFreq = currentEq.lowFreq;
        currentBandGain = currentEq.lowGain;
        minFreqBound = MIN_FREQ;
        // Allow full range when in highpass (cut) mode
        maxFreqBound = currentEq.lowCut ? MAX_FREQ : 1000;
      } else if (dragged === 'mid') {
        currentBandFreq = currentEq.midFreq;
        currentBandGain = currentEq.midGain;
        minFreqBound = 200;
        maxFreqBound = 10000;
      } else {
        currentBandFreq = currentEq.highFreq;
        currentBandGain = currentEq.highGain;
        // Allow full range when in lowpass (cut) mode
        minFreqBound = currentEq.highCut ? MIN_FREQ : 1000;
        maxFreqBound = MAX_FREQ;
      }

      const dbAtCurrentBandFreqOnCurve = findDbAtFreq(currentBandFreq, currentResponse);
      const gainDelta = newGainDbAtPointer - dbAtCurrentBandFreqOnCurve;

      const clampedNewFreq = parseFloat(Math.max(minFreqBound, Math.min(newFreq, maxFreqBound)).toFixed(0));
      const clampedNewGain = parseFloat(Math.max(MIN_DB, Math.min(currentBandGain + gainDelta, MAX_DB)).toFixed(1));

      if (dragged === 'low') {
        newEq.lowFreq = clampedNewFreq;
        // Only change gain if not in cut mode
        if (!currentEq.lowCut) {
          newEq.lowGain = clampedNewGain;
        }
      } else if (dragged === 'mid') {
        newEq.midFreq = clampedNewFreq;
        newEq.midGain = clampedNewGain;
      } else {
        newEq.highFreq = clampedNewFreq;
        // Only change gain if not in cut mode
        if (!currentEq.highCut) {
          newEq.highGain = clampedNewGain;
        }
      }

      onEQChangeRef.current(newEq);
    };
  }, [getCombinedFrequencyResponse]);

  const handlePointerDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const currentEq = eqRef.current;
    const currentResponse = getCombinedFrequencyResponse(currentEq);

    const points = {
      low: { x: freqToX(currentEq.lowFreq, dimensionsRef.current.width), y: dbToY(findDbAtFreq(currentEq.lowFreq, currentResponse), dimensionsRef.current.height) },
      mid: { x: freqToX(currentEq.midFreq, dimensionsRef.current.width), y: dbToY(findDbAtFreq(currentEq.midFreq, currentResponse), dimensionsRef.current.height) },
      high: { x: freqToX(currentEq.highFreq, dimensionsRef.current.width), y: dbToY(findDbAtFreq(currentEq.highFreq, currentResponse), dimensionsRef.current.height) }
    };

    const hitRadius = 25;
    let pointHit = null;
    for (const [name, pos] of Object.entries(points)) {
      const dist = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
      if (dist < hitRadius) {
        pointHit = name;
        break;
      }
    }

    if (pointHit) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragPointIdRef.current = pointHit;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.addEventListener('pointermove', handlePointerMoveRef.current, { passive: false });
      document.addEventListener('pointerup', handlePointerUpRef.current);
    }
  }, [getCombinedFrequencyResponse]);

  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20 space-y-4 relative overflow-hidden">
      
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="p-1.5 rounded-lg bg-violet-500/20 backdrop-blur-md">
            <SlidersHorizontal className="w-4 h-4 text-violet-400" />
          </div>
          <span className={`text-sm font-medium transition-all ${eq.enabled ? 'text-violet-400 drop-shadow-[0_0_8px_rgba(167,139,250,0.8)]' : 'text-white/80'}`}>EQ</span>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setShowSpectrum(!showSpectrum)}
            className={`p-1.5 rounded-lg transition-colors backdrop-blur-md ${showSpectrum ? 'bg-violet-500/20 text-violet-300' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
            title="Toggle Spectrum Analyzer"
          >
            <Activity className="w-3 h-3" />
          </button>
          <button
            onClick={resetEQ}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors backdrop-blur-md"
            title="Reset EQ"
          >
            <RotateCcw className="w-3 h-3 text-white/40" />
          </button>
          <button
            onClick={() => onEQChange({ ...eq, enabled: !eq.enabled })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all backdrop-blur-md ${
              eq.enabled 
                ? 'bg-violet-500 border-violet-400 text-white shadow-[0_0_10px_rgba(167,139,250,0.5)]' 
                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/30'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase w-5 text-center">{eq.enabled ? 'On' : 'Off'}</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {/* Frequency Response Graph */}
        <div className="relative w-full h-56 -mt-2.5 rounded-lg touch-none overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-full absolute inset-0 z-10"
              onPointerDown={handlePointerDown}
              style={{ touchAction: 'none' }}
            />
        </div>

        {/* Band Controls */}
        <div className="grid grid-cols-3 gap-3">
          {/* Low */}
          <div className="flex flex-col items-center gap-2 p-2 bg-black/20 rounded-lg">
            {/* Mode selector: Shelf vs HP */}
            <div className="flex gap-0.5 bg-black/30 rounded p-0.5">
              <button
                onClick={() => onEQChange({ ...eq, lowCut: false })}
                className={`px-2 py-0.5 rounded text-[8px] font-bold transition-all ${
                  !eq.lowCut
                    ? 'bg-rose-500/40 text-rose-300'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                SHELF
              </button>
              <button
                onClick={() => onEQChange({ ...eq, lowCut: true })}
                className={`px-2 py-0.5 rounded text-[8px] font-bold transition-all ${
                  eq.lowCut
                    ? 'bg-rose-500/40 text-rose-300'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                HP
              </button>
            </div>
            {eq.lowCut ? (
              <div className="flex gap-1">
                {[12, 24, 48].map(slope => (
                  <button
                    key={slope}
                    onClick={() => onEQChange({ ...eq, lowSlope: slope })}
                    className={`px-1.5 py-1 rounded text-[8px] font-mono transition-all ${
                      (eq.lowSlope || 12) === slope
                        ? 'bg-rose-500/40 text-rose-300 border border-rose-500/50'
                        : 'bg-white/5 text-white/40 hover:bg-white/10'
                    }`}
                  >
                    {slope}
                  </button>
                ))}
              </div>
            ) : (
              <Dial value={eq.lowGain} onChange={(v) => onEQChange({ ...eq, lowGain: v })} min={-24} max={24} size="small" step={0.5} unit="dB" />
            )}
            <Dial value={eq.lowFreq} onChange={(v) => onEQChange({ ...eq, lowFreq: v })} scale="log" min={20} max={eq.lowCut ? 20000 : 1000} size="xsmall" step={1} unit="Hz" />
          </div>
          {/* Mid */}
          <div className="flex flex-col items-center gap-2 p-2 bg-black/20 rounded-lg">
            <span className="text-[10px] font-semibold text-emerald-400">MID</span>
            <Dial value={eq.midGain} onChange={(v) => onEQChange({ ...eq, midGain: v })} min={-24} max={24} size="small" step={0.5} unit="dB" />
            <div className="flex items-center gap-1">
              <Dial value={eq.midFreq} onChange={(v) => onEQChange({ ...eq, midFreq: v })} scale="log" min={200} max={10000} size="xsmall" step={1} unit="Hz" />
              <Dial value={eq.midQ} onChange={(v) => onEQChange({ ...eq, midQ: v })} min={0.1} max={10} size="xsmall" step={0.1} label="Q" scale="log" />
            </div>
          </div>
          {/* High */}
          <div className="flex flex-col items-center gap-2 p-2 bg-black/20 rounded-lg">
            {/* Mode selector: Shelf vs LP */}
            <div className="flex gap-0.5 bg-black/30 rounded p-0.5">
              <button
                onClick={() => onEQChange({ ...eq, highCut: false })}
                className={`px-2 py-0.5 rounded text-[8px] font-bold transition-all ${
                  !eq.highCut
                    ? 'bg-violet-500/40 text-violet-300'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                SHELF
              </button>
              <button
                onClick={() => onEQChange({ ...eq, highCut: true })}
                className={`px-2 py-0.5 rounded text-[8px] font-bold transition-all ${
                  eq.highCut
                    ? 'bg-violet-500/40 text-violet-300'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                LP
              </button>
            </div>
            {eq.highCut ? (
              <div className="flex gap-1">
                {[12, 24, 48].map(slope => (
                  <button
                    key={slope}
                    onClick={() => onEQChange({ ...eq, highSlope: slope })}
                    className={`px-1.5 py-1 rounded text-[8px] font-mono transition-all ${
                      (eq.highSlope || 12) === slope
                        ? 'bg-violet-500/40 text-violet-300 border border-violet-500/50'
                        : 'bg-white/5 text-white/40 hover:bg-white/10'
                    }`}
                  >
                    {slope}
                  </button>
                ))}
              </div>
            ) : (
              <Dial value={eq.highGain} onChange={(v) => onEQChange({ ...eq, highGain: v })} min={-24} max={24} size="small" step={0.5} unit="dB" />
            )}
            <Dial value={eq.highFreq} onChange={(v) => onEQChange({ ...eq, highFreq: v })} scale="log" min={eq.highCut ? 20 : 1000} max={20000} size="xsmall" step={1} unit="Hz" />
          </div>
        </div>
      </div>
    </div>
  );
}