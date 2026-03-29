import { useSequencer, STEPS } from '../useSequencer';

export default function HomePage() {
  const { tracks, bpm, setBpm, playing, currentStep, start, stop, toggleStep } = useSequencer();

  return (
    <section className="page-panel">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">Pattern Editor</p>
          <h2 className="page-title">Home</h2>
        </div>

        <div className="transport">
          <button onClick={playing ? stop : start} className={playing ? 'active' : ''}>
            {playing ? 'Stop' : 'Play'}
          </button>
          <label>
            BPM
            <input
              type="number"
              min={40}
              max={240}
              value={bpm}
              onChange={(event) => setBpm(Number(event.target.value))}
            />
          </label>
        </div>
      </header>

      <div className="sequencer-wrap">
        <div className="sequencer">
          <div className="step-numbers">
            <div className="track-label" />
            {Array.from({ length: STEPS }, (_, index) => (
              <div key={index} className={`step-num ${currentStep === index ? 'active' : ''}`}>
                {index + 1}
              </div>
            ))}
          </div>

          {tracks.map((track, trackIndex) => (
            <div key={track.name} className="track">
              <div className="track-label">{track.name}</div>
              {track.steps.map((on, stepIndex) => (
                <button
                  key={stepIndex}
                  className={`step ${on ? 'on' : ''} ${currentStep === stepIndex ? 'current' : ''}`}
                  onClick={() => toggleStep(trackIndex, stepIndex)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
