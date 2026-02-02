import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  LiveKitRoom,
  VoiceAssistantControlBar,
  useToken,
  useRoomContext,
} from '@livekit/components-react';
import { Mic, MicOff, MessageCircle, Loader2, Phone, PhoneOff } from 'lucide-react';
import '@livekit/components-styles';
import { Room, RoomEvent } from 'livekit-client';

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
}

// Generate proper JWT token for LiveKit using crypto API
const generateLiveKitToken = async (apiKey: string, apiSecret: string, roomName: string, identity: string) => {
  try {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const payload = {
      iss: apiKey,
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      nbf: Math.floor(Date.now() / 1000),
      sub: identity,
      name: 'Medical Assistant User',
      video: {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
      // Auto-dispatch medical assistant agent when user joins
      roomConfig: {
        agents: [{
          agentName: '',
          metadata: 'medical-ai-assistant'
        }]
      }
    };

    // Encode header and payload
    const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    // Create signing input
    const signingInput = `${headerB64}.${payloadB64}`;

    // Create HMAC-SHA256 signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiSecret);
    const signingData = encoder.encode(signingInput);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, signingData);

    // Convert signature to base64url
    const signatureArray = new Uint8Array(signature);
    let signatureB64 = btoa(String.fromCharCode(...signatureArray));
    signatureB64 = signatureB64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    return `${headerB64}.${payloadB64}.${signatureB64}`;
  } catch (error) {
    console.error('Token generation failed:', error);
    return null;
  }
};

