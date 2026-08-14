# SignalChain

A standalone, reusable Web Audio API signal chain featuring:
- **Signal Path** — drag-to-reorder master FX chain (PHOTONE-style UI)
- 3-Band Parametric EQ (with high/low shelf or cut)
- Delay (synced or ms)
- Reverb (Convolver with dampening)
- Dynamics (Compressor, Distortion, Brickwall Limiter)

## Usage

```javascript
import {
  SignalChain,
  SignalPathPanel,
  MasterFxPanel,
  DEFAULT_FX_ORDER,
} from "./src/index.js";

const audioCtx = new AudioContext();
const chain = new SignalChain(audioCtx);

source.connect(chain.input);
chain.connect(audioCtx.destination);

// Reorder master bus (live audio rewire)
chain.setFxOrder(["compressor", "eq", "delay", "reverb", "distortion", "limiter"]);

// Update effects
chain.updateEQ({ enabled: true, lowGain: 3, midGain: -2, highGain: 1 });
chain.updateEffects({
  delay: { enabled: true, mix: 0.3, time: 0.25, feedback: 0.4 },
  reverb: { enabled: true, mix: 0.2, damping: 0.5 },
});
chain.updateDynamics({
  compressor: { enabled: true, threshold: -20, ratio: 4, makeupGain: 2 },
  limiter: { enabled: true, threshold: -0.1 },
});
```

## React UI

```jsx
import { useState } from "react";
import { MasterFxPanel, DEFAULT_FX_ORDER } from "./src/index.js";

function FxRail({ chain, effects, dynamics, eq, ...handlers }) {
  const [fxOrder, setFxOrder] = useState(DEFAULT_FX_ORDER);

  const handleOrderChange = (next) => {
    setFxOrder(next);
    chain.setFxOrder(next);
  };

  return (
    <MasterFxPanel
      fxOrder={fxOrder}
      onFxOrderChange={handleOrderChange}
      effects={effects}
      dynamics={dynamics}
      eq={eq}
      {...handlers}
    />
  );
}
```

Or use `SignalPathPanel` alone above your existing effect panels.

## Default chain order

`CMP → DST → DEL → REV → EQ → LIM` (matches PHOTONE / rumori)

## Exports

| Export | Description |
|--------|-------------|
| `SignalChain` | Web Audio processor with reorderable serial chain |
| `SignalPathPanel` | Drag-reorder UI component |
| `MasterFxPanel` | Signal path + dynamics + delay/reverb/EQ |
| `fxSlots.js` | Slot IDs, colours, order helpers |
