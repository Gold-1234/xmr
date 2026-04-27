import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { backendUrl, readJsonResponse } from '../utils/api';

interface Patient {
  name: string | null;
  age: number | null;
  gender: string | null;
}

interface Test {
  test_name: string;
  value: string;
  unit: string | null;
  reference_range: string | null;
  interpretation: 'Low' | 'Normal' | 'High' | 'Unknown';
  explanation?: string;
  health_summary?: string;
  concerning_findings?: string[];
  dietary_recommendations?: string[];
  lifestyle_recommendations?: string[];
}

interface VoiceAgentProps {
  patientInfo: Patient | null;
  extractedTests: Test[];
  standalone?: boolean;
}

type Status = 'idle' | 'recording' | 'processing' | 'speaking';

const VoiceAgent: React.FC<VoiceAgentProps> = ({ patientInfo, extractedTests, standalone = false }) => {
  const [status, setStatus] = useState<Status>('idle');
  const [statusText, setStatusText] = useState('Tap to speak');
  const [detectedLanguage, setDetectedLanguage] = useState('auto');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const cartesiaApiKey = import.meta.env.VITE_CARTESIA_API_KEY;

  useEffect(() => {
    if (status !== 'recording' && audioBlob) handleRecordingComplete();
  }, [status, audioBlob]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        setAudioBlob(new Blob(chunks, { type: 'audio/webm' }));
        stream.getTracks().forEach(t => t.stop());
      };
      setMediaRecorder(recorder);
      recorder.start();
      setStatus('recording');
      setStatusText('Listening…');
    } catch {
      alert('Microphone access denied. Please allow microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && status === 'recording') {
      mediaRecorder.stop();
      setStatus('processing');
      setStatusText('Processing…');
    }
  };

  const handleMicPress = () => {
    if (status === 'recording') stopRecording();
    else if (status === 'idle') startRecording();
  };

  const processSpeechToText = async (blob: Blob): Promise<string | null> => {
    if (!cartesiaApiKey) return null;
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const response = await fetch('https://api.cartesia.ai/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': cartesiaApiKey, 'Cartesia-Version': '2024-06-10' },
        body: JSON.stringify({ audio: base64Audio, model: 'nova-2-general', language: 'auto' }),
      });
      if (response.ok) {
        const result = await response.json();
        if (result.language) setDetectedLanguage(result.language);
        return result.text || result.transcription || null;
      }
    } catch { /* silent */ }
    return null;
  };

  const speakWithCartesia = async (text: string) => {
    if (!cartesiaApiKey) return;
    try {
      const response = await fetch('https://api.cartesia.ai/tts/bytes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': cartesiaApiKey, 'Cartesia-Version': '2024-06-10' },
        body: JSON.stringify({
          model_id: 'sonic-english',
          transcript: text,
          voice: { mode: 'id', id: 'professional-female-medical' },
          output_format: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 44100 },
        }),
      });
      if (response.ok) {
        const audioUrl = URL.createObjectURL(await response.blob());
        const audio = new Audio(audioUrl);
        setStatus('speaking');
        setStatusText('Speaking…');
        audio.onended = () => { setStatus('idle'); setStatusText('Tap to speak'); URL.revokeObjectURL(audioUrl); };
        audio.onerror = () => { setStatus('idle'); setStatusText('Tap to speak'); };
        await audio.play();
      }
    } catch {
      setStatus('idle');
      setStatusText('Tap to speak');
    }
  };

  const handleRecordingComplete = async () => {
    if (!audioBlob) return;
    const text = await processSpeechToText(audioBlob);
    setAudioBlob(null);
    if (!text) {
      setStatus('idle');
      setStatusText('Tap to speak');
      return;
    }
    try {
      const response = await fetch(`${backendUrl}/voice-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          report_data: patientInfo || extractedTests.length > 0 ? { patient: patientInfo, tests: extractedTests } : null,
          context: patientInfo || extractedTests.length > 0 ? 'with_report' : 'general_health',
          language: detectedLanguage,
        }),
      });
      if (response.ok) {
        const data = await readJsonResponse<any>(response);
        await speakWithCartesia(data.response);
      } else {
        setStatus('idle');
        setStatusText('Tap to speak');
      }
    } catch {
      setStatus('idle');
      setStatusText('Tap to speak');
    }
  };

  const hasContext = patientInfo || extractedTests.length > 0;

  const pulseClass = status === 'recording'
    ? 'scale-110 bg-red-500 shadow-[0_0_0_16px_rgba(239,68,68,0.15)]'
    : status === 'speaking'
    ? 'bg-cyan-500 shadow-[0_0_0_16px_rgba(6,182,212,0.15)]'
    : 'bg-navy-800 hover:bg-navy-700 hover:shadow-[0_0_0_12px_rgba(15,23,42,0.08)]';

  return (
    <div className={`${standalone ? 'p-6 lg:p-8 max-w-lg mx-auto' : 'p-6'}`}>
      {standalone && (
        <div className="mb-8">
          <h1 className="page-title">Voice Assistant</h1>
          <p className="text-muted mt-1">
            {hasContext ? 'Ask questions about your report results.' : 'Ask a general health question.'}
          </p>
        </div>
      )}

      <div className="card p-10 flex flex-col items-center gap-8">
        {/* Orb button */}
        <button
          onClick={handleMicPress}
          disabled={status === 'processing' || status === 'speaking'}
          className={`w-28 h-28 rounded-full flex items-center justify-center text-white transition-all duration-300 ${pulseClass} disabled:cursor-not-allowed`}
        >
          {status === 'processing' ? (
            <Loader2 className="w-10 h-10 animate-spin" />
          ) : status === 'speaking' ? (
            <Volume2 className="w-10 h-10" />
          ) : status === 'recording' ? (
            <MicOff className="w-10 h-10" />
          ) : (
            <Mic className="w-10 h-10" />
          )}
        </button>

        {/* Status label */}
        <div className="text-center">
          <p className={`text-base font-medium ${status === 'recording' ? 'text-red-500' : status === 'speaking' ? 'text-cyan-600' : 'text-slate-600'}`}>
            {statusText}
          </p>
          {status === 'idle' && (
            <p className="text-xs text-slate-400 mt-1">
              {hasContext ? 'Ask about your report' : 'Ask a health question'}
            </p>
          )}
        </div>

        {/* Waveform dots when recording */}
        {status === 'recording' && (
          <div className="flex items-end gap-1.5 h-8">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="w-1.5 bg-red-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.1}s`, height: `${[60, 100, 80, 100, 60][i]}%` }}
              />
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 mt-4 text-center">
        Not a substitute for professional medical advice. Always consult a healthcare provider.
      </p>
    </div>
  );
};

export default VoiceAgent;
