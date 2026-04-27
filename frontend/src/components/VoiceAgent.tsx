import React, { useState, useRef } from 'react';
import {
  LiveKitRoom,
  VoiceAssistantControlBar,
  RoomAudioRenderer,
} from '@livekit/components-react';
import { Mic, MessageCircle, Loader2 } from 'lucide-react';
import '@livekit/components-styles';
import { useAuth } from '../contexts/AuthContext';

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
  userId?: string;
  userProfile?: any;
  standalone?: boolean;
}

const VoiceAgent: React.FC<VoiceAgentProps> = ({
  patientInfo,
  extractedTests,
  userId: userIdProp,
  userProfile: userProfileProp,
  standalone = false,
}) => {
  const { user } = useAuth();
  const userId = userIdProp ?? user?.id;
  const userProfile = userProfileProp ?? user?.profile;
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const roomName = useRef(`medical-assistant-${Date.now()}`).current;

  const handleConnect = async () => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/livekit-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_name: roomName,
          identity: 'user',
          user_id: userId,
          user_profile: userProfile,
          patient_info: patientInfo,
          extracted_tests: extractedTests,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to get token from server');
      }

      const data = await response.json();
      setToken(data.token);
      setServerUrl(data.url);
      setIsConnected(true);
      setIsConnecting(false);
    } catch (error) {
      const err = error as Error;
      setIsConnecting(false);
      setConnectionError(`Connection error: ${err.message}`);
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setToken(null);
    setServerUrl(null);
    setConnectionError(null);
  };

  const hasContext = patientInfo || extractedTests.length > 0;

  if (standalone) {
    return (
      <div className="p-6 lg:p-8 max-w-lg mx-auto">
        <div className="mb-8">
          <h1 className="page-title">Voice Assistant</h1>
          <p className="text-muted mt-1">
            {hasContext
              ? 'Ask questions about your report results.'
              : 'Ask a general health question.'}
          </p>
        </div>

        {!isConnected ? (
          <div className="card p-10 flex flex-col items-center gap-6 text-center">
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className={`w-28 h-28 rounded-full flex items-center justify-center text-white transition-all duration-300 disabled:cursor-not-allowed
                ${isConnecting
                  ? 'bg-navy-800 opacity-70'
                  : 'bg-navy-800 hover:bg-navy-700 hover:shadow-[0_0_0_12px_rgba(15,23,42,0.08)]'
                }`}
            >
              {isConnecting ? (
                <Loader2 className="w-10 h-10 animate-spin" />
              ) : (
                <Mic className="w-10 h-10" />
              )}
            </button>
            <div>
              <p className="text-base font-medium text-slate-600">
                {isConnecting ? 'Connecting…' : 'Tap to connect'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {hasContext ? 'Ask about your report' : 'Ask a health question'}
              </p>
            </div>
            {connectionError && (
              <p className="text-sm text-red-600">{connectionError}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>Real-time voice</span>
              <span>·</span>
              <span>WebRTC-powered</span>
              <span>·</span>
              <span>Report-aware</span>
            </div>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                <span className="text-sm font-semibold text-slate-900">Voice Assistant Active</span>
              </div>
              <button
                onClick={handleDisconnect}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Disconnect
              </button>
            </div>
            <div className="p-6">
              <LiveKitRoom
                token={token || undefined}
                serverUrl={serverUrl || undefined}
                connectOptions={{ autoSubscribe: true }}
                audio={true}
                video={false}
              >
                <RoomAudioRenderer />
                <VoiceAssistantControlBar />
              </LiveKitRoom>
            </div>
          </div>
        )}

        <p className="text-xs text-slate-400 mt-4 text-center">
          Not a substitute for professional medical advice. Always consult a healthcare provider.
        </p>
      </div>
    );
  }

  // Embedded mode (used inside Report.tsx)
  if (!isConnected) {
    return (
      <div className="card p-5 border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-4 h-4 text-cyan-600" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Voice Assistant</div>
            <div className="text-xs text-slate-500 mt-0.5">Ask questions about your report using voice</div>
          </div>
        </div>
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-600 active:scale-[0.98] text-white text-sm font-medium py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConnecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
          {isConnecting ? 'Connecting…' : 'Start Voice Session'}
        </button>
        {connectionError && (
          <p className="text-xs text-red-600 mt-2 text-center">{connectionError}</p>
        )}
        <div className="mt-3 flex items-center justify-center gap-3 text-xs text-slate-400">
          <span>Real-time responses</span>
          <span>·</span>
          <span>Report-aware</span>
          <span>·</span>
          <span>Multilingual</span>
        </div>
      )}

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          <span className="text-sm font-semibold text-slate-900">Voice Assistant Active</span>
        </div>
        <button
          onClick={handleDisconnect}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
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
      </div>
      <div className="p-4">
        <LiveKitRoom
          token={token || undefined}
          serverUrl={serverUrl || undefined}
          connectOptions={{ autoSubscribe: true }}
          audio={true}
          video={false}
        >
          <RoomAudioRenderer />
          <VoiceAssistantControlBar />
        </LiveKitRoom>
      </div>
    </div>
  );
};

export default VoiceAgent;
