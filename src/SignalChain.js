import { DEFAULT_FX_ORDER, FX_SLOT, normalizeFxOrder } from './fxSlots.js';

function makeInsert(ctx) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  dry.gain.value = 1;
  wet.gain.value = 0;
  input.connect(dry);
  dry.connect(output);
  return { input, output, dry, wet };
}

export class SignalChain {
  constructor(audioCtx) {
    this.audioCtx = audioCtx;
    this.input = audioCtx.createGain();
    this.output = audioCtx.createGain();
    this.fxOrder = [...DEFAULT_FX_ORDER];
    this._buildModules();
    this.rebuildChain();
  }

  _buildModules() {
    const ctx = this.audioCtx;

    // --- Compressor ---
    const cmp = makeInsert(ctx);
    this.compressorNode = ctx.createDynamicsCompressor();
    this.compressorNode.threshold.value = -24;
    this.compressorNode.knee.value = 30;
    this.compressorNode.ratio.value = 4;
    this.compressorNode.attack.value = 0.003;
    this.compressorNode.release.value = 0.25;
    this.makeupGainNode = ctx.createGain();
    this.makeupGainNode.gain.value = 1;
    cmp.input.connect(this.compressorNode);
    this.compressorNode.connect(this.makeupGainNode);
    this.makeupGainNode.connect(cmp.output);
    this.modules = { [FX_SLOT.compressor]: cmp };

    // --- Distortion ---
    const dst = makeInsert(ctx);
    this.distDrive = ctx.createGain();
    this.distDrive.gain.value = 1;
    this.distShaper = ctx.createWaveShaper();
    this.distShaper.curve = this.createSoftClipCurve(0);
    this.distShaper.oversample = '4x';
    this.distTone = ctx.createBiquadFilter();
    this.distTone.type = 'lowpass';
    this.distTone.frequency.value = 3200;
    this.distTone.Q.value = 0.7;
    this.distWet = ctx.createGain();
    this.distWet.gain.value = 0;
    dst.input.connect(dst.dry);
    dst.input.connect(this.distDrive);
    this.distDrive.connect(this.distShaper);
    this.distShaper.connect(this.distTone);
    this.distTone.connect(this.distWet);
    this.distWet.connect(dst.output);
    this.modules[FX_SLOT.distortion] = dst;

    // --- Delay ---
    const del = makeInsert(ctx);
    this.delayNode = ctx.createDelay(4);
    this.delayNode.delayTime.value = 0.15;
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.3;
    del.input.connect(del.dry);
    del.input.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(del.wet);
    this.modules[FX_SLOT.delay] = del;

    // --- Reverb ---
    const rev = makeInsert(ctx);
    this.reverbNode = ctx.createConvolver();
    this.reverbDamping = ctx.createBiquadFilter();
    this.reverbDamping.type = 'lowpass';
    this.reverbDamping.frequency.value = 20000;
    this.generateReverbImpulse(1.5);
    rev.input.connect(rev.dry);
    rev.input.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbDamping);
    this.reverbDamping.connect(rev.wet);
    this.modules[FX_SLOT.reverb] = rev;

    // --- EQ ---
    const eqMod = makeInsert(ctx);
    this.eqLowFilters = [];
    for (let i = 0; i < 4; i++) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowshelf';
      f.frequency.value = 200;
      f.gain.value = 0;
      this.eqLowFilters.push(f);
    }
    for (let i = 0; i < 3; i++) this.eqLowFilters[i].connect(this.eqLowFilters[i + 1]);
    this.eqLow = this.eqLowFilters[0];
    this.eqMid = ctx.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 1000;
    this.eqMid.Q.value = 1;
    this.eqMid.gain.value = 0;
    this.eqHighFilters = [];
    for (let i = 0; i < 4; i++) {
      const f = ctx.createBiquadFilter();
      f.type = 'highshelf';
      f.frequency.value = 5000;
      f.gain.value = 0;
      this.eqHighFilters.push(f);
    }
    for (let i = 0; i < 3; i++) this.eqHighFilters[i].connect(this.eqHighFilters[i + 1]);
    this.eqHigh = this.eqHighFilters[0];
    eqMod.input.connect(this.eqLow);
    this.eqLowFilters[3].connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);
    this.eqHighFilters[3].connect(eqMod.output);
    this.modules[FX_SLOT.eq] = eqMod;

    // --- Limiter ---
    const lim = makeInsert(ctx);
    this.limiterNode = ctx.createDynamicsCompressor();
    this.limiterNode.threshold.value = -0.1;
    this.limiterNode.knee.value = 0;
    this.limiterNode.ratio.value = 100;
    this.limiterNode.attack.value = 0;
    this.limiterNode.release.value = 0.05;
    lim.input.connect(this.limiterNode);
    this.limiterNode.connect(lim.output);
    this.modules[FX_SLOT.limiter] = lim;
  }

  rebuildChain() {
    this.input.disconnect();
    for (const slot of this.fxOrder) {
      this.modules[slot].input.disconnect();
      this.modules[slot].output.disconnect();
    }

    let prev = this.input;
    for (const slot of this.fxOrder) {
      const mod = this.modules[slot];
      prev.connect(mod.input);
      prev = mod.output;
    }
    prev.connect(this.output);
  }

  getFxOrder() {
    return [...this.fxOrder];
  }

  setFxOrder(order) {
    const next = normalizeFxOrder(order);
    if (next.join() === this.fxOrder.join()) return;
    this.fxOrder = next;
    this.rebuildChain();
  }

  generateReverbImpulse(decay = 1.5) {
    const sampleRate = this.audioCtx.sampleRate || 44100;
    const length = Math.max(1, Math.floor(sampleRate * decay));
    const impulse = this.audioCtx.createBuffer(2, length, sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }
    this.reverbNode.buffer = impulse;
  }

  createSoftClipCurve(amount) {
    const samples = 1024;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = amount > 0.01 ? (1 - amount) * x + amount * Math.tanh(x * 2) : x;
    }
    return curve;
  }

  updateEffects(effects, bpm) {
    const now = this.audioCtx.currentTime;
    const del = this.modules[FX_SLOT.delay];

    if (effects?.delay) {
      if (effects.delay.syncNote !== undefined && bpm) {
        const beatDuration = 60 / bpm;
        const noteValues = [
          { value: 0, duration: beatDuration * 0.25 },
          { value: 1, duration: beatDuration * 0.375 },
          { value: 2, duration: beatDuration * 0.5 },
          { value: 3, duration: beatDuration * 0.75 },
          { value: 4, duration: beatDuration * 1.0 },
          { value: 5, duration: beatDuration * 1.5 },
        ];
        const syncedDelay = noteValues.find((n) => n.value === effects.delay.syncNote);
        if (syncedDelay) effects.delay.time = syncedDelay.duration;
      }
      this.delayNode.delayTime.setValueAtTime(effects.delay.time || 0.15, now);
      this.delayFeedback.gain.setValueAtTime(effects.delay.feedback || 0.3, now);
      const mix = effects.delay.enabled ? effects.delay.mix || 0.2 : 0;
      del.wet.gain.setValueAtTime(mix, now);
      del.dry.gain.setValueAtTime(1, now);
    }

    const rev = this.modules[FX_SLOT.reverb];
    if (effects?.reverb) {
      const mix = effects.reverb.enabled ? effects.reverb.mix || 0.2 : 0;
      rev.wet.gain.setValueAtTime(mix, now);
      rev.dry.gain.setValueAtTime(1, now);
      if (effects.reverb.decay != null) this.generateReverbImpulse(effects.reverb.decay);
      const damping = effects.reverb.damping ?? 0.5;
      this.reverbDamping.frequency.setValueAtTime(500 + damping * 19500, now);
    }
  }

  updateDistortion({ enabled = false, drive = 0.45, mix = 0.5, tone = 3200 } = {}) {
    const now = this.audioCtx.currentTime;
    const dst = this.modules[FX_SLOT.distortion];
    const wet = enabled ? mix : 0;
    dst.wet.gain.setValueAtTime(wet, now);
    dst.dry.gain.setValueAtTime(1, now);
    this.distDrive.gain.setValueAtTime(1 + drive * 9, now);
    this.distTone.frequency.setValueAtTime(tone, now);
    this.distShaper.curve = this.createSoftClipCurve(enabled ? Math.min(1, drive + 0.15) : 0);
  }

  updateEQ(eq) {
    const now = this.audioCtx.currentTime;
    if (eq?.enabled) {
      const lowFilterCount = (eq.lowSlope || 12) / 12;
      this.eqLowFilters.forEach((f, i) => {
        if (eq.lowCut) {
          f.type = 'highpass';
          f.frequency.setValueAtTime(eq.lowFreq || 200, now);
          f.gain.setValueAtTime(0, now);
          if (i < lowFilterCount) f.Q.setValueAtTime(0.707, now);
          else f.frequency.setValueAtTime(20, now);
        } else {
          f.type = 'lowshelf';
          f.frequency.setValueAtTime(eq.lowFreq || 200, now);
          f.gain.setValueAtTime(i === 0 ? eq.lowGain || 0 : 0, now);
        }
      });
      this.eqMid.frequency.setValueAtTime(eq.midFreq || 1000, now);
      this.eqMid.Q.setValueAtTime(eq.midQ || 1, now);
      this.eqMid.gain.setValueAtTime(eq.midGain || 0, now);
      const highFilterCount = (eq.highSlope || 12) / 12;
      this.eqHighFilters.forEach((f, i) => {
        if (eq.highCut) {
          f.type = 'lowpass';
          f.frequency.setValueAtTime(eq.highFreq || 5000, now);
          f.gain.setValueAtTime(0, now);
          if (i < highFilterCount) f.Q.setValueAtTime(0.707, now);
          else f.frequency.setValueAtTime(20000, now);
        } else {
          f.type = 'highshelf';
          f.frequency.setValueAtTime(eq.highFreq || 5000, now);
          f.gain.setValueAtTime(i === 0 ? eq.highGain || 0 : 0, now);
        }
      });
    } else {
      this.eqLowFilters.forEach((f) => {
        f.type = 'lowshelf';
        f.gain.setValueAtTime(0, now);
      });
      this.eqMid.gain.setValueAtTime(0, now);
      this.eqHighFilters.forEach((f) => {
        f.type = 'highshelf';
        f.gain.setValueAtTime(0, now);
      });
    }
  }

  updateDynamics(dynamics) {
    const now = this.audioCtx.currentTime;
    if (dynamics?.compressor?.enabled) {
      this.compressorNode.threshold.setValueAtTime(dynamics.compressor.threshold ?? -24, now);
      this.compressorNode.ratio.setValueAtTime(dynamics.compressor.ratio ?? 4, now);
      this.compressorNode.attack.setValueAtTime(dynamics.compressor.attack ?? 0.003, now);
      this.compressorNode.release.setValueAtTime(dynamics.compressor.release ?? 0.25, now);
      this.compressorNode.knee.setValueAtTime(dynamics.compressor.knee ?? 30, now);
      const makeupGainDb = dynamics.compressor.makeupGain ?? 0;
      this.makeupGainNode.gain.setValueAtTime(Math.pow(10, makeupGainDb / 20), now);
    } else {
      this.compressorNode.threshold.setValueAtTime(0, now);
      this.makeupGainNode.gain.setValueAtTime(1, now);
    }

    const softClip = dynamics?.compressor?.softClip ?? 0;
    this.distShaper.curve = this.createSoftClipCurve(softClip);
    if (softClip > 0.01) {
      this.modules[FX_SLOT.distortion].wet.gain.setValueAtTime(
        Math.min(1, softClip),
        now
      );
    }

    if (dynamics?.limiter?.enabled) {
      this.limiterNode.threshold.setValueAtTime(dynamics.limiter.threshold ?? -0.1, now);
      this.limiterNode.ratio.setValueAtTime(100, now);
      this.limiterNode.knee.setValueAtTime(0, now);
      this.limiterNode.attack.setValueAtTime(0, now);
    } else {
      this.limiterNode.threshold.setValueAtTime(0, now);
      this.limiterNode.ratio.setValueAtTime(1, now);
    }
  }

  connect(destination) {
    this.output.connect(destination);
  }

  disconnect() {
    this.output.disconnect();
  }
}
