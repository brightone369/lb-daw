import { KEYS, SCALE_DEFS, useVocals } from './useVocals';
import type { Key, Scale, VocalRecording } from './useVocals';

export default function VocalTrack() {
  const {
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
    setKey,
    setScale,
    setCorrectionAmount,
    setWetMix,
    setReferenceHz,
    enableMic,
    disableMic,
    toggleMonitor,
    startRecording,
    stopRecording,
    deleteRecording,
  } = useVocals();

  const pitchReady = Boolean(detectedNote && targetNote);
  const isCorrecting = pitchReady && detectedNote !== targetNote;

  return (
    <section className="vocal-track">
      <div className="vocal-header">
        <span className="section-label">VOCALS</span>

        <div className="vocal-summary">
          <div className="pitch-display" aria-live="polite">
            <span className="pitch-caption">Pitch</span>
            <span className="pitch-raw">{detectedNote ?? 'Waiting'}</span>
            {isCorrecting && (
              <>
                <span className="pitch-arrow">-&gt;</span>
                <span className="pitch-target">{targetNote}</span>
              </>
            )}
            {pitchReady && !isCorrecting && <span className="pitch-in-tune">In tune</span>}
          </div>

          <p className={`vocal-status ${errorMessage ? 'error' : ''}`}>
            {errorMessage ??
              (micEnabled
                ? `Live retune ${correctionAmount}% · wet mix ${wetMix}% · A4 ${referenceHz} Hz`
                : 'Enable the mic to monitor, autotune, and record vocal takes.')}
          </p>
        </div>

        <div className="vocal-actions">
          {!micEnabled ? (
            <button type="button" className="btn-primary" onClick={enableMic}>
              Enable Mic
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`btn-secondary ${monitoring ? 'active' : ''}`}
                aria-pressed={monitoring}
                onClick={toggleMonitor}
              >
                {monitoring ? 'Monitor On' : 'Monitor Off'}
              </button>

              {!recording ? (
                <button type="button" className="btn-record" onClick={startRecording}>
                  Rec Take
                </button>
              ) : (
                <button type="button" className="btn-record recording" onClick={stopRecording}>
                  Stop
                </button>
              )}

              <button type="button" className="btn-secondary" onClick={disableMic}>
                Disable Mic
              </button>
            </>
          )}
        </div>
      </div>

      {micEnabled && (
        <div className="vocal-controls">
          <label>
            Key
            <select value={key} onChange={(event) => setKey(event.target.value as Key)}>
              {KEYS.map((nextKey) => (
                <option key={nextKey} value={nextKey}>
                  {nextKey}
                </option>
              ))}
            </select>
          </label>

          <label>
            Scale
            <select value={scale} onChange={(event) => setScale(event.target.value as Scale)}>
              {(Object.keys(SCALE_DEFS) as Scale[]).map((nextScale) => (
                <option key={nextScale} value={nextScale}>
                  {nextScale}
                </option>
              ))}
            </select>
          </label>

          <label className="slider-control">
            Retune
            <input
              type="range"
              min={0}
              max={100}
              value={correctionAmount}
              onChange={(event) => setCorrectionAmount(Number(event.target.value))}
            />
            <span className="control-value">{correctionAmount}%</span>
          </label>

          <label className="slider-control">
            Wet
            <input
              type="range"
              min={0}
              max={100}
              value={wetMix}
              onChange={(event) => setWetMix(Number(event.target.value))}
            />
            <span className="control-value">{wetMix}%</span>
          </label>

          <label className="number-control">
            A4
            <input
              type="number"
              min={432}
              max={448}
              value={referenceHz}
              onChange={(event) => setReferenceHz(Number(event.target.value))}
            />
            <span className="control-suffix">Hz</span>
          </label>
        </div>
      )}

      {recordings.length > 0 && (
        <ul className="recordings-list">
          {recordings.map((recordingItem: VocalRecording) => (
            <li key={recordingItem.id} className="recording-item">
              <span className="rec-name">{recordingItem.name}</span>
              <audio controls src={recordingItem.url} preload="metadata" />
              <a
                href={recordingItem.url}
                download={`${recordingItem.name}.${recordingItem.extension}`}
                className="btn-dl"
              >
                Download
              </a>
              <button
                type="button"
                className="btn-del"
                onClick={() => deleteRecording(recordingItem.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
