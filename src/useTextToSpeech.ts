// src/useTextToSpeech.ts
import { useState, useRef, useCallback } from 'react';

export function useTextToSpeech() {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(async (text: string) => {
    // Nếu đang phát bài khác, dừng lại trước
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        // Đọc lỗi trả về từ serverless function (đã forward nguyên lỗi ElevenLabs)
        const errText = await res.text();
        throw new Error(`Lỗi ${res.status}: ${errText.slice(0, 100)}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url); // giải phóng bộ nhớ sau khi phát xong
      };

      await audio.play();
      setIsPlaying(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không đọc được, thử lại sau');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { speak, isLoading, isPlaying, error };
}