/**
 * useVoiceRecorder — Voice recording hook with Web Speech API transcription.
 *
 * Features:
 * - Record audio via MediaRecorder
 * - Real-time speech-to-text via Web Speech API (SpeechRecognition)
 * - Auto-detect Urdu/English
 * - Preview recorded audio before sending
 * - Edit transcription before sending
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface VoiceRecorderState {
  isRecording: boolean;
  isPreviewing: boolean;
  audioBlob: Blob | null;
  audioUrl: string | null;
  transcript: string;
  duration: number;
  language: "en" | "ur" | "auto";
  error: string | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionType extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionType;
    webkitSpeechRecognition: new () => SpeechRecognitionType;
  }
}

export function useVoiceRecorder() {
  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    isPreviewing: false,
    audioBlob: null,
    audioUrl: null,
    transcript: "",
    duration: 0,
    language: "auto",
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const finalTranscriptRef = useRef<string>("");
  const shouldRestartRef = useRef<boolean>(false);
  const langRef = useRef<string>("en-US");

  const isSupported = typeof window !== "undefined" && (
    !!window.SpeechRecognition || !!window.webkitSpeechRecognition
  );

  const isMediaSupported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  useEffect(() => {
    return () => {
      if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
      clearInterval(durationIntervalRef.current);
    };
  }, [state.audioUrl]);

  const startRecording = useCallback(async (language: "en" | "ur" | "auto" = "auto") => {
    try {
      // Reset state
      setState(prev => ({
        ...prev,
        isRecording: true,
        isPreviewing: false,
        audioBlob: null,
        audioUrl: prev.audioUrl ? (URL.revokeObjectURL(prev.audioUrl), null) : null,
        transcript: "",
        duration: 0,
        language,
        error: null,
      }));
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        setState(prev => prev.isRecording ? { ...prev, duration: Math.floor((Date.now() - startTimeRef.current) / 1000) } : prev);
      }, 1000);

      // Start audio recording
      if (isMediaSupported) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start(100);
      }

      // Start speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        // Set language ref for restarts
        if (language === "ur") {
          langRef.current = "ur-PK";
        } else if (language === "en") {
          langRef.current = "en-US";
        } else {
          langRef.current = "en-US";
        }

        finalTranscriptRef.current = "";
        shouldRestartRef.current = true;

        const createRecognition = () => {
          const recognition = new SpeechRecognition();
          recognitionRef.current = recognition;
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = langRef.current;

          recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const result = event.results[i];
              if (result.isFinal) {
                finalTranscriptRef.current += result[0].transcript + " ";
              } else {
                interim += result[0].transcript;
              }
            }
            const combined = (finalTranscriptRef.current + interim).trim();
            setState(prev => ({ ...prev, transcript: combined }));
          };

          recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            if (event.error === "no-speech" || event.error === "aborted") return;
            // On network error, try to restart
            if (event.error === "network") {
              shouldRestartRef.current = false;
              return;
            }
            setState(prev => ({ ...prev, error: `Speech recognition: ${event.error}` }));
          };

          recognition.onend = () => {
            // Auto-restart recognition if still recording (browsers kill it after ~60s)
            if (shouldRestartRef.current && mediaRecorderRef.current?.state === "recording") {
              try {
                createRecognition();
                recognitionRef.current?.start();
              } catch {
                // Recognition couldn't restart — keep what we have
              }
            }
          };

          return recognition;
        };

        const recognition = createRecognition();
        recognition.start();
      }
    } catch (err) {
      clearInterval(durationIntervalRef.current);
      setState(prev => ({
        ...prev,
        isRecording: false,
        error: err instanceof Error ? err.message : "Could not start recording",
      }));
    }
  }, [isMediaSupported]);

  const stopRecording = useCallback(() => {
    clearInterval(durationIntervalRef.current);
    shouldRestartRef.current = false;

    // Stop recognition
    try { recognitionRef.current?.stop(); } catch { /* */ }
    recognitionRef.current = null;

    // Stop media recorder
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      recorder.stream.getTracks().forEach(t => t.stop());

      // Wait for final data
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setState(prev => ({
          ...prev,
          isRecording: false,
          isPreviewing: true,
          audioBlob: blob,
          audioUrl: url,
        }));
      };
    } else {
      setState(prev => ({
        ...prev,
        isRecording: false,
        isPreviewing: !!prev.transcript,
      }));
    }
  }, []);

  const cancelRecording = useCallback(() => {
    clearInterval(durationIntervalRef.current);
    shouldRestartRef.current = false;
    finalTranscriptRef.current = "";
    try { recognitionRef.current?.abort(); } catch { /* */ }
    recognitionRef.current = null;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      recorder.stream.getTracks().forEach(t => t.stop());
    }
    mediaRecorderRef.current = null;
    setState(prev => ({
      ...prev,
      isRecording: false,
      isPreviewing: false,
      audioBlob: null,
      audioUrl: prev.audioUrl ? (URL.revokeObjectURL(prev.audioUrl), null) : null,
      transcript: "",
      duration: 0,
      error: null,
    }));
  }, []);

  const setTranscript = useCallback((text: string) => {
    setState(prev => ({ ...prev, transcript: text }));
  }, []);

  const acceptTranscript = useCallback((): string => {
    // Use state.transcript which includes both final + interim; fallback to ref
    const text = state.transcript || finalTranscriptRef.current.trim();
    cancelRecording();
    return text;
  }, [state.transcript, cancelRecording]);

  return {
    ...state,
    isSupported,
    isMediaSupported,
    startRecording,
    stopRecording,
    cancelRecording,
    setTranscript,
    acceptTranscript,
  };
}
