import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { __testing, audioBufferToWavBlob, correctPitch } from './pitchCorrection';

class FakeAudioBuffer {
  readonly length: number;
  readonly sampleRate: number;
  readonly numberOfChannels: number;
  private readonly channels: Float32Array[];

  constructor(options: { length: number; sampleRate: number; numberOfChannels: number }) {
    this.length = options.length;
    this.sampleRate = options.sampleRate;
    this.numberOfChannels = options.numberOfChannels;
    this.channels = Array.from(
      { length: options.numberOfChannels },
      () => new Float32Array(options.length)
    );
  }

  getChannelData(channel: number) {
    return this.channels[channel];
  }

  copyToChannel(source: Float32Array, channel: number) {
    this.channels[channel].set(source);
  }
}

function createSineWaveBuffer(frequency: number, durationSeconds: number, sampleRate = 44100) {
  const length = Math.floor(durationSeconds * sampleRate);
  const buffer = new FakeAudioBuffer({
    length,
    sampleRate,
    numberOfChannels: 1,
  });
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < length; index += 1) {
    channel[index] = Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 0.5;
  }

  return buffer;
}

function estimatePitch(buffer: FakeAudioBuffer) {
  const center = Math.floor(buffer.length / 2);
  return __testing.detectPitch(buffer.getChannelData(0), buffer.sampleRate, center, 4096);
}

function maxDifference(left: Float32Array, right: Float32Array) {
  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference = Math.max(difference, Math.abs((left[index] ?? 0) - (right[index] ?? 0)));
  }

  return difference;
}

const OriginalAudioBuffer = globalThis.AudioBuffer;

beforeAll(() => {
  Object.defineProperty(globalThis, 'AudioBuffer', {
    configurable: true,
    writable: true,
    value: FakeAudioBuffer,
  });
});

afterAll(() => {
  Object.defineProperty(globalThis, 'AudioBuffer', {
    configurable: true,
    writable: true,
    value: OriginalAudioBuffer,
  });
});

describe('pitchCorrection', () => {
  it('snaps midi notes to the selected major scale', () => {
    expect(__testing.snapMidiToScale(61, 'C', 'major')).toBe(60);
    expect(__testing.snapMidiToScale(66, 'C', 'major')).toBe(65);
  });

  it('keeps chromatic snapping on the nearest semitone', () => {
    expect(__testing.snapMidiToScale(60.49, 'C', 'chromatic')).toBe(60);
    expect(__testing.snapMidiToScale(60.5, 'C', 'chromatic')).toBe(61);
  });

  it('converts midi and frequency values consistently', () => {
    const midi = __testing.frequencyToMidi(440);
    const frequency = __testing.midiToFrequency(midi);

    expect(midi).toBeCloseTo(69, 5);
    expect(frequency).toBeCloseTo(440, 5);
  });

  it('returns null pitch for silence', () => {
    const buffer = new FakeAudioBuffer({
      length: 44100,
      sampleRate: 44100,
      numberOfChannels: 1,
    });

    expect(estimatePitch(buffer)).toBeNull();
  });

  it('preserves buffer shape and changes audio data for a corrected tone', () => {
    const source = createSineWaveBuffer(455, 1.5);
    const corrected = correctPitch(source as unknown as AudioBuffer, {
      key: 'C',
      scale: 'major',
      amount: 1,
    }) as unknown as FakeAudioBuffer;
    const sourceChannel = source.getChannelData(0);
    const correctedChannel = corrected.getChannelData(0);

    expect(corrected.length).toBe(source.length);
    expect(corrected.sampleRate).toBe(source.sampleRate);
    expect(corrected.numberOfChannels).toBe(source.numberOfChannels);
    expect(maxDifference(sourceChannel, correctedChannel)).toBeGreaterThan(0.01);
  });

  it('writes a valid wav header', async () => {
    const buffer = createSineWaveBuffer(440, 0.25);
    const wavBlob = audioBufferToWavBlob(buffer as unknown as AudioBuffer);
    const bytes = new Uint8Array(await wavBlob.arrayBuffer());
    const riff = new TextDecoder().decode(bytes.slice(0, 4));
    const wave = new TextDecoder().decode(bytes.slice(8, 12));

    expect(wavBlob.type).toBe('audio/wav');
    expect(riff).toBe('RIFF');
    expect(wave).toBe('WAVE');
    expect(bytes.length).toBe(44 + buffer.length * 2);
  });
});
