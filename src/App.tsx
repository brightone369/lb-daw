import { useSequencer, STEPS } from './useSequencer';
import VocalTrack from './VocalTrack';
import './App.css';

export default function App() {
  const { tracks, bpm, setBpm, playing, currentStep, start, stop, toggleStep } = useSequencer();

  return (
    <div className="daw">
      <header>
        <h1>LB DAW</h1>
        <div className="transport">
          <button onClick={playing ? stop : start} className={playing ? 'active' : ''}>
            {playing ? '⏹ Stop' : '▶ Play'}
          </button>
          <label>
            BPM
            <input
              type="number"
              min={40}
              max={240}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
            />
          </label>
        </div>
      </header>

      <div className="sequencer">
        <div className="step-numbers">
          <div className="track-label" />
          {Array.from({ length: STEPS }, (_, i) => (
            <div key={i} className={`step-num ${currentStep === i ? 'active' : ''}`}>
              {i + 1}
            </div>
          ))}
        </div>

        {tracks.map((track, ti) => (
          <div key={track.name} className="track">
            <div className="track-label">{track.name}</div>
            {track.steps.map((on, si) => (
              <button
                key={si}
                className={`step ${on ? 'on' : ''} ${currentStep === si ? 'current' : ''}`}
                onClick={() => toggleStep(ti, si)}
              />
            ))}
          </div>
        ))}
      </div>

      <VocalTrack />
    </div>
  );
}
