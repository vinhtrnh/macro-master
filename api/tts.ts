// api/tts.ts
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { Redis } from '@upstash/redis';

// Ép dotenv load ĐÚNG file .env ở gốc project, bất kể vercel dev
// đang chạy function từ thư mục nào
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function isAuthorized(req: any): boolean {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return true;
  const provided = req.headers['x-sync-secret'];
  return provided === secret;
}

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24h — đủ cho các câu lặp lại trong ngày (mục tiêu tập, đánh giá...)

export default async function handler(req: any, res: any) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const { text, voiceId } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Thiếu nội dung text' });
  }

  const safeText = text.slice(0, 2000);
  const voice = voiceId || '21m00Tcm4TlvDq8ikWAM';

  // --- CACHE: text + voice giống hệt trước đó thì trả lại audio cũ, khỏi tốn credit ElevenLabs ---
  const cacheKey = 'tts_cache:' + crypto.createHash('sha256').update(`${voice}::${safeText}`).digest('hex');
  const redis = getRedis();

  if (redis) {
    try {
      const cached = await redis.get<string>(cacheKey);
      if (cached) {
        const audioBuffer = Buffer.from(cached, 'base64');
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).send(audioBuffer);
      }
    } catch (e) {
      console.warn('[TTS CACHE] Lỗi đọc cache, tiếp tục gọi ElevenLabs bình thường.', e);
    }
  }

  const elevenRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: safeText,
        model_id: 'eleven_flash_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );

  if (!elevenRes.ok) {
    const errBody = await elevenRes.text();
    return res.status(elevenRes.status).send(errBody);
  }

  const audioBuffer = Buffer.from(await elevenRes.arrayBuffer());

  if (redis) {
    try {
      await redis.set(cacheKey, audioBuffer.toString('base64'), { ex: CACHE_TTL_SECONDS });
    } catch (e) {
      console.warn('[TTS CACHE] Lỗi ghi cache (không ảnh hưởng người dùng).', e);
    }
  }

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('X-Cache', 'MISS');
  return res.status(200).send(audioBuffer);
}