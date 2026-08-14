import React, { useEffect, useRef, useState } from 'react';
import { Zap, Activity, Power } from 'lucide-react';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import SimpleDial from './SimpleDial';
import { beatEngine } from './BeatEngine';

export default function DynamicsPanel({ dynamics, onDynamicsChange }) {
  const safeDynamics = {
    compressor: { 
      enabled: false, 
      threshold: -24, 
      ratio: 4, 
      attack: 0.003, 
      release: 0.25, 
      knee: 30,
      makeupGain: 0,
      softClip: 0,
      ...dynamics?.compressor 
    },
    limiter: { 
      enabled: true, 
      threshold: -0.1, 
      ...dynamics?.limiter 
    },
  };

  const [inputLevel, setInputLevel] = useState(-60);
  const [outputLevel, setOutputLevel] = useState(-60);
  const [gainReduction, setGainReduction] = useState(0);

  // Limiter meters
  const [limInputLevel, setLimInputLevel] = useState(-60);
  const [limOutputLevel, setLimOutputLevel] = useState(-60);
  const [limGainReduction, setLimGainReduction] = useState(0);
  const [isClipped, setIsClipped] = useState(false);
  const clipTimerRef = useRef(null);

  const animationRef = useRef(null);

  // Monitor levels
  useEffect(() => {
    // We always want to monitor if enabled, but check existence of analyzers
    if (!beatEngine.compressorInputAnalyzer) return;

    let lastTime = performance.now();

    const updateMeters = () => {
      const now = performance.now();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;
      const releaseRate = 120; // dB/s

      // --- COMPRESSOR METERS ---
      if (safeDynamics.compressor.enabled && beatEngine.compressorInputAnalyzer && beatEngine.compressorOutputAnalyzer) {
        const inData = new Float32Array(beatEngine.compressorInputAnalyzer.fftSize);
        const outData = new Float32Array(beatEngine.compressorOutputAnalyzer.fftSize);

        beatEngine.compressorInputAnalyzer.getFloatTimeDomainData(inData);
        beatEngine.compressorOutputAnalyzer.getFloatTimeDomainData(outData);

        let inPeak = 0;
        let outPeak = 0;
        for (let i = 0; i < inData.length; i++) {
          inPeak = Math.max(inPeak, Math.abs(inData[i]));
          outPeak = Math.max(outPeak, Math.abs(outData[i]));
        }

        const inDb = inPeak > 0.00001 ? 20 * Math.log10(inPeak) : -60;
        const outDb = outPeak > 0.00001 ? 20 * Math.log10(outPeak) : -60;

        setInputLevel(prev => (inDb >= prev ? inDb : Math.max(-60, prev - releaseRate * deltaTime)));
        setOutputLevel(prev => (outDb >= prev ? outDb : Math.max(-60, prev - releaseRate * deltaTime)));

        const actualGR = beatEngine.compressorNode ? Math.abs(beatEngine.compressorNode.reduction) : 0;
        setGainReduction(actualGR);
      } else {
        setInputLevel(-60);
        setOutputLevel(-60);
        setGainReduction(0);
      }

      // --- LIMITER METERS ---
      if (safeDynamics.limiter.enabled && beatEngine.limiterInputAnalyzer && beatEngine.limiterOutputAnalyzer) {
        const limInData = new Float32Array(beatEngine.limiterInputAnalyzer.fftSize);
        const limOutData = new Float32Array(beatEngine.limiterOutputAnalyzer.fftSize);

        beatEngine.limiterInputAnalyzer.getFloatTimeDomainData(limInData);
        beatEngine.limiterOutputAnalyzer.getFloatTimeDomainData(limOutData);

        let lInPeak = 0;
        let lOutPeak = 0;
        for (let i = 0; i < limInData.length; i++) {
          lInPeak = Math.max(lInPeak, Math.abs(limInData[i]));
          lOutPeak = Math.max(lOutPeak, Math.abs(limOutData[i]));
        }

        const lInDb = lInPeak > 0.00001 ? 20 * Math.log10(lInPeak) : -60;
        const lOutDb = lOutPeak > 0.00001 ? 20 * Math.log10(lOutPeak) : -60;

        setLimInputLevel(prev => (lInDb >= prev ? lInDb : Math.max(-60, prev - releaseRate * deltaTime)));
        setLimOutputLevel(prev => (lOutDb >= prev ? lOutDb : Math.max(-60, prev - releaseRate * deltaTime)));

        const limGR = beatEngine.limiterNode ? Math.abs(beatEngine.limiterNode.reduction) : 0;
        setLimGainReduction(limGR);

        // Clip detection (true peak check)
        if (lOutPeak >= 1.0 || lOutDb >= -0.01) {
          setIsClipped(true);
          if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
          clipTimerRef.current = setTimeout(() => setIsClipped(false), 1000); // Hold clip for 1s
        }
      } else {
        setLimInputLevel(-60);
        setLimOutputLevel(-60);
        setLimGainReduction(0);
      }

      animationRef.current = requestAnimationFrame(updateMeters);
    };

    updateMeters();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
    };
  }, [safeDynamics.compressor.enabled, safeDynamics.limiter.enabled, safeDynamics.compressor.threshold, safeDynamics.compressor.ratio, safeDynamics.compressor.knee, safeDynamics.limiter.threshold]);

  if (!onDynamicsChange) return null;

  const handleCompressorChange = (key, value) => {
    onDynamicsChange({
      ...safeDynamics,
      compressor: { ...safeDynamics.compressor, [key]: value },
    });
  };

  const handleLimiterChange = (key, value) => {
    onDynamicsChange({
      ...safeDynamics,
      limiter: { ...safeDynamics.limiter, [key]: value },
    });
  };

  return (
    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Compressor Section */}
        <div className="flex-1 p-4 rounded-xl bg-gradient-to-br from-sky-950/40 to-black/60 border border-sky-500/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-sky-500/20">
                <Activity className="w-4 h-4 text-sky-400" />
              </div>
              <span className={`text-sm font-medium transition-all ${safeDynamics.compressor.enabled ? 'text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]' : 'text-white/80'}`}>Compressor</span>
            </div>
            <button
              onClick={() => handleCompressorChange('enabled', !safeDynamics.compressor.enabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
                safeDynamics.compressor.enabled 
                  ? 'bg-sky-500 border-sky-400 text-white shadow-[0_0_10px_rgba(56,189,248,0.5)]' 
                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/30'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase w-5 text-center">{safeDynamics.compressor.enabled ? 'On' : 'Off'}</span>
            </button>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 md:gap-1.5">
            <div className="flex gap-1.5 justify-center">
            {/* Input Meter - Left */}
            <div className="flex flex-col items-center gap-1 w-12">
              <span className="text-[9px] text-sky-400/60 font-medium">IN</span>
              <div className="flex-1 w-8 bg-black/60 border border-sky-500/20 relative overflow-hidden">
                {safeDynamics.compressor.enabled && (
                  <div 
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-sky-500 via-sky-400 to-sky-300"
                    style={{ height: `${Math.max(0, Math.min(100, ((inputLevel + 60) / 60) * 100))}%` }}
                  />
                )}
                <div className="absolute inset-0 flex flex-col justify-between py-1">
                  <div className="w-full h-px bg-sky-300/40" />
                  <div className="w-full h-px bg-sky-400/30" />
                  <div className="w-full h-px bg-sky-500/30" />
                </div>
              </div>
              <span className="text-[8px] text-sky-400/80 font-mono">{safeDynamics.compressor.enabled ? inputLevel.toFixed(0) : '-60'}</span>
            </div>

            {/* Transfer Function Graph - Center */}
            <div className="w-48 h-48 bg-black/40 rounded-lg p-3 border border-sky-500/20 flex-shrink-0">
              <svg width="100%" height="100%" viewBox="0 0 140 140" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgb(56 189 248)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="rgb(56 189 248)" stopOpacity="1" />
                  </linearGradient>
                </defs>
                
                {/* Grid */}
                {[0, 20, 40, 60, 80, 100, 120].map(v => (
                  <g key={v}>
                    <line x1={v + 10} y1="10" x2={v + 10} y2="130" stroke="rgb(56 189 248 / 0.06)" strokeWidth="0.5" />
                    <line x1="10" y1={v + 10} x2="130" y2={v + 10} stroke="rgb(56 189 248 / 0.06)" strokeWidth="0.5" />
                  </g>
                ))}
                
                {/* Axes */}
                <line x1="10" y1="130" x2="130" y2="130" stroke="rgb(56 189 248 / 0.4)" strokeWidth="1.5" />
                <line x1="10" y1="10" x2="10" y2="130" stroke="rgb(56 189 248 / 0.4)" strokeWidth="1.5" />
                
                {/* Unity gain reference line (1:1) */}
                <line x1="10" y1="130" x2="130" y2="10" stroke="rgb(56 189 248 / 0.15)" strokeWidth="1" strokeDasharray="3,3" />
                
                {/* Threshold vertical line */}
                {(() => {
                  const thresholdX = 10 + ((safeDynamics.compressor.threshold + 60) / 60) * 120;
                  return (
                    <line 
                      x1={thresholdX} 
                      y1="10" 
                      x2={thresholdX} 
                      y2="130" 
                      stroke="rgb(251 113 133 / 0.4)" 
                      strokeWidth="1.5" 
                      strokeDasharray="4,3"
                    />
                  );
                })()}
                
                {/* Compression transfer curve */}
                <path
                  d={(() => {
                    const threshold = safeDynamics.compressor.threshold;
                    const ratio = safeDynamics.compressor.ratio;
                    const knee = safeDynamics.compressor.knee;
                    
                    // Map dB to pixel coordinates
                    // X-axis: input -60dB to 0dB maps to pixels 10 to 130
                    // Y-axis: output -60dB to 0dB maps to pixels 130 to 10 (inverted)
                    const inputToX = (db) => 10 + ((db + 60) / 60) * 120;
                    const outputToY = (db) => 130 - ((db + 60) / 60) * 120;
                    
                    let path = '';
                    const steps = 100;
                    
                    for (let i = 0; i <= steps; i++) {
                      const inputDb = -60 + (60 / steps) * i;
                      let outputDb;
                      
                      if (knee > 0) {
                        // Soft knee compression with smooth quadratic transition
                        const kneeHalf = knee / 2;
                        
                        if (inputDb <= threshold - kneeHalf) {
                          // Below knee: unity gain (no compression)
                          outputDb = inputDb;
                        } else if (inputDb >= threshold + kneeHalf) {
                          // Above knee: full compression at ratio
                          outputDb = threshold + (inputDb - threshold) / ratio;
                        } else {
                          // Within knee: smooth quadratic interpolation
                          const x = (inputDb - (threshold - kneeHalf)) / knee; // 0 to 1
                          const slope = 1 / ratio;
                          // Smooth transition from slope=1 to slope=1/ratio
                          outputDb = inputDb + (slope - 1) * Math.pow(inputDb - threshold + kneeHalf, 2) / (2 * knee);
                        }
                      } else {
                        // Hard knee compression
                        if (inputDb <= threshold) {
                          outputDb = inputDb;
                        } else {
                          outputDb = threshold + (inputDb - threshold) / ratio;
                        }
                      }
                      
                      const x = inputToX(inputDb);
                      const y = outputToY(outputDb);
                      
                      if (i === 0) {
                        path = `M ${x} ${y}`;
                      } else {
                        path += ` L ${x} ${y}`;
                      }
                    }
                    
                    return path;
                  })()}
                  fill="none"
                  stroke="url(#curveGradient)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                
                {/* Axis labels */}
                <text x="70" y="138" fontSize="7" fill="rgb(56 189 248 / 0.6)" textAnchor="middle" fontWeight="500">Input Level (dB)</text>
                <text x="5" y="70" fontSize="7" fill="rgb(56 189 248 / 0.6)" textAnchor="middle" transform="rotate(-90 5 70)" fontWeight="500">Output Level (dB)</text>
                
                {/* dB scale markers */}
                <text x="10" y="133" fontSize="6" fill="rgb(56 189 248 / 0.5)" textAnchor="middle">-60</text>
                <text x="50" y="133" fontSize="6" fill="rgb(56 189 248 / 0.5)" textAnchor="middle">-40</text>
                <text x="90" y="133" fontSize="6" fill="rgb(56 189 248 / 0.5)" textAnchor="middle">-20</text>
                <text x="130" y="133" fontSize="6" fill="rgb(56 189 248 / 0.5)" textAnchor="middle">0</text>
                
                <text x="7" y="132" fontSize="6" fill="rgb(56 189 248 / 0.5)" textAnchor="end">-60</text>
                <text x="7" y="92" fontSize="6" fill="rgb(56 189 248 / 0.5)" textAnchor="end">-40</text>
                <text x="7" y="52" fontSize="6" fill="rgb(56 189 248 / 0.5)" textAnchor="end">-20</text>
                <text x="7" y="12" fontSize="6" fill="rgb(56 189 248 / 0.5)" textAnchor="end">0</text>
              </svg>
              <div className="text-[8px] text-sky-400/50 text-center mt-1.5">
                {safeDynamics.compressor.enabled ? '✓ Active' : '○ Bypassed'}
              </div>
              </div>

              {/* Output Meter - Right of Graph */}
              <div className="flex flex-col items-center gap-1 w-12">
                <span className="text-[9px] text-sky-400/60 font-medium">OUT</span>
                <div className="flex-1 w-8 bg-black/60 border border-sky-500/20 relative overflow-hidden">
                  {safeDynamics.compressor.enabled && (
                    <div 
                      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-sky-500 via-sky-400 to-sky-300"
                      style={{ height: `${Math.max(0, Math.min(100, ((outputLevel + 60) / 60) * 100))}%` }}
                    />
                  )}
                  <div className="absolute inset-0 flex flex-col justify-between py-1">
                    <div className="w-full h-px bg-sky-300/40" />
                    <div className="w-full h-px bg-sky-400/30" />
                    <div className="w-full h-px bg-sky-500/30" />
                  </div>
                </div>
                <span className="text-[8px] text-sky-400/80 font-mono">{safeDynamics.compressor.enabled ? outputLevel.toFixed(0) : '-60'}</span>
              </div>

              {/* Gain Reduction Meter - Right of OUT */}
              <div className="flex flex-col items-center gap-1 w-12">
                <span className="text-[9px] text-amber-400/60 font-medium">GR</span>
                <div className="flex-1 w-8 bg-black/60 border border-amber-500/20 relative overflow-hidden">
                  {safeDynamics.compressor.enabled && gainReduction > 0.1 && (
                    <div 
                      className="absolute top-0 left-0 right-0 bg-gradient-to-b from-amber-400 to-amber-600"
                      style={{ height: `${Math.max(0, Math.min(100, (gainReduction / 40) * 100))}%` }}
                    />
                  )}
                </div>
                <span className="text-[8px] text-amber-400/80 font-mono">
                  {safeDynamics.compressor.enabled && gainReduction > 0.1
                    ? `-${gainReduction.toFixed(1)}`
                    : '0'}
                </span>
              </div>
            </div>

              {/* Parameters - Right Side */}
            <div className="flex-1 flex flex-col">
              <div className="grid grid-cols-2 gap-3 flex-1">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">Threshold</span>
                  <span className="text-sky-400 font-mono">{safeDynamics.compressor.threshold.toFixed(0)} dB</span>
                </div>
                <Slider
                  value={[safeDynamics.compressor.threshold]}
                  onValueChange={([v]) => handleCompressorChange('threshold', v)}
                  min={-60}
                  max={0}
                  step={1}
                  className="[&_.bg-primary]:bg-white/20 [&_[role=slider]]:bg-sky-500 [&_[role=slider]]:border-sky-400"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">Ratio</span>
                  <span className="text-sky-400 font-mono">{safeDynamics.compressor.ratio.toFixed(1)}:1</span>
                </div>
                <Slider
                  value={[safeDynamics.compressor.ratio]}
                  onValueChange={([v]) => handleCompressorChange('ratio', v)}
                  min={1}
                  max={20}
                  step={0.1}
                  className="[&_.bg-primary]:bg-white/20 [&_[role=slider]]:bg-sky-500 [&_[role=slider]]:border-sky-400"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">Knee</span>
                  <span className="text-sky-400 font-mono">{safeDynamics.compressor.knee.toFixed(0)} dB</span>
                </div>
                <Slider
                  value={[safeDynamics.compressor.knee]}
                  onValueChange={([v]) => handleCompressorChange('knee', v)}
                  min={0}
                  max={40}
                  step={1}
                  className="[&_.bg-primary]:bg-white/20 [&_[role=slider]]:bg-sky-500 [&_[role=slider]]:border-sky-400"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">Attack</span>
                  <span className="text-sky-400 font-mono">{(safeDynamics.compressor.attack * 1000).toFixed(1)} ms</span>
                </div>
                <Slider
                  value={[safeDynamics.compressor.attack * 1000]}
                  onValueChange={([v]) => handleCompressorChange('attack', v / 1000)}
                  min={0}
                  max={100}
                  step={0.1}
                  className="[&_.bg-primary]:bg-white/20 [&_[role=slider]]:bg-sky-500 [&_[role=slider]]:border-sky-400"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">Release</span>
                  <span className="text-sky-400 font-mono">{(safeDynamics.compressor.release * 1000).toFixed(0)} ms</span>
                </div>
                <Slider
                  value={[safeDynamics.compressor.release * 1000]}
                  onValueChange={([v]) => handleCompressorChange('release', v / 1000)}
                  min={10}
                  max={1000}
                  step={10}
                  className="[&_.bg-primary]:bg-white/20 [&_[role=slider]]:bg-sky-500 [&_[role=slider]]:border-sky-400"
                />
              </div>
              </div>

              {/* Dials in lower right corner */}
              <div className="flex gap-3 justify-end pt-2">
              <div className="flex flex-col items-center">
                <SimpleDial
                  value={safeDynamics.compressor.softClip}
                  onChange={(v) => handleCompressorChange('softClip', v)}
                  min={0}
                  max={1}
                  step={0.01}
                  size={50}
                  color="#38bdf8"
                />
                <span className="text-[9px] text-white/50 mt-1">Soft Clip</span>
                <span className="text-[9px] text-sky-400 font-mono">{Math.round(safeDynamics.compressor.softClip * 100)}%</span>
              </div>
              <div className="flex flex-col items-center">
                <SimpleDial
                  value={safeDynamics.compressor.makeupGain}
                  onChange={(v) => handleCompressorChange('makeupGain', v)}
                  min={-12}
                  max={24}
                  step={0.5}
                  size={50}
                  color="#38bdf8"
                />
                <span className="text-[9px] text-white/50 mt-1">Makeup</span>
                <span className="text-[9px] text-sky-400 font-mono">{safeDynamics.compressor.makeupGain >= 0 ? '+' : ''}{safeDynamics.compressor.makeupGain.toFixed(1)}dB</span>
              </div>
              </div>
              </div>
              </div>
        </div>

        {/* Limiter Section - Expanded with meters */}
        <div className="w-full md:w-auto min-w-[180px] p-4 rounded-xl bg-gradient-to-br from-rose-950/40 to-black/60 border border-rose-500/30 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-rose-500/20">
                <Zap className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <span className={`text-sm font-medium transition-all ${safeDynamics.limiter.enabled ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.8)]' : 'text-white/80'}`}>Limiter</span>
            </div>
            <button
              onClick={() => handleLimiterChange('enabled', !safeDynamics.limiter.enabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
                safeDynamics.limiter.enabled 
                  ? 'bg-rose-500 border-rose-400 text-white shadow-[0_0_10px_rgba(244,63,94,0.5)]' 
                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/30'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase w-5 text-center">{safeDynamics.limiter.enabled ? 'On' : 'Off'}</span>
            </button>
          </div>

          <div className="flex gap-4 h-48">
            {/* IN Meter */}
            <div className="flex flex-col items-center gap-1 w-8">
              <span className="text-[8px] text-rose-400/60 font-medium">IN</span>
              {/* Spacer for alignment */}
              <div className="w-6 h-1.5 mb-1 opacity-0" />
              <div className="flex-1 w-6 bg-black/60 border border-rose-500/20 relative overflow-hidden rounded-sm">
                {safeDynamics.limiter.enabled && (
                  <div 
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-rose-600 via-rose-500 to-rose-400"
                    style={{ height: `${Math.max(0, Math.min(100, ((limInputLevel + 60) / 60) * 100))}%` }}
                  />
                )}
                {/* Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between py-1 opacity-30">
                   {[...Array(10)].map((_, i) => <div key={i} className="w-full h-px bg-rose-300/30" />)}
                </div>
              </div>
              <span className="text-[8px] text-rose-400/80 font-mono">{safeDynamics.limiter.enabled ? limInputLevel.toFixed(0) : '-60'}</span>
            </div>

            {/* Slider Control */}
            <div className="flex flex-col items-center gap-1">
               <span className="text-[8px] text-transparent font-medium opacity-0">.</span>
               {/* Spacer for alignment */}
               <div className="w-1.5 h-1.5 mb-1 opacity-0" />
               <div className="relative w-1.5 flex-1 bg-white/10 rounded-full flex items-center justify-center mx-2">
                <Slider
                  value={[safeDynamics.limiter.threshold]}
                  onValueChange={([v]) => handleLimiterChange('threshold', v)}
                  min={-24}
                  max={0}
                  step={0.1}
                  orientation="vertical"
                  className="absolute h-full [&>span]:w-1.5 [&>span]:bg-transparent [&_.bg-primary]:bg-rose-500/60 [&_[role=slider]]:bg-rose-500 [&_[role=slider]]:border-rose-400"
                  style={{ left: 'calc(50% - 5px)', transform: 'translateX(-50%)' }}
                />
              </div>
              <span className="text-[8px] text-transparent font-mono opacity-0">.</span>
            </div>

            {/* GR Meter */}
             <div className="flex flex-col items-center gap-1 w-6">
                <span className="text-[8px] text-amber-400/60 font-medium">GR</span>
                {/* Spacer for alignment */}
                <div className="w-4 h-1.5 mb-1 opacity-0" />
                <div className="flex-1 w-4 bg-black/60 border border-amber-500/20 relative overflow-hidden rounded-sm">
                  {safeDynamics.limiter.enabled && limGainReduction > 0.1 && (
                    <div 
                      className="absolute top-0 left-0 right-0 bg-gradient-to-b from-amber-400 to-amber-600"
                      style={{ height: `${Math.max(0, Math.min(100, (limGainReduction / 20) * 100))}%` }}
                    />
                  )}
                </div>
                <span className="text-[8px] text-amber-400/80 font-mono">
                  {safeDynamics.limiter.enabled && limGainReduction > 0.1 ? `-${limGainReduction.toFixed(1)}` : '0'}
                </span>
             </div>

            {/* OUT Meter + Clip */}
            <div className="flex flex-col items-center gap-1 w-8">
              <span className="text-[8px] text-rose-400/60 font-medium">OUT</span>

              {/* Clip LED - Flat red, no glow */}
              <div className={`w-6 h-1.5 rounded-[1px] mb-1 transition-colors duration-0 ${isClipped ? 'bg-[#ff0000]' : 'bg-[#330000]'}`} />

              <div className="flex-1 w-6 bg-black/60 border border-rose-500/20 relative overflow-hidden rounded-sm">
                {safeDynamics.limiter.enabled && (
                  <div 
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-rose-600 via-rose-500 to-rose-400"
                    style={{ height: `${Math.max(0, Math.min(100, ((limOutputLevel + 60) / 60) * 100))}%` }}
                  />
                )}
                 <div className="absolute inset-0 flex flex-col justify-between py-1 opacity-30">
                   {[...Array(10)].map((_, i) => <div key={i} className="w-full h-px bg-rose-300/30" />)}
                </div>
              </div>
              <span className="text-[8px] text-rose-400/80 font-mono">{safeDynamics.limiter.enabled ? limOutputLevel.toFixed(0) : '-60'}</span>
            </div>
          </div>

          <div className="text-center space-y-1 mt-3">
            <div className="text-[10px] text-white/40">Threshold</div>
            <div className="text-xs text-rose-400 font-mono">{safeDynamics.limiter.threshold.toFixed(1)} dB</div>
          </div>
        </div>
      </div>
    </div>
  );
}