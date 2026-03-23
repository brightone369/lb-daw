import { useCallback, useEffect, useRef, useState } from 'react';

export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export type Key = typeof KEYS[number];

export const SCALE_DEFS = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
  Pentatonic: [0, 2, 4, 7, 9],
  Chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
} as const;
export type Scale = keyof typeof SCALE_DEFS;

const DEFAULT_REFERENCE_HZ = 440;
const DEFAULT_CORRECTION = 100;
const DEFAULT_WET_MIX = 100;
const MIN_REFERENCE_HZ = 432;
const MAX_REFERENCE_HZ = 448;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function freqToMidi(freq: number, referenceHz = DEFAULT_REFERENCE_HZ) {
  return 69 + 12 * Math.log2(freq / referenceHz);
}

function midiToFreq(midi: number, referenceHz = DEFAULT_REFERENCE_HZ) {
  return referenceHz * Math.pow(2, (midi - 69) / 12);
}

function midiToNoteName(midi: number) {
  const rounded = Math.round(midi);
  const noteIndex = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return `${KEYS[noteIndex]}${octave}`;
}

function snapToScale(
  freq: number,
  keyOffset: number,
  intervals: readonly number[],
  referenceHz: number,
) {
  const midi = freqToMidi(freq, referenceHz);
  const centerOctave = Math.round((midi - keyOffset) / 12);

  let targetMidi = keyOffset + intervals[0] + centerOctave * 12;
  let minDistance = Math.abs(targetMidi - midi);

  for (let octave = centerOctave - 1; octave <= centerOctave + 1; octave++) {
    for (const interval of intervals) {
      const candidate = keyOffset + interval + octave * 12;
      const distance = Math.abs(candidate - midi);
      if (distance < minDistance) {
        minDistance = distance;
        targetMidi = candidate;
      }
    }
  }

  return {
    detectedNote: midiToNoteName(midi),
    targetMidi,
    targetNote: midiToNoteName(targetMidi),
  };
}

function getCrossfadeGains(wetMix: number) {
  const mix = clamp(wetMix / 100, 0, 1);
  return {
    dry: Math.cos(mix * Math.PI * 0.5),
    wet: Math.sin(mix * Math.PI * 0.5),
  };
}

function selectRecordingFormat() {
  const candidates = [
    { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
    { mimeType: 'audio/webm', extension: 'webm' },
    { mimeType: 'audio/mp4', extension: 'm4a' },
  ];

  if (typeof MediaRecorder === 'undefined') {
    return null;
  }

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
      return candidate;
    }
  }

  return { mimeType: undefined, extension: 'webm' as const };
}

function setGainValue(node: GainNode, value: number, time: number) {
  node.gain.cancelScheduledValues(time);
  node.gain.setTargetAtTime(value, time, 0.015);
}

export interface VocalRecording {
  id: string;
  name: string;
  url: string;
  extension: string;
}

