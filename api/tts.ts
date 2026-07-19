import { useState, useCallback, useRef } from 'react';
import { authHeaders } from './apiAuth';

// Định nghĩa ép kiểu để TypeScript không la làng vụ SpeechRecognition
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

// Các lỗi mà đổi sang ElevenLabs Scribe (server-side, không phụ thuộc máy chủ nhận
// dạng của Google) có cơ hội cứu được. 'not-allowed'/'no-speech' là lỗi phía người
// dùng (chưa cấp quyền mic / không nói gì) — đổi API không giúp gì nên bỏ qua.
const FALLBACK_WORTHY_ERRORS = new Set(['network', 'audio-capture', 'service-not-allowed', 'aborted']);

export function useSpeechToText() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false); // đang gửi audio lên ElevenLabs xử lý
  const [recognizedText, setRecognizedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false); // true nếu lần ghi âm này dùng ElevenLabs thay vì browser

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // --- Fallback: ghi âm thô bằng MediaRecorder, gửi lên /api/stt (ElevenLabs Scribe) ---
  const startElevenLabsFallback = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        setIsTranscribing(true);
        streamRef.current?.getTracks().forEach((t) => t.stop());

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const res = await fetch('/api/stt', {
            method: 'POST',
            headers: authHeaders(),
            body: audioBlob,
          });
          if (!res.ok) throw new Error(`Scribe lỗi (${res.status})`);
          const data = await res.json();
          setRecognizedText(data.text || '');
        } catch (e: any) {
          setError(`Lỗi Scribe AI: ${e.message || e}`);
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setUsedFallback(true);
    } catch (e: any) {
      setError('Không truy cập được microphone.');
      setIsRecording(false);
    }
  }, []);

  const startRecording = useCallback(() => {
    setError(null);
    setRecognizedText(null);
    setUsedFallback(false);

    const win = window as IWindow;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    // Trình duyệt không có Web Speech API (vd Safari/iOS) -> dùng thẳng ElevenLabs Scribe
    if (!SpeechRecognition) {
      startElevenLabsFallback();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.interimResults = false; // Chỉ lấy kết quả cuối cùng cho chính xác
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      // Lấy thẳng dòng text mà trình duyệt vừa nghe được
      const transcript = event.results[0][0].transcript;
      setRecognizedText(transcript);
    };

    recognition.onerror = (event: any) => {
      if (FALLBACK_WORTHY_ERRORS.has(event.error)) {
        console.warn(`[STT] Web Speech API lỗi "${event.error}", chuyển sang ElevenLabs Scribe...`);
        startElevenLabsFallback();
        return;
      }
      setError(`Lỗi mic: ${event.error}`);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, [startElevenLabsFallback]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const cancelAudio = useCallback(() => {
    setRecognizedText(null);
  }, []);

  return {
    startRecording,
    stopRecording,
    cancelAudio,
    isRecording,
    isTranscribing, // optional: hiện "đang xử lý bằng AI..." nếu muốn
    usedFallback,   // optional: hiện badge "đã dùng ElevenLabs Scribe" nếu muốn
    recognizedText, // Lấy thẳng text ra, không cần chờ xử lý
    error
  };
}