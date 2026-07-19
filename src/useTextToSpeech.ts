// src/useTextToSpeech.ts
import { useState, useRef, useCallback } from 'react';
import { authHeaders } from './apiAuth';

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
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        // Backend đã chuẩn hoá lỗi ElevenLabs thành { reason, message } — map sang câu dễ hiểu.
        let reason = 'unknown';
        let detail = '';
        try {
          const errJson = await res.json();
          reason = errJson.reason || 'unknown';
          detail = errJson.message || '';
        } catch {
          detail = await res.text().catch(() => '');
        }

        const FRIENDLY_MESSAGES: Record<string, string> = {
          rate_limited: 'ElevenLabs đang bị giới hạn tốc độ gọi (quá nhiều request cùng lúc) — đợi vài giây rồi thử lại.',
          quota_exceeded: 'Đã hết credit ElevenLabs cho kỳ này — đợi qua kỳ mới hoặc nâng gói trên elevenlabs.io.',
          invalid_key: 'API key ElevenLabs không hợp lệ hoặc hết hạn — kiểm tra lại biến ELEVENLABS_API_KEY trên Vercel.',
          unknown: `Không đọc được (lỗi ${res.status})${detail ? ': ' + detail.slice(0, 100) : ''}`,
        };

        throw new Error(FRIENDLY_MESSAGES[reason] || FRIENDLY_MESSAGES.unknown);
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