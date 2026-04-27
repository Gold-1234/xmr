import React, { useState, useRef } from 'react';
import {
  LiveKitRoom,
  VoiceAssistantControlBar,
  RoomAudioRenderer,
} from '@livekit/components-react';
import { Mic, MessageCircle, Loader2 } from 'lucide-react';
import '@livekit/components-styles';

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
  interpretation: "Low" | "Normal" | "High" | "Unknown";
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
}

// Main LiveKit Voice Agent Component
const VoiceAgent: React.FC<VoiceAgentProps> = ({ patientInfo, extractedTests, userId, userProfile }) => {
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
      // Backend generates the token AND dispatches the agent to the room
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

  if (!isConnected) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <MessageCircle className="mr-2 text-blue-600" />
            LiveKit AI Medical Assistant
          </h2>
        </div>

        <div className="text-center space-y-4">
          <div className="text-gray-600 mb-4">
            Connect to our LiveKit-powered AI Medical Assistant for real-time voice conversations about your health.
          </div>

          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-xl transition duration-200 inline-flex items-center gap-3 disabled:opacity-50"
          >
            {isConnecting ? (
              <Loader2 className="animate-spin w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
            {isConnecting ? 'Connecting...' : 'Connect to LiveKit Assistant'}
          </button>

          {connectionError && (
            <div className="text-red-600 text-sm mt-2">
              {connectionError}
            </div>
          )}

          <div className="text-sm text-gray-500 mt-4">
            <p>• Real-time voice conversations</p>
            <p>• WebRTC-powered audio</p>
            <p>• Medical report analysis</p>
            <p>• Professional AI responses</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center">
          <MessageCircle className="mr-2 text-blue-600" />
          LiveKit AI Medical Assistant
        </h2>
        <button
          onClick={handleDisconnect}
          className="text-sm text-red-600 hover:text-red-700 underline"
        >
          Disconnect
        </button>
      </div>

      {/* LiveKit Room Connection */}
      <div className="bg-blue-50 rounded-lg p-4">
        <div className="text-center text-blue-800">
          <h3 className="font-semibold mb-2">🎙️ LiveKit Voice Agent Active</h3>
          <p className="text-sm mb-4">
            Connected to LiveKit room. Agent will respond automatically to voice input.
          </p>
          <div className="text-xs text-blue-600">
            <p>• Real-time voice conversations</p>
            <p>• Medical AI assistant ready</p>
            <p>• Auto language detection</p>
          </div>
        </div>

        {/* LiveKit Room Component */}
        <div className="mt-4">
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
    </div>
  );
};

export default VoiceAgent;
