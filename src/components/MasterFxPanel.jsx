import React, { useCallback } from 'react';
import { DEFAULT_FX_ORDER } from '../fxSlots.js';
import SignalPathPanel from './SignalPathPanel.jsx';
import DynamicsPanel from './DynamicsPanel.jsx';
import EffectsPanel from './EffectsPanel.jsx';

/**
 * Full master FX rail: signal path reorder + dynamics + delay/reverb/EQ.
 * Pass fxOrder/onFxOrderChange to sync UI with SignalChain.setFxOrder().
 */
export default function MasterFxPanel({
  fxOrder = DEFAULT_FX_ORDER,
  onFxOrderChange,
  effects,
  onEffectsChange,
  dynamics,
  onDynamicsChange,
  eq,
  onEQChange,
  bpm = 120,
  audioContext,
  compact = false,
}) {
  const handleOrderChange = useCallback(
    (next) => {
      onFxOrderChange?.(next);
    },
    [onFxOrderChange]
  );

  return (
    <div className="space-y-4">
      <SignalPathPanel order={fxOrder} onOrderChange={handleOrderChange} compact={compact} />
      <DynamicsPanel dynamics={dynamics} onDynamicsChange={onDynamicsChange} />
      <EffectsPanel
        effects={effects}
        onEffectsChange={onEffectsChange}
        bpm={bpm}
        eq={eq}
        onEQChange={onEQChange}
        audioContext={audioContext}
      />
    </div>
  );
}