// Cartesia TTS/STT Voice Assistant Component
function MedicalVoiceAssistant({ patientInfo, extractedTests }: VoiceAgentProps) {
  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState('auto');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const cartesiaApiKey = import.meta.env.VITE_CARTESIA_API_KEY;

  // Start recording for STT
  const startRecording = async () => {
    try {
      console.log('🎤 CARTESIA LOG: Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        console.log('🎤 CARTESIA LOG: Recording stopped, audio blob created');
        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
      console.log('🎤 CARTESIA LOG: Recording started');
    } catch (error) {
      console.error('🎤 CARTESIA LOG: Failed to start recording:', error);
      alert('Microphone access denied. Please allow microphone permissions.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      console.log('🎤 CARTESIA LOG: Recording stopped');
    }
  };

  // Convert speech to text using Cartesia STT
  const processSpeechToText = async (audioBlob: Blob) => {
    if (!cartesiaApiKey) {
      console.error('🎤 CARTESIA LOG: Cartesia API key not found');
      return null;
    }

    try {
      console.log('🎤 CARTESIA LOG: Sending audio to Cartesia STT...');

      // Convert blob to base64 for Cartesia API
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      const response = await fetch('https://api.cartesia.ai/stt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': cartesiaApiKey,
          'Cartesia-Version': '2024-06-10',
        },
        body: JSON.stringify({
          audio: base64Audio,
          model: 'nova-2-general',
          language: 'auto', // Auto language detection
        }),
      });

      console.log('🎤 CARTESIA LOG: STT response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        const transcribedText = result.text || result.transcription;
        const detectedLang = result.language || 'en';

        console.log('🎤 CARTESIA LOG: STT successful');
        console.log('📝 CARTESIA LOG: Transcribed text:', transcribedText);
        console.log('🌍 CARTESIA LOG: Detected language:', detectedLang);

        setDetectedLanguage(detectedLang);
        return transcribedText;
      } else {
        const errorText = await response.text();
        console.error('🎤 CARTESIA LOG: STT failed:', response.status, response.statusText);
        console.error('🎤 CARTESIA LOG: Error response:', errorText);
        return null;
      }
    } catch (error) {
      console.error('🎤 CARTESIA LOG: STT error:', error);
      return null;
    }
  };

  // Convert text to speech using Cartesia TTS
  const speakWithCartesia = async (text: string) => {
    if (!cartesiaApiKey) {
      console.error('🔊 CARTESIA LOG: Cartesia API key not found');
      return;
    }

    try {
      console.log('🔊 CARTESIA LOG: Requesting TTS from Cartesia...');
      console.log('📝 CARTESIA LOG: Text to speak:', text.substring(0, 100) + '...');
      console.log('🌍 CARTESIA LOG: Language:', detectedLanguage);

      const response = await fetch('https://api.cartesia.ai/tts/bytes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': cartesiaApiKey,
          'Cartesia-Version': '2024-06-10',
        },
        body: JSON.stringify({
          model_id: 'sonic-english', // Use English model, can be switched based on language
          transcript: text,
          voice: {
            mode: 'id',
            id: 'professional-female-medical' // Custom voice for medical assistant
          },
          output_format: {
            container: 'wav',
            encoding: 'pcm_s16le',
            sample_rate: 44100
          }
        }),
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        console.log('🔊 CARTESIA LOG: TTS successful, audio blob received');

        // Play the audio
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.onplay = () => {
          setIsPlaying(true);
          console.log('🔊 CARTESIA LOG: Audio playback started');
        };

        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
          console.log('🔊 CARTESIA LOG: Audio playback ended');
        };

        audio.onerror = (error) => {
          console.error('🔊 CARTESIA LOG: Audio playback error:', error);
          setIsPlaying(false);
        };

        await audio.play();
      } else {
        console.error('🔊 CARTESIA LOG: TTS failed:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('🔊 CARTESIA LOG: Error details:', errorText);
      }
    } catch (error) {
      console.error('🔊 CARTESIA LOG: TTS error:', error);
    }
  };

  // Handle voice recording completion
  const handleRecordingComplete = async () => {
    if (audioBlob) {
      const transcribedText = await processSpeechToText(audioBlob);
      if (transcribedText) {
        // Send transcribed text to AI
        await handleTextSubmit(null, transcribedText);
      }
    }
  };

  // Handle form submission (text input)
  const handleTextSubmit = async (e: React.FormEvent | null, voiceText?: string) => {
    if (e) e.preventDefault();

    const messageToSend = voiceText || textInput;
    if (!messageToSend.trim()) return;

    console.log('💬 AI LOG: Sending message to medical assistant:', messageToSend.substring(0, 100) + '...');

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/voice-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageToSend,
          report_data: patientInfo || extractedTests.length > 0 ? {
            patient: patientInfo,
            tests: extractedTests
          } : null,
          context: patientInfo || extractedTests.length > 0 ? 'with_report' : 'general_health',
          language: detectedLanguage
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🤖 AI LOG: Received response:', data.response.substring(0, 100) + '...');

        // Speak the response using Cartesia
        await speakWithCartesia(data.response);
      } else {
        console.error('🤖 AI LOG: Failed to get AI response:', response.status);
        await speakWithCartesia('Sorry, I\'m having trouble connecting right now. Please try again.');
      }
    } catch (error) {
      console.error('🤖 AI LOG: Error communicating with AI:', error);
      await speakWithCartesia('Sorry, I\'m having trouble connecting right now. Please try again.');
    }

    // Clear text input only if it was from text input (not voice)
    if (!voiceText) {
      setTextInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit(e);
    }
  };

  // Handle recording stop
  useEffect(() => {
    if (!isRecording && audioBlob) {
      handleRecordingComplete();
    }
  }, [isRecording, audioBlob]);

  return (
    <div className="space-y-4">
      {/* Voice Controls */}
      <div className="flex items-center justify-center gap-4 p-4 bg-blue-50 rounded-lg">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          <Mic className="w-5 h-5" />
          {isRecording ? 'Stop Recording' : 'Start Voice'}
        </button>

        {isPlaying && (
          <div className="flex items-center gap-2 text-green-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
            Speaking...
          </div>
        )}
      </div>

      {/* Language Detection Status */}
      <div className="text-center text-sm text-gray-600 mb-2">
        🌍 Language: {detectedLanguage === 'auto' ? 'Auto-detecting' : detectedLanguage.toUpperCase()}
      </div>

      {/* Text Input Fallback */}
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="text-xs text-gray-600 mb-2 font-medium">
          💬 Text Input (works with voice)
        </div>
        <form onSubmit={handleTextSubmit} className="flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your medical question..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!textInput.trim()}
            className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

// Main LiveKit Voice Agent Component
const VoiceAgent: React.FC<VoiceAgentProps> = ({ patientInfo, extractedTests }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const roomName = `medical-assistant-${Date.now()}`;

  const handleConnect = async () => {
    console.log('🎯 LIVEKIT LOG: Starting connection process...');
    setIsConnecting(true);
    setConnectionError(null);

    try {
      console.log('🔧 LIVEKIT LOG: Environment variables:');
      console.log('   VITE_LIVEKIT_URL:', import.meta.env.VITE_LIVEKIT_URL);
      console.log('   VITE_LIVEKIT_API_KEY:', import.meta.env.VITE_LIVEKIT_API_KEY ? 'Present' : 'Missing');
      console.log('   VITE_LIVEKIT_API_SECRET:', import.meta.env.VITE_LIVEKIT_API_SECRET ? 'Present' : 'Missing');

      console.log('🚀 LIVEKIT LOG: Attempting LiveKit connection...');
      console.log('🏠 LIVEKIT LOG: Room name:', roomName);
      console.log('🌐 LIVEKIT LOG: Server URL:', import.meta.env.VITE_LIVEKIT_URL);

      // Check if environment variables are set
      if (!import.meta.env.VITE_LIVEKIT_URL) {
        throw new Error('VITE_LIVEKIT_URL environment variable is not set');
      }
      if (!import.meta.env.VITE_LIVEKIT_API_KEY) {
        throw new Error('VITE_LIVEKIT_API_KEY environment variable is not set');
      }
      if (!import.meta.env.VITE_LIVEKIT_API_SECRET) {
        throw new Error('VITE_LIVEKIT_API_SECRET environment variable is not set');
      }

      console.log('🔑 LIVEKIT LOG: Generating JWT token...');
      const token = await generateLiveKitToken(
        import.meta.env.VITE_LIVEKIT_API_KEY,
        import.meta.env.VITE_LIVEKIT_API_SECRET,
        roomName,
        'user'
      );

      if (!token) {
        throw new Error('Failed to generate JWT token');
      }

      console.log('🎫 LIVEKIT LOG: Token generated successfully');
      console.log('📝 LIVEKIT LOG: Token length:', token.length);
      console.log('🔐 LIVEKIT LOG: Token preview:', token.substring(0, 50) + '...');

      // Store token for LiveKitRoom component
      setToken(token);

      // The LiveKitRoom component will handle the connection
      console.log('⚡ LIVEKIT LOG: Setting connection state to true...');
      setIsConnected(true);
      setIsConnecting(false);
      console.log('✅ LIVEKIT LOG: LiveKit connection initiated successfully');
      console.log('🎉 LIVEKIT LOG: Ready for voice interactions');

    } catch (error) {
      const err = error as Error;
      console.error('❌ LIVEKIT LOG: LiveKit connection failed with error:');
      console.error('   Error type:', err.constructor.name);
      console.error('   Error message:', err.message);
      console.error('   Error stack:', err.stack);
      console.error('   Full error object:', err);

      setIsConnecting(false);
      setConnectionError(`LiveKit Error: ${err.message}`);
      console.log('💥 LIVEKIT LOG: Connection process aborted due to error');
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setConnectionError(null);
    console.log('🔌 Disconnected from LiveKit');
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
            serverUrl={import.meta.env.VITE_LIVEKIT_URL}
            connectOptions={{ autoSubscribe: true }}
            audio={true}
            video={false}
          >
            <VoiceAssistantControlBar />
          </LiveKitRoom>
        </div>
      </div>

      {/* Medical Voice Assistant (Text-based for now) */}
      <MedicalVoiceAssistant patientInfo={patientInfo} extractedTests={extractedTests} />
    </div>
  );
};

export default VoiceAgent;
