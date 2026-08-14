# SignalChain

A standalone, reusable Web Audio API signal chain featuring:
- 3-Band Parametric EQ (with high/low shelf or cut)
- Delay (synced or ms)
- Reverb (Convolver with dampening)
- Dynamics (Compressor, Soft Clipper, Brickwall Limiter)

## Usage
```javascript
import { SignalChain } from "./src/SignalChain.js";

const audioCtx = new AudioContext();
const chain = new SignalChain(audioCtx);

// Connect source to chain input
source.connect(chain.input);

// Connect chain output to destination
chain.connect(audioCtx.destination);

// Update effects
chain.updateEQ({ enabled: true, lowGain: 3, midGain: -2, highGain: 1 });
chain.updateEffects({
  delay: { enabled: true, mix: 0.3, time: 0.25, feedback: 0.4 },
  reverb: { enabled: true, mix: 0.2, damping: 0.5 }
});
chain.updateDynamics({
  compressor: { enabled: true, threshold: -20, ratio: 4, makeupGain: 2, softClip: 0.5 },
  limiter: { enabled: true, threshold: -0.1 }
});
```
