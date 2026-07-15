import { useState, useCallback, useRef } from 'react';

// Định nghĩa ép kiểu để TypeScript không la làng vụ SpeechRecognition
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export function useSpeechToText() {
  const [isRecording, setIsRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);

  const startRecording = useCallback(() => {
    setError(null);
    setRecognizedText(null);

    const win = window as IWindow;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Trình duyệt không hỗ trợ (Hãy dùng Chrome hoặc Edge nha fen).');
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
      setError(`Lỗi mic: ${event.error}`);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
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
    recognizedText, // Lấy thẳng text ra, không cần chờ xử lý
    error 
  };
}