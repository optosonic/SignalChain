export class SignalChain {
  constructor(audioCtx) {
    this.audioCtx = audioCtx;
    this.input = this.audioCtx.createGain();
    this.output = this.audioCtx.createGain();
    this.masterGain = this.audioCtx.createGain();
    
    // Internal routing
    this.input.connect(this.masterGain);
    
    this.setupEffects();
    this.setupDynamics();
  }

  setupEffects() {
    const now = this.audioCtx.currentTime;

    // EQ chain
    this.eqLowFilters = [];
    for (let i = 0; i < 4; i++) {
      const f = this.audioCtx.createBiquadFilter();
      f.type = 'lowshelf'; f.frequency.value = 200; f.gain.value = 0;
      this.eqLowFilters.push(f);
    }
    for (let i = 0; i < 3; i++) this.eqLowFilters[i].connect(this.eqLowFilters[i + 1]);
    this.eqLow = this.eqLowFilters[0];
    
    this.eqMid = this.audioCtx.createBiquadFilter();
    this.eqMid.type = 'peaking'; this.eqMid.frequency.value = 1000; this.eqMid.Q.value = 1; this.eqMid.gain.value = 0;
    
    this.eqHighFilters = [];
    for (let i = 0; i < 4; i++) {
      const f = this.audioCtx.createBiquadFilter();
      f.type = 'highshelf'; f.frequency.value = 5000; f.gain.value = 0;
      this.eqHighFilters.push(f);
    }
    for (let i = 0; i < 3; i++) this.eqHighFilters[i].connect(this.eqHighFilters[i + 1]);
    this.eqHigh = this.eqHighFilters[0];

    // Connect EQ
    this.input.disconnect();
    this.input.connect(this.eqLow);
    this.eqLowFilters[3].connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);
    this.eqHighFilters[3].connect(this.masterGain);

    // Delay
    this.delayNode = this.audioCtx.createDelay(4);
    this.delayNode.delayTime.value = 0.15;
    this.delayFeedback = this.audioCtx.createGain();
    this.delayFeedback.gain.value = 0.3;
    this.delayWet = this.audioCtx.createGain();
    this.delayWet.gain.value = 0;
    
    this.input.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.delayWet);
    this.delayWet.connect(this.masterGain);
    
    // Reverb
    this.reverbNode = this.audioCtx.createConvolver();
    this.reverbDamping = this.audioCtx.createBiquadFilter();
    this.reverbDamping.type = 'lowpass';
    this.reverbDamping.frequency.value = 20000;
    this.reverbWet = this.audioCtx.createGain();
    this.reverbWet.gain.value = 0;
    
    this.generateReverbImpulse(1.5);
    
    this.input.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbDamping);
    this.reverbDamping.connect(this.reverbWet);
    this.reverbWet.connect(this.masterGain);
  }

  generateReverbImpulse(decay = 1.5) {
    const sampleRate = this.audioCtx.sampleRate || 44100;
    const length = sampleRate * decay;
    const impulse = this.audioCtx.createBuffer(2, length, sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2);
      }
    }
    this.reverbNode.buffer = impulse;
  }

  setupDynamics() {
    this.compressorNode = this.audioCtx.createDynamicsCompressor();
    this.compressorNode.threshold.value = -24;
    this.compressorNode.knee.value = 30;
    this.compressorNode.ratio.value = 4;
    this.compressorNode.attack.value = 0.003;
    this.compressorNode.release.value = 0.25;

    this.makeupGainNode = this.audioCtx.createGain();
    this.makeupGainNode.gain.value = 1;

    this.softClipNode = this.audioCtx.createWaveShaper();
    this.softClipNode.curve = this.createSoftClipCurve(0);
    this.softClipNode.oversample = '4x';

    this.limiterNode = this.audioCtx.createDynamicsCompressor();
    this.limiterNode.threshold.value = -0.1;
    this.limiterNode.knee.value = 0;
    this.limiterNode.ratio.value = 100;
    this.limiterNode.attack.value = 0;
    this.limiterNode.release.value = 0.05;

    this.masterGain.connect(this.compressorNode);
    this.compressorNode.connect(this.makeupGainNode);
    this.makeupGainNode.connect(this.softClipNode);
    this.softClipNode.connect(this.limiterNode);
    this.limiterNode.connect(this.output);
  }

  createSoftClipCurve(amount) {
    const samples = 1024;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      if (amount > 0.01) {
        curve[i] = (1 - amount) * x + amount * Math.tanh(x);
      } else {
        curve[i] = x;
      }
    }
    return curve;
  }

  updateEffects(effects, bpm) {
    const now = this.audioCtx.currentTime;
    if (effects.delay) {
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
        const syncedDelay = noteValues.find(n => n.value === effects.delay.syncNote);
        if (syncedDelay) effects.delay.time = syncedDelay.duration;
      }
      this.delayNode.delayTime.setValueAtTime(effects.delay.time || 0.15, now);
      this.delayFeedback.gain.setValueAtTime(effects.delay.feedback || 0.3, now);
      this.delayWet.gain.setValueAtTime(effects.delay.enabled ? (effects.delay.mix || 0.2) : 0, now);
    }
    if (effects.reverb) {
      this.reverbWet.gain.setValueAtTime(effects.reverb.enabled ? (effects.reverb.mix || 0.2) : 0, now);
      const damping = effects.reverb.damping ?? 0.5;
      const dampingFreq = 500 + damping * 19500;
      this.reverbDamping.frequency.setValueAtTime(dampingFreq, now);
    }
  }

  updateEQ(eq) {
    const now = this.audioCtx.currentTime;
    if (eq.enabled) {
      const lowFilterCount = (eq.lowSlope || 12) / 12;
      this.eqLowFilters.forEach((f, i) => {
        if (eq.lowCut) {
          f.type = 'highpass'; f.frequency.setValueAtTime(eq.lowFreq || 200, now); f.gain.setValueAtTime(0, now);
          if (i < lowFilterCount) f.Q.setValueAtTime(0.707, now);
          else f.frequency.setValueAtTime(20, now);
        } else {
          f.type = 'lowshelf'; f.frequency.setValueAtTime(eq.lowFreq || 200, now);
          f.gain.setValueAtTime(i === 0 ? (eq.lowGain || 0) : 0, now);
        }
      });
      
      this.eqMid.frequency.setValueAtTime(eq.midFreq || 1000, now);
      this.eqMid.Q.setValueAtTime(eq.midQ || 1, now);
      this.eqMid.gain.setValueAtTime(eq.midGain || 0, now);
      
      const highFilterCount = (eq.highSlope || 12) / 12;
      this.eqHighFilters.forEach((f, i) => {
        if (eq.highCut) {
          f.type = 'lowpass'; f.frequency.setValueAtTime(eq.highFreq || 5000, now); f.gain.setValueAtTime(0, now);
          if (i < highFilterCount) f.Q.setValueAtTime(0.707, now);
          else f.frequency.setValueAtTime(20000, now);
        } else {
          f.type = 'highshelf'; f.frequency.setValueAtTime(eq.highFreq || 5000, now);
          f.gain.setValueAtTime(i === 0 ? (eq.highGain || 0) : 0, now);
        }
      });
    } else {
      this.eqLowFilters.forEach(f => { f.type = 'lowshelf'; f.gain.setValueAtTime(0, now); });
      this.eqMid.gain.setValueAtTime(0, now);
      this.eqHighFilters.forEach(f => { f.type = 'highshelf'; f.gain.setValueAtTime(0, now); });
    }
  }

  updateDynamics(dynamics) {
    const now = this.audioCtx.currentTime;
    if (dynamics.compressor?.enabled) {
      this.compressorNode.threshold.setValueAtTime(dynamics.compressor.threshold ?? -24, now);
      this.compressorNode.ratio.setValueAtTime(dynamics.compressor.ratio ?? 4, now);
      this.compressorNode.attack.setValueAtTime(dynamics.compressor.attack ?? 0.003, now);
      this.compressorNode.release.setValueAtTime(dynamics.compressor.release ?? 0.25, now);
      this.compressorNode.knee.setValueAtTime(dynamics.compressor.knee ?? 30, now);

      const makeupGainDb = dynamics.compressor.makeupGain ?? 0;
      this.makeupGainNode.gain.setValueAtTime(Math.pow(10, makeupGainDb / 20), now);
      this.softClipNode.curve = this.createSoftClipCurve(dynamics.compressor.softClip ?? 0);
    } else {
      this.compressorNode.threshold.setValueAtTime(0, now);
      this.makeupGainNode.gain.setValueAtTime(1, now);
      this.softClipNode.curve = this.createSoftClipCurve(0);
    }
    
    if (dynamics.limiter?.enabled) {
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