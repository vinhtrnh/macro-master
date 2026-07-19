// api/stt.ts
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  api: { bodyParser: false }, // audio là binary, tắt body parser mặc định của Vercel để đọc raw stream
};

function isAuthorized(req: any): boolean {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return true;
  const provided = req.headers['x-sync-secret'];
  return provided === secret;
}

export default async function handler(req: any, res: any) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  // Gom toàn bộ audio chunk gửi lên thành 1 Buffer
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk);
  const audioBuffer = Buffer.concat(chunks);

  // ElevenLabs STT cần multipart/form-data — dùng FormData chuẩn Node 18+
  const form = new FormData();
  form.append('model_id', 'scribe_v1');
  form.append('file', new Blob([audioBuffer], { type: 'audio/webm' }), 'recording.webm');

  const elevenRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY || '' },
    body: form,
  });

  if (!elevenRes.ok) {
    const errBody = await elevenRes.text();
    return res.status(elevenRes.status).send(errBody);
  }

  const data = await elevenRes.json();
  return res.status(200).json({ text: data.text });
}