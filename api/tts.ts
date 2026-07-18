// api/tts.ts
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { isAuthorized } from './_auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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

  const audioBuffer = await elevenRes.arrayBuffer();
  res.setHeader('Content-Type', 'audio/mpeg');
  return res.status(200).send(Buffer.from(audioBuffer));
}