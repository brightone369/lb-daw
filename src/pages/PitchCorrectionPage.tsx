import { useEffect, useRef, useState } from 'react';
import {
  NOTE_NAMES,
  audioBufferToWavBlob,
  correctPitch,
  decodeAudioBlob,
  type ScaleName,
} from '../audio/pitchCorrection';

export default function PitchCorrectionPage() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingUrlRef = useRef<string | null>(null);
  const correctedUrlRef = useRef<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [correctedUrl, setCorrectedUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string>('C');
  const [selectedScale, setSelectedScale] = useState<ScaleName>('major');
  const [correctionAmount, setCorrectionAmount] = useState(0.85);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;

      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;

        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      }

      stopStream();
    };
  }, []);

  useEffect(() => {
    recordingUrlRef.current = recordingUrl;
  }, [recordingUrl]);

  useEffect(() => {
    correctedUrlRef.current = correctedUrl;
  }, [correctedUrl]);

  useEffect(() => {
    return () => {
      if (recordingUrlRef.current) {
        URL.revokeObjectURL(recordingUrlRef.current);
      }

      if (correctedUrlRef.current) {
        URL.revokeObjectURL(correctedUrlRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorMessage('Recording is not supported in this browser.');
      return;
    }

    try {
      setErrorMessage(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = ({ data }) => {
        if (data.size > 0) {
          chunksRef.current.push(data);
        }
      };

      recorder.onstop = () => {
        mediaRecorderRef.current = null;
        stopStream();
        setIsRecording(false);

        if (chunksRef.current.length === 0) {
          return;
        }

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        const nextUrl = URL.createObjectURL(blob);
        setRecordingBlob(blob);

        setRecordingUrl((currentUrl) => {
          if (currentUrl) {
            URL.revokeObjectURL(currentUrl);
          }

          return nextUrl;
        });

        setCorrectedUrl((currentUrl) => {
          if (currentUrl) {
            URL.revokeObjectURL(currentUrl);
          }

          return null;
        });
      };

      recorder.onerror = () => {
        mediaRecorderRef.current = null;
        stopStream();
        setIsRecording(false);
        setErrorMessage('Recording failed. Please try again.');
      };

      recorder.start();
      setRecordingBlob(null);
      setRecordingUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }

        return null;
      });
      setCorrectedUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }

        return null;
      });
      setIsRecording(true);
    } catch {
      stopStream();
      setErrorMessage('Microphone access was denied.');
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === 'inactive') {
      return;
    }

    recorder.stop();
  };

  const applyPitchCorrection = async () => {
    if (!recordingBlob) {
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMessage(null);
      const inputBuffer = await decodeAudioBlob(recordingBlob);
      const correctedBuffer = correctPitch(inputBuffer, {
        key: selectedKey,
        scale: selectedScale,
        amount: correctionAmount,
      });
      const wavBlob = audioBufferToWavBlob(correctedBuffer);
      const nextUrl = URL.createObjectURL(wavBlob);

      setCorrectedUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }

        return nextUrl;
      });
    } catch {
      setErrorMessage('Pitch correction failed. Record another take and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const statusText = isRecording
    ? 'Recording...'
    : isProcessing
      ? 'Applying pitch correction...'
      : correctedUrl
        ? 'Corrected take ready.'
        : recordingUrl
          ? 'Ready to apply pitch correction.'
          : 'Record a short voice note.';

  return (
    <section className="page-panel">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">Audio Tools</p>
          <h2 className="page-title">Pitch Correction</h2>
        </div>
      </header>

      <div className="pitch-correction-layout">
        <div className="transport">
          <button onClick={isRecording ? stopRecording : startRecording} className={isRecording ? 'active' : ''}>
            {isRecording ? 'Stop recording' : 'Record voice'}
          </button>
          <button onClick={applyPitchCorrection} disabled={!recordingBlob || isRecording || isProcessing}>
            {isProcessing ? 'Processing...' : 'Apply correction'}
          </button>
          <span className="pitch-status">{statusText}</span>
        </div>

        <div className="pitch-controls">
          <label>
            Key
            <select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)}>
              {NOTE_NAMES.map((note) => (
                <option key={note} value={note}>
                  {note}
                </option>
              ))}
            </select>
          </label>

          <label>
            Scale
            <select
              value={selectedScale}
              onChange={(event) => setSelectedScale(event.target.value as ScaleName)}
            >
              <option value="major">Major</option>
              <option value="minor">Minor</option>
              <option value="chromatic">Chromatic</option>
            </select>
          </label>

          <label className="slider-field">
            Amount
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(correctionAmount * 100)}
              onChange={(event) => setCorrectionAmount(Number(event.target.value) / 100)}
            />
            <span>{Math.round(correctionAmount * 100)}%</span>
          </label>
        </div>

        {recordingUrl ? (
          <div className="audio-card">
            <p>Original take</p>
            <audio controls src={recordingUrl} />
          </div>
        ) : null}

        {correctedUrl ? (
          <div className="audio-card">
            <p>Corrected take</p>
            <audio controls src={correctedUrl} />
            <a href={correctedUrl} download="pitch-corrected.wav" className="download-link">
              Download WAV
            </a>
          </div>
        ) : null}

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      </div>
    </section>
  );
}
