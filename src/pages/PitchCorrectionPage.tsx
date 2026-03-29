import { useEffect, useRef, useState } from 'react';

export default function PitchCorrectionPage() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    return () => {
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
      }
    };
  }, [recordingUrl]);

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

        setRecordingUrl((currentUrl) => {
          if (currentUrl) {
            URL.revokeObjectURL(currentUrl);
          }

          return nextUrl;
        });
      };

      recorder.onerror = () => {
        mediaRecorderRef.current = null;
        stopStream();
        setIsRecording(false);
        setErrorMessage('Recording failed. Please try again.');
      };

      recorder.start();
      setRecordingUrl((currentUrl) => {
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

  const statusText = isRecording
    ? 'Recording...'
    : recordingUrl
      ? 'Ready to play back.'
      : 'Record a short voice note.';

  return (
    <section className="page-panel">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">Audio Tools</p>
          <h2 className="page-title">Pitch Correction</h2>
        </div>
      </header>

      <div style={{ display: 'grid', gap: '1rem', maxWidth: '28rem' }}>
        <div className="transport">
          <button onClick={isRecording ? stopRecording : startRecording} className={isRecording ? 'active' : ''}>
            {isRecording ? 'Stop recording' : 'Record voice'}
          </button>
          <span style={{ color: '#aaa', fontSize: '0.9rem' }}>{statusText}</span>
        </div>

        {recordingUrl ? <audio controls src={recordingUrl} style={{ width: '100%' }} /> : null}
        {errorMessage ? <p style={{ margin: 0, color: '#ff7b7b' }}>{errorMessage}</p> : null}
      </div>
    </section>
  );
}
