import { useRef, useState, useCallback, useEffect } from 'react';

export const STEPS = 16;

export type TrackName = 'Kick' | 'Snare' | 'Hi-Hat' | 'Clap';

export interface Track {
  name: TrackName;
  steps: boolean[];
}

function createOscillatorBurst(
  ctx: AudioContext,
  freq: number,
  duration: number,
  type: OscillatorType = 'sine'
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(0.8, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playSound(ctx: AudioContext, track: TrackName) {
  switch (track) {
    case 'Kick': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
      break;
    }
    case 'Snare': {
      const noise = ctx.createBufferSource();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      noise.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.8, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      noise.connect(gain);
      gain.connect(ctx.destination);
      noise.start(ctx.currentTime);
      createOscillatorBurst(ctx, 200, 0.1);
      break;
    }
    case 'Hi-Hat': {
      const noise = ctx.createBufferSource();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      noise.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 8000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(ctx.currentTime);
      break;
    }
    case 'Clap': {
      for (let i = 0; i < 3; i++) {
        const noise = ctx.createBufferSource();
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let j = 0; j < data.length; j++) data[j] = Math.random() * 2 - 1;
        noise.buffer = buf;
        const gain = ctx.createGain();
        const t = ctx.currentTime + i * 0.01;
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        noise.connect(gain);
        gain.connect(ctx.destination);
        noise.start(t);
      }
      break;
    }
  }
}

export function useSequencer() {
  const [tracks, setTracks] = useState<Track[]>([
    { name: 'Kick',   steps: Array(STEPS).fill(false) },
    { name: 'Snare',  steps: Array(STEPS).fill(false) },
    { name: 'Hi-Hat', steps: Array(STEPS).fill(false) },
    { name: 'Clap',   steps: Array(STEPS).fill(false) },
  ]);
  const [bpm, setBpm] = useState(120);
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);
  const stepRef = useRef(0);
  const tracksRef = useRef(tracks);

  useEffect(() => { tracksRef.current = tracks; }, [tracks]);

  const tick = useCallback(() => {
    const ctx = ctxRef.current!;
    const step = stepRef.current;
    setCurrentStep(step);
    tracksRef.current.forEach((track) => {
      if (track.steps[step]) playSound(ctx, track.name);
    });
    stepRef.current = (step + 1) % STEPS;
  }, []);

  const start = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    stepRef.current = 0;
    tick();
    intervalRef.current = window.setInterval(tick, (60 / bpm) * 1000 * 0.25);
    setPlaying(true);
  }, [bpm, tick]);

  const stop = useCallback(() => {
    if (intervalRef.current !== null) clearInterval(intervalRef.current);
    setPlaying(false);
    setCurrentStep(-1);
    stepRef.current = 0;
  }, []);

  useEffect(() => {
    if (playing) {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
      intervalRef.current = window.setInterval(tick, (60 / bpm) * 1000 * 0.25);
    }
  }, [bpm, playing, tick]);

  useEffect(() => () => { if (intervalRef.current !== null) clearInterval(intervalRef.current); }, []);

  const toggleStep = useCallback((trackIndex: number, step: number) => {
    setTracks((prev) =>
      prev.map((t, i) =>
        i === trackIndex
          ? { ...t, steps: t.steps.map((v, s) => (s === step ? !v : v)) }
          : t
      )
    );
  }, []);

  return { tracks, bpm, setBpm, playing, currentStep, start, stop, toggleStep };
}
