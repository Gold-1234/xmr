import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, MessageCircle } from 'lucide-react';

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onend: () => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

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

const VoiceAgent: React.FC<VoiceAgentProps> = ({ patientInfo, extractedTests }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{type: 'user' | 'agent', message: string, timestamp: Date}>>([]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5019';

  useEffect(() => {
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const result = event.results[0][0].transcript;
        setTranscript(result);
        handleUserMessage(result);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
    }

    // Initialize speech synthesis
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      setTranscript('');
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const speakResponse = (text: string) => {
    if (synthRef.current) {
      setIsSpeaking(true);

      // Cancel any ongoing speech
      synthRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9; // Slightly slower for clarity
      utterance.pitch = 1;
      utterance.volume = 0.8;

      utterance.onend = () => {
        setIsSpeaking(false);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
      };

      synthRef.current.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const handleUserMessage = async (message: string) => {
    if (!message.trim()) return;

    // Add user message to chat history
    const userMessage = {
      type: 'user' as const,
      message: message,
      timestamp: new Date()
    };
    setChatHistory(prev => [...prev, userMessage]);

    setIsLoading(true);

    try {
      const response = await fetch(`${backendUrl}/voice-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          report_data: {
            patient: patientInfo,
            tests: extractedTests
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from voice agent');
      }

      const data = await response.json();

      // Add agent response to chat history
      const agentMessage = {
        type: 'agent' as const,
        message: data.response,
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, agentMessage]);

      // Speak the response
      speakResponse(data.response);

    } catch (error) {
      console.error('Voice chat error:', error);
      const errorMessage = {
        type: 'agent' as const,
        message: 'I\'m sorry, I\'m having trouble connecting right now. Please try again or consult with your healthcare provider.',
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, errorMessage]);
      speakResponse(errorMessage.message);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setChatHistory([]);
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center">
          <MessageCircle className="mr-2 text-blue-600" />
          AI Voice Assistant
        </h2>
        {chatHistory.length > 0 && (
          <button
            onClick={clearChat}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Clear Chat
          </button>
        )}
      </div>

      {/* Voice Controls */}
      <div className="flex items-center justify-center space-x-4 mb-4">
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isLoading || isSpeaking}
          className={`flex items-center justify-center w-16 h-16 rounded-full transition-all ${
            isListening
              ? 'bg-red-500 hover:bg-red-600 animate-pulse'
              : 'bg-blue-500 hover:bg-blue-600'
          } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isListening ? <MicOff size={24} /> : <Mic size={24} />}
        </button>

        <button
          onClick={stopSpeaking}
          disabled={!isSpeaking}
          className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-500 hover:bg-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <VolumeX size={20} />
        </button>
      </div>

      {/* Status and Transcript */}
      <div className="text-center mb-4">
        {isListening && (
          <div className="text-red-600 font-medium animate-pulse">
            🎤 Listening... Speak your question about the report
          </div>
        )}
        {isSpeaking && (
          <div className="text-blue-600 font-medium">
            🔊 Speaking response...
          </div>
        )}
        {isLoading && (
          <div className="text-gray-600 font-medium">
            🤔 Processing your question...
          </div>
        )}
        {transcript && !isListening && !isLoading && (
          <div className="text-gray-700 bg-gray-50 p-2 rounded-lg">
            You said: "{transcript}"
          </div>
        )}
      </div>

      {/* Chat History */}
      {chatHistory.length > 0 && (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {chatHistory.map((chat, index) => (
            <div
              key={index}
              className={`flex ${chat.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  chat.type === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                <div className="text-sm">{chat.message}</div>
                <div className={`text-xs mt-1 ${
                  chat.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {chat.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <div className="text-sm text-blue-800">
          <strong>How to use:</strong>
          <ul className="mt-1 space-y-1">
            <li>• Click the microphone to start voice chat</li>
            <li>• Ask questions about your test results, health summary, or recommendations</li>
            <li>• Examples: "What does my hemoglobin mean?", "Are my cholesterol levels okay?", "What should I do about the high glucose?"</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VoiceAgent;