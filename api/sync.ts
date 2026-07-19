import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Redis } from '@upstash/redis';

function isAuthorized(req: any): boolean {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return true;
  const provided = req.headers['x-sync-secret'];
  return provided === secret;
}

const envPath = path.resolve(process.cwd(), '.env');
const envLocalPath = path.resolve(process.cwd(), '.env.local');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Key duy nhất trong Redis lưu toàn bộ data của app (vì chỉ 1 user dùng).
const DATA_KEY = 'macro_master_data_v1';

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}


export default async function handler(req: any, res: any) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const redis = getRedis();
  if (!redis) {
    return res.status(500).json({ error: 'Chưa cấu hình UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN' });
  }

  try {
    if (req.method === 'GET') {
      const data = await redis.get(DATA_KEY);
      return res.status(200).json({ data: data || null });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'Body không hợp lệ' });
      }
      await redis.set(DATA_KEY, body);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).send('Method not allowed');
  } catch (error) {
    console.error('[API SYNC]', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}