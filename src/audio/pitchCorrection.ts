const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export type ScaleName = 'major' | 'minor' | 'chromatic';

export interface PitchCorrectionOptions {
  key: string;
  scale: ScaleName;
  amount: number;
}

const SCALE_INTERVALS: Record<ScaleName, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  chromatic: Array.from({ length: 12 }, (_, index) => index),
};

function createHannWindow(size: number) {
  const window = new Float32Array(size);

  for (let index = 0; index < size; index += 1) {
    window[index] = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (size - 1));
  }

  return window;
}

function frequencyToMidi(frequency: number) {
  return 69 + 12 * Math.log2(frequency / 440);
}

function midiToFrequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function detectPitch(
  samples: Float32Array,
  sampleRate: number,
  center: number,
  frameSize: number
) {
  const halfFrame = Math.floor(frameSize / 2);
  const frameStart = Math.max(0, center - halfFrame);
  const frameEnd = Math.min(samples.length, frameStart + frameSize);
  const frameLength = frameEnd - frameStart;

  if (frameLength < frameSize / 2) {
    return null;
  }

  let rms = 0;

  for (let index = 0; index < frameLength; index += 1) {
    const sample = samples[frameStart + index];
    rms += sample * sample;
  }

  rms = Math.sqrt(rms / frameLength);

  if (rms < 0.015) {
    return null;
  }

  const minLag = Math.floor(sampleRate / 900);
  const maxLag = Math.min(Math.floor(sampleRate / 70), frameLength - 1);

  if (minLag >= maxLag) {
    return null;
  }

  let bestLag = -1;
  let bestCorrelation = 0;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let difference = 0;

    for (let index = 0; index < frameLength - lag; index += 1) {
      difference += Math.abs(samples[frameStart + index] - samples[frameStart + index + lag]);
    }

    const correlation = 1 - difference / (frameLength - lag);

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  if (bestLag === -1 || bestCorrelation < 0.82) {
    return null;
  }

  return sampleRate / bestLag;
}

function snapMidiToScale(midi: number, key: string, scale: ScaleName) {
  if (scale === 'chromatic') {
    return Math.round(midi);
  }

  const keyOffset = NOTE_NAMES.indexOf(key as (typeof NOTE_NAMES)[number]);
  const allowedIntervals = SCALE_INTERVALS[scale];
  let closestMidi = Math.round(midi);
  let smallestDistance = Number.POSITIVE_INFINITY;
  const octave = Math.floor(midi / 12);

  for (let octaveOffset = -1; octaveOffset <= 1; octaveOffset += 1) {
    const noteBase = (octave + octaveOffset) * 12 + keyOffset;

    for (const interval of allowedIntervals) {
      const candidateMidi = noteBase + interval;
      const distance = Math.abs(candidateMidi - midi);

      if (distance < smallestDistance) {
        smallestDistance = distance;
        closestMidi = candidateMidi;
      }
    }
  }

  return closestMidi;
}

function mixPitchTarget(sourceMidi: number, targetMidi: number, amount: number) {
  return sourceMidi + (targetMidi - sourceMidi) * amount;
}

function sampleAt(samples: Float32Array, position: number) {
  if (position <= 0) {
    return samples[0] ?? 0;
  }

  if (position >= samples.length - 1) {
    return samples[samples.length - 1] ?? 0;
  }

  const index = Math.floor(position);
  const fraction = position - index;
  const current = samples[index] ?? 0;
  const next = samples[index + 1] ?? current;
  return current + (next - current) * fraction;
}

function normaliseBuffer(channels: Float32Array[]) {
  let peak = 0;

  for (const channel of channels) {
    for (let index = 0; index < channel.length; index += 1) {
      peak = Math.max(peak, Math.abs(channel[index] ?? 0));
    }
  }

  if (peak <= 1) {
    return channels;
  }

  const gain = 1 / peak;

  channels.forEach((channel) => {
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] *= gain;
    }
  });

  return channels;
}

export async function decodeAudioBlob(blob: Blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const context = new AudioContext();

  try {
    return await context.decodeAudioData(arrayBuffer);
  } finally {
    await context.close();
  }
}

export function correctPitch(
  inputBuffer: AudioBuffer,
  options: PitchCorrectionOptions
) {
  const grainSize = 2048;
  const hopSize = Math.floor(grainSize / 4);
  const analysisSize = 4096;
  const window = createHannWindow(grainSize);
  const outputChannels = Array.from({ length: inputBuffer.numberOfChannels }, () => (
    new Float32Array(inputBuffer.length)
  ));
  const mixAmount = Math.min(Math.max(options.amount, 0), 1);

  for (let channelIndex = 0; channelIndex < inputBuffer.numberOfChannels; channelIndex += 1) {
    const input = inputBuffer.getChannelData(channelIndex);
    const output = outputChannels[channelIndex];

    for (let center = 0; center < input.length; center += hopSize) {
      const detectedFrequency = detectPitch(input, inputBuffer.sampleRate, center, analysisSize);
      let rate = 1;

      if (detectedFrequency) {
        const detectedMidi = frequencyToMidi(detectedFrequency);
        const snappedMidi = snapMidiToScale(detectedMidi, options.key, options.scale);
        const correctedMidi = mixPitchTarget(detectedMidi, snappedMidi, mixAmount);
        const correctedFrequency = midiToFrequency(correctedMidi);
        rate = Math.min(Math.max(correctedFrequency / detectedFrequency, 0.5), 2);
      }

      const grainStart = center - Math.floor(grainSize / 2);
      const sourceCenter = Math.min(Math.max(center, 0), input.length - 1);

      for (let grainIndex = 0; grainIndex < grainSize; grainIndex += 1) {
        const outputIndex = grainStart + grainIndex;

        if (outputIndex < 0 || outputIndex >= output.length) {
          continue;
        }

        const relativeIndex = grainIndex - grainSize / 2;
        const sourceIndex = sourceCenter + relativeIndex * rate;
        output[outputIndex] += sampleAt(input, sourceIndex) * window[grainIndex];
      }
    }
  }

  normaliseBuffer(outputChannels);

  const correctedBuffer = new AudioBuffer({
    length: inputBuffer.length,
    sampleRate: inputBuffer.sampleRate,
    numberOfChannels: inputBuffer.numberOfChannels,
  });

  outputChannels.forEach((channel, index) => {
    correctedBuffer.copyToChannel(channel, index);
  });

  return correctedBuffer;
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

export function audioBufferToWavBlob(buffer: AudioBuffer) {
  const bytesPerSample = 2;
  const blockAlign = buffer.numberOfChannels * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, buffer.numberOfChannels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;

  for (let sampleIndex = 0; sampleIndex < buffer.length; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
      const channel = buffer.getChannelData(channelIndex);
      const sample = Math.max(-1, Math.min(1, channel[sampleIndex] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

export { NOTE_NAMES };