export function useVocals() {
  const [micEnabled, setMicEnabled] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [recording, setRecording] = useState(false);
  const [detectedNote, setDetectedNote] = useState<string | null>(null);
  const [targetNote, setTargetNote] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<VocalRecording[]>([]);
  const [key, setKey] = useState<Key>('C');
  const [scale, setScale] = useState<Scale>('Major');
  const [correctionAmount, setCorrectionAmountState] = useState(DEFAULT_CORRECTION);
  const [wetMix, setWetMixState] = useState(DEFAULT_WET_MIX);
  const [referenceHz, setReferenceHzState] = useState(DEFAULT_REFERENCE_HZ);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recCountRef = useRef(0);
  const recordingExtensionRef = useRef('webm');
  const recordingsRef = useRef<VocalRecording[]>([]);
  const mountedRef = useRef(true);

  const keyRef = useRef(key);
  const scaleRef = useRef(scale);
  const correctionAmountRef = useRef(correctionAmount);
  const referenceHzRef = useRef(referenceHz);

  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    correctionAmountRef.current = correctionAmount;
  }, [correctionAmount]);

  useEffect(() => {
    referenceHzRef.current = referenceHz;
  }, [referenceHz]);

  useEffect(() => {
    recordingsRef.current = recordings;
  }, [recordings]);

  const updateWetMix = useCallback((nextWetMix: number) => {
    const ctx = ctxRef.current;
    const dryGain = dryGainRef.current;
    const wetGain = wetGainRef.current;

    if (!ctx || !dryGain || !wetGain) {
      return;
    }

    const { dry, wet } = getCrossfadeGains(nextWetMix);
    setGainValue(dryGain, dry, ctx.currentTime);
    setGainValue(wetGain, wet, ctx.currentTime);
  }, []);

  useEffect(() => {
    updateWetMix(wetMix);
  }, [updateWetMix, wetMix]);

  const tearDownAudio = useCallback(async (discardPendingRecording = true) => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      if (discardPendingRecording) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        chunksRef.current = [];
        recorder.stop();
      } else {
        await new Promise<void>((resolve) => {
          const previousOnStop = recorder.onstop;
          recorder.onstop = (event) => {
            previousOnStop?.call(recorder, event);
            resolve();
          };
          recorder.stop();
        });
      }
    }

    recorderRef.current = null;
    chunksRef.current = [];

    workletRef.current?.disconnect();
    dryGainRef.current?.disconnect();
    wetGainRef.current?.disconnect();
    monitorGainRef.current?.disconnect();

    workletRef.current = null;
    dryGainRef.current = null;
    wetGainRef.current = null;
    monitorGainRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    const ctx = ctxRef.current;
    ctxRef.current = null;

    if (ctx && ctx.state !== 'closed') {
      await ctx.close().catch(() => undefined);
    }
  }, []);

  const enableMic = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage('This browser does not expose microphone input.');
      return;
    }

    const recordingFormat = selectRecordingFormat();
    if (!recordingFormat) {
      setErrorMessage('This browser does not support recording vocal takes.');
      return;
    }

    if (ctxRef.current && streamRef.current) {
      await ctxRef.current.resume();
      setMicEnabled(true);
      setErrorMessage(null);
      return;
    }

    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
      });

      ctx = new AudioContext();
      await ctx.audioWorklet.addModule('/pitch-processor.js');
      await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(ctx, 'pitch-processor');
      const dryGain = ctx.createGain();
      const wetGain = ctx.createGain();
      const monitorGain = ctx.createGain();
      const recordDestination = ctx.createMediaStreamDestination();

      monitorGain.gain.value = 0;

      source.connect(dryGain);
      source.connect(worklet);
      worklet.connect(wetGain);

      dryGain.connect(monitorGain);
      wetGain.connect(monitorGain);
      monitorGain.connect(ctx.destination);

      dryGain.connect(recordDestination);
      wetGain.connect(recordDestination);

      ctxRef.current = ctx;
      streamRef.current = stream;
      workletRef.current = worklet;
      dryGainRef.current = dryGain;
      wetGainRef.current = wetGain;
      monitorGainRef.current = monitorGain;

      updateWetMix(wetMix);

      recordingExtensionRef.current = recordingFormat.extension;
      const recorder = recordingFormat.mimeType
        ? new MediaRecorder(recordDestination.stream, { mimeType: recordingFormat.mimeType })
        : new MediaRecorder(recordDestination.stream);

      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        if (!mountedRef.current || chunksRef.current.length === 0) {
          chunksRef.current = [];
          return;
        }

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || recordingFormat.mimeType || 'audio/webm',
        });
        chunksRef.current = [];
        recCountRef.current += 1;

        const url = URL.createObjectURL(blob);
        setRecordings((previous) => [
          ...previous,
          {
            id: crypto.randomUUID(),
            name: `Take ${recCountRef.current}`,
            url,
            extension: recordingExtensionRef.current,
          },
        ]);
      };

      worklet.port.onmessage = ({ data }: MessageEvent<{ pitch: number }>) => {
        const freq = data.pitch;
        if (freq <= 0) {
          worklet.port.postMessage({ ratio: 1 });
          if (mountedRef.current) {
            setDetectedNote(null);
            setTargetNote(null);
          }
          return;
        }

        const currentReferenceHz = referenceHzRef.current;
        const rawMidi = freqToMidi(freq, currentReferenceHz);
        const keyOffset = KEYS.indexOf(keyRef.current);
        const intervals = SCALE_DEFS[scaleRef.current];
        const snap = snapToScale(freq, keyOffset, intervals, currentReferenceHz);
        const correction = correctionAmountRef.current / 100;
        const correctedMidi = rawMidi + (snap.targetMidi - rawMidi) * correction;
        const correctedFreq = midiToFreq(correctedMidi, currentReferenceHz);
        const ratio = clamp(correctedFreq / freq, 0.5, 2);

        worklet.port.postMessage({ ratio });

        if (mountedRef.current) {
          setDetectedNote(snap.detectedNote);
          setTargetNote(snap.targetNote);
        }
      };

      if (mountedRef.current) {
        setMicEnabled(true);
        setMonitoring(false);
        setRecording(false);
        setDetectedNote(null);
        setTargetNote(null);
        setErrorMessage(null);
      }
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      if (ctx && ctx.state !== 'closed') {
        await ctx.close().catch(() => undefined);
      }

      if (!mountedRef.current) {
        return;
      }

      const message =
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow mic permission and try again.'
          : error instanceof Error
            ? error.message
            : 'Unable to enable the vocal input.';

      setMicEnabled(false);
      setMonitoring(false);
      setRecording(false);
      setDetectedNote(null);
      setTargetNote(null);
      setErrorMessage(message);
    }
  }, [updateWetMix, wetMix]);

  const disableMic = useCallback(async () => {
    await tearDownAudio(false);

    if (!mountedRef.current) {
      return;
    }

    setMicEnabled(false);
    setMonitoring(false);
    setRecording(false);
    setDetectedNote(null);
    setTargetNote(null);
    setErrorMessage(null);
  }, [tearDownAudio]);

  const toggleMonitor = useCallback(async () => {
    const ctx = ctxRef.current;
    const gain = monitorGainRef.current;

    if (!ctx || !gain) {
      return;
    }

    await ctx.resume();

    const next = gain.gain.value < 0.5;
    setGainValue(gain, next ? 1 : 0, ctx.currentTime);
    setMonitoring(next);
  }, []);

  const startRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    const ctx = ctxRef.current;

    if (!recorder || recorder.state !== 'inactive') {
      return;
    }

    await ctx?.resume();
    chunksRef.current = [];
    recorder.start();
    setRecording(true);
    setErrorMessage(null);
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;

    if (!recorder || recorder.state === 'inactive') {
      return;
    }

    recorder.stop();
    setRecording(false);
  }, []);

  const deleteRecording = useCallback((id: string) => {
    setRecordings((previous) => {
      const recordingToDelete = previous.find((recording) => recording.id === id);
      if (recordingToDelete) {
        URL.revokeObjectURL(recordingToDelete.url);
      }

      return previous.filter((recording) => recording.id !== id);
    });
  }, []);

  const setCorrectionAmount = useCallback((nextValue: number) => {
    setCorrectionAmountState(clamp(Math.round(nextValue), 0, 100));
  }, []);

  const setWetMix = useCallback((nextValue: number) => {
    setWetMixState(clamp(Math.round(nextValue), 0, 100));
  }, []);

  const setReferenceHz = useCallback((nextValue: number) => {
    setReferenceHzState(clamp(Math.round(nextValue), MIN_REFERENCE_HZ, MAX_REFERENCE_HZ));
  }, []);

  useEffect(() => {
    return () => {
      mountedRef.current = false;

      recordingsRef.current.forEach((recording) => {
        URL.revokeObjectURL(recording.url);
      });

      void tearDownAudio();
    };
  }, [tearDownAudio]);

  return {
    micEnabled,
    monitoring,
    recording,
    detectedNote,
    targetNote,
    recordings,
    key,
    scale,
    correctionAmount,
    wetMix,
    referenceHz,
    errorMessage,
    setKey: setKey as (nextKey: Key) => void,
    setScale: setScale as (nextScale: Scale) => void,
    setCorrectionAmount,
    setWetMix,
    setReferenceHz,
    enableMic,
    disableMic,
    toggleMonitor,
    startRecording,
    stopRecording,
    deleteRecording,
  };
}
