
import React, { useState, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { Conversation } from './components/Conversation';
import { Controls } from './components/Controls';
import type { LiveSession } from '@google/genai';
import { startLiveSession } from './services/geminiService';
import type { TranscriptEntry } from './types';
import { Status } from './types';

const App: React.FC = () => {
  const [status, setStatus] = useState<Status>(Status.Idle);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [micVolume, setMicVolume] = useState(0);
  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);

  // Refs for audio analysis
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const cleanupAudioAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setMicVolume(0);
  }, []);

  const onMessage = useCallback((newEntry: TranscriptEntry) => {
    setTranscript(prev => {
        const lastEntry = prev[prev.length - 1];
        if (lastEntry && lastEntry.id === newEntry.id) {
          const updated = [...prev];
          updated[prev.length - 1] = newEntry;
          return updated;
        } else {
          return [...prev, newEntry];
        }
    });
  }, []);

  const onTurnComplete = useCallback(() => {
    // This could be used to finalize a turn, e.g., save it.
  }, []);

  const onError = useCallback((error: Error) => {
    console.error('AI session error:', error);
    setStatus(Status.Error);
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close());
        sessionPromiseRef.current = null;
    }
    cleanupAudioAnalysis();
  }, [cleanupAudioAnalysis]);
  
  const onClose = useCallback(() => {
    setStatus(Status.Idle);
    cleanupAudioAnalysis();
  }, [cleanupAudioAnalysis]);

  const handleToggleSession = async () => {
    if (status === Status.Listening) {
      if (sessionPromiseRef.current) {
        setStatus(Status.Processing);
        const session = await sessionPromiseRef.current;
        session.close();
        sessionPromiseRef.current = null;
        // onClose will handle cleanup and status change to Idle
      }
    } else {
      setStatus(Status.Connecting);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Setup audio analysis
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        const sourceNode = audioContext.createMediaStreamSource(stream);
        sourceNodeRef.current = sourceNode;
        const analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 256;
        analyserRef.current = analyserNode;
        sourceNode.connect(analyserNode);

        const dataArray = new Uint8Array(analyserNode.frequencyBinCount);

        const draw = () => {
            if (analyserRef.current) {
                analyserRef.current.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
                const normalizedVolume = Math.min(average / 128, 1);
                setMicVolume(normalizedVolume);
                animationFrameRef.current = requestAnimationFrame(draw);
            }
        };
        draw();

        sessionPromiseRef.current = startLiveSession({ onMessage, onTurnComplete, onError, onClose }, stream);
        await sessionPromiseRef.current;
        setStatus(Status.Listening);
      } catch (error) {
        console.error('Failed to start session:', error);
        setStatus(Status.Error);
        cleanupAudioAnalysis();
      }
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 to-black text-white min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow flex flex-col p-4 md:p-8 container mx-auto">
        <Conversation transcript={transcript} />
      </main>
      <footer className="sticky bottom-0 bg-black/50 backdrop-blur-md p-4">
        <Controls status={status} onToggle={handleToggleSession} micVolume={micVolume} />
        <p className="text-center text-xs text-gray-500 mt-4">
          Powered by J.Perez Marketing Solutions
        </p>
      </footer>
    </div>
  );
};

export default App;
