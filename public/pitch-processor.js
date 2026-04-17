/**
 * AudioWorklet: pitch detection (YIN) + granular pitch shifting (OLA).
 * Accepts messages: { ratio: number }  (pitch shift ratio, clamped 0.5-2.0)
 * Emits messages:   { pitch: number }  (detected Hz, or -1 if silent)
 */

const GRAIN = 1024;
const DELAY = GRAIN * 2;
const BUFSZ = 16384;
const BUFMASK = BUFSZ - 1;
const PD_BUF = 2048;
const PDMASK = PD_BUF - 1;
const TAU = 2 * Math.PI;

class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this._buffer = new Float32Array(BUFSZ);
    this._analysisRing = new Float32Array(PD_BUF);
    this._analysisScratch = new Float32Array(PD_BUF);
    this._yinDiff = new Float32Array((PD_BUF >> 1) + 1);

    this._time = 0;
    this._grainStartA = 0;
    this._grainStartB = -(GRAIN >> 1);
    this._ratio = 1;
    this._targetRatio = 1;
    this._analysisWrite = 0;
    this._analysisFilled = 0;
    this._frames = 0;

    this.port.onmessage = ({ data }) => {
      if (typeof data.ratio === 'number') {
        this._targetRatio = Math.max(0.5, Math.min(2, data.ratio));
      }
    };
  }

  _read(position) {
    const base = Math.floor(position);
    const i = base & BUFMASK;
    const j = (i + 1) & BUFMASK;
    const fraction = position - base;
    return this._buffer[i] * (1 - fraction) + this._buffer[j] * fraction;
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];

    if (!input || !output) {
      return true;
    }

    let ratio = this._ratio;

    for (let i = 0; i < input.length; i++) {
      const sample = input[i];

      this._buffer[this._time & BUFMASK] = sample;
      this._analysisRing[this._analysisWrite] = sample;
      this._analysisWrite = (this._analysisWrite + 1) & PDMASK;
      this._analysisFilled = Math.min(this._analysisFilled + 1, PD_BUF);

      ratio += (this._targetRatio - ratio) * 0.0025;

      const time = this._time;

      const phaseA = time - this._grainStartA;
      const windowA = 0.5 - 0.5 * Math.cos((TAU * phaseA) / GRAIN);
      const sampleA = this._read(this._grainStartA - DELAY + phaseA * ratio);

      const phaseB = time - this._grainStartB;
      const windowB = 0.5 - 0.5 * Math.cos((TAU * phaseB) / GRAIN);
      const sampleB = this._read(this._grainStartB - DELAY + phaseB * ratio);

      output[i] = sampleA * windowA + sampleB * windowB;

      this._time += 1;

      if (phaseA >= GRAIN - 1) {
        this._grainStartA = this._time;
      }
      if (phaseB >= GRAIN - 1) {
        this._grainStartB = this._time;
      }
    }

    this._ratio = ratio;
    this._frames += 1;

    if (this._frames >= 16) {
      this.port.postMessage({ pitch: this._yin() });
      this._frames = 0;
    }

    return true;
  }

  _yin() {
    if (this._analysisFilled < PD_BUF) {
      return -1;
    }

    const buffer = this._analysisScratch;
    for (let i = 0; i < PD_BUF; i++) {
      buffer[i] = this._analysisRing[(this._analysisWrite + i) & PDMASK];
    }

    let rms = 0;
    for (let i = 0; i < PD_BUF; i++) {
      rms += buffer[i] * buffer[i];
    }

    if (Math.sqrt(rms / PD_BUF) < 0.008) {
      return -1;
    }

    const minTau = Math.ceil(sampleRate / 900);
    const maxTau = Math.min(Math.floor(sampleRate / 60), (PD_BUF >> 1) - 1);
    const diff = this._yinDiff;
    diff.fill(0, 0, maxTau + 1);

    for (let tau = 1; tau <= maxTau; tau++) {
      let value = 0;
      for (let index = 0; index < (PD_BUF >> 1); index++) {
        const delta = buffer[index] - buffer[index + tau];
        value += delta * delta;
      }
      diff[tau] = value;
    }

    diff[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau <= maxTau; tau++) {
      runningSum += diff[tau];
      diff[tau] = runningSum === 0 ? 1 : (diff[tau] * tau) / runningSum;
    }

    for (let tau = minTau; tau <= maxTau; tau++) {
      if (diff[tau] < 0.15) {
        if (tau > 1 && tau < maxTau) {
          const prev = diff[tau - 1];
          const current = diff[tau];
          const next = diff[tau + 1];
          const denominator = 2 * (2 * current - prev - next);
          const adjustment = denominator !== 0 ? (next - prev) / denominator : 0;
          return sampleRate / (tau + adjustment);
        }

        return sampleRate / tau;
      }
    }

    return -1;
  }
}

registerProcessor('pitch-processor', PitchProcessor);
