import React from 'react';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Waves, Timer, Sparkles, Power } from 'lucide-react';
import EQPanel from './EQPanel';

const NOTE_VALUES = [
  { label: '1/16', value: 0.25 },
  { label: '1/16.', value: 0.375 },
  { label: '1/8', value: 0.5 },
  { label: '1/8.', value: 0.75 },
  { label: '1/4', value: 1 },
  { label: '1/4.', value: 1.5 },
];

export default function EffectsPanel({ effects, onEffectsChange, bpm = 120, eq, onEQChange, audioContext }) {
  const updateEffect = (effectName, key, value) => {
    onEffectsChange({
      ...effects,
      [effectName]: {
        ...effects[effectName],
        [key]: value
      }
    });
  };

  return (
    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
      <div className="grid md:grid-cols-2 gap-4">

        {/* Delay */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-950/40 to-black/60 border border-blue-500/30 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/20">
                <Timer className="w-4 h-4 text-blue-400" />
              </div>
              <span className={`text-sm font-medium transition-all ${effects.delay.enabled ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'text-white/80'}`}>Delay</span>
            </div>
            <button
              onClick={() => updateEffect('delay', 'enabled', !effects.delay.enabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
                effects.delay.enabled 
                  ? 'bg-blue-500 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' 
                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/30'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase w-5 text-center">{effects.delay.enabled ? 'On' : 'Off'}</span>
              </button>
          </div>
          
          <div className="space-y-3">
              {/* Mode Toggle */}
              <div className="flex rounded-lg overflow-hidden border border-blue-500/30">
                <button
                  onClick={() => updateEffect('delay', 'syncNote', null)}
                  className={`flex-1 py-1.5 text-xs transition-all ${
                    effects.delay.syncNote == null 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white/5 text-white/50 hover:bg-white/10'
                  }`}
                >
                  Free
                </button>
                <button
                  onClick={() => {
                    const beatDuration = 60 / bpm;
                    const delayTime = beatDuration * NOTE_VALUES[2].value;
                    onEffectsChange({
                      ...effects,
                      delay: { ...effects.delay, syncNote: 2, time: delayTime }
                    });
                  }}
                  className={`flex-1 py-1.5 text-xs transition-all ${
                    effects.delay.syncNote != null 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white/5 text-white/50 hover:bg-white/10'
                  }`}
                >
                  Sync
                </button>
              </div>
              
              {/* Free: Time Slider */}
              {effects.delay.syncNote == null && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Time</span>
                    <span className="text-blue-400 font-mono">{Math.round(effects.delay.time * 1000)} ms</span>
                  </div>
                  <Slider
                    value={[effects.delay.time]}
                    onValueChange={([v]) => updateEffect('delay', 'time', v)}
                    min={0.01}
                    max={1.5}
                    step={0.01}
                    className="[&_.bg-primary]:bg-white/20 [&_[role=slider]]:bg-blue-500 [&_[role=slider]]:border-blue-400"
                  />
                </div>
              )}
              
              {/* Sync: Note Buttons */}
              {effects.delay.syncNote != null && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Note</span>
                    <span className="text-blue-400 font-mono">
                      {NOTE_VALUES[effects.delay.syncNote].label} = {Math.round(effects.delay.time * 1000)}ms
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {NOTE_VALUES.map((note, idx) => (
                      <button
                        key={note.label}
                        onClick={() => {
                          const beatDuration = 60 / bpm;
                          const delayTime = beatDuration * note.value;
                          onEffectsChange({
                            ...effects,
                            delay: { ...effects.delay, syncNote: idx, time: delayTime }
                          });
                        }}
                        className={`flex-1 py-1.5 text-[10px] rounded transition-all ${
                          effects.delay.syncNote === idx 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-white/10 text-white/50 hover:bg-white/20'
                        }`}
                      >
                        {note.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">Feedback</span>
                  <span className="text-blue-400 font-mono">{Math.round(effects.delay.feedback * 100)}%</span>
                </div>
                <Slider
                  value={[effects.delay.feedback]}
                  onValueChange={([v]) => updateEffect('delay', 'feedback', v)}
                  min={0}
                  max={0.9}
                  step={0.05}
                  className="[&_.bg-primary]:bg-white/20 [&_[role=slider]]:bg-blue-500 [&_[role=slider]]:border-blue-400"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">Mix</span>
                  <span className="text-blue-400 font-mono">{Math.round(effects.delay.mix * 100)}%</span>
                </div>
                <Slider
                  value={[effects.delay.mix]}
                  onValueChange={([v]) => updateEffect('delay', 'mix', v)}
                  min={0}
                  max={1}
                  step={0.05}
                  className="[&_.bg-primary]:bg-white/20 [&_[role=slider]]:bg-blue-500 [&_[role=slider]]:border-blue-400"
                />
              </div>
            </div>
        </div>

        {/* Reverb */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-purple-950/20 to-black/60 border border-purple-500/30 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-500/20">
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <span className={`text-sm font-medium transition-all ${effects.reverb.enabled ? 'text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]' : 'text-white/80'}`}>Reverb</span>
            </div>
            <button
              onClick={() => updateEffect('reverb', 'enabled', !effects.reverb.enabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
                effects.reverb.enabled 
                  ? 'bg-purple-500 border-purple-400 text-white shadow-[0_0_10px_rgba(168,85,247,0.5)]' 
                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/30'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase w-5 text-center">{effects.reverb.enabled ? 'On' : 'Off'}</span>
              </button>
          </div>
          
          <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">Decay</span>
                  <span className="text-purple-400 font-mono">{effects.reverb.decay.toFixed(1)}s</span>
                </div>
                <Slider
                  value={[effects.reverb.decay]}
                  onValueChange={([v]) => updateEffect('reverb', 'decay', v)}
                  min={0.5}
                  max={5}
                  step={0.5}
                  className="[&_.bg-primary]:bg-white/20 [&_[role=slider]]:bg-purple-500 [&_[role=slider]]:border-purple-400"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">Mix</span>
                  <span className="text-purple-400 font-mono">{Math.round(effects.reverb.mix * 100)}%</span>
                </div>
                <Slider
                  value={[effects.reverb.mix]}
                  onValueChange={([v]) => updateEffect('reverb', 'mix', v)}
                  min={0}
                  max={1}
                  step={0.05}
                  className="[&_.bg-primary]:bg-white/20 [&_[role=slider]]:bg-purple-500 [&_[role=slider]]:border-purple-400"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">Density</span>
                  <span className="text-purple-400 font-mono">{Math.round((effects.reverb.density ?? 0.5) * 100)}%</span>
                </div>
                <Slider
                  value={[effects.reverb.density ?? 0.5]}
                  onValueChange={([v]) => updateEffect('reverb', 'density', v)}
                  min={0.1}
                  max={1}
                  step={0.05}
                  className="[&_.bg-primary]:bg-white/20 [&_[role=slider]]:bg-purple-500 [&_[role=slider]]:border-purple-400"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">Damping</span>
                  <span className="text-purple-400 font-mono">{Math.round((effects.reverb.damping ?? 0.5) * 100)}%</span>
                </div>
                <Slider
                  value={[effects.reverb.damping ?? 0.5]}
                  onValueChange={([v]) => updateEffect('reverb', 'damping', v)}
                  min={0}
                  max={1}
                  step={0.05}
                  className="[&_.bg-primary]:bg-white/20 [&_[role=slider]]:bg-purple-500 [&_[role=slider]]:border-purple-400"
                />
              </div>
            </div>
            </div>
            </div>

            {/* EQ Panel */}
            <div className="md:col-span-3 mt-4">
            <EQPanel eq={eq} onEQChange={onEQChange} audioContext={audioContext} />
            </div>
            </div>
            );
            }