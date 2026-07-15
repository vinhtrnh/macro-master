import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Bắt buộc load bằng mọi giá từ thư mục gốc
const envPath = path.resolve(process.cwd(), '.env');
const envLocalPath = path.resolve(process.cwd(), '.env.local');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const profileId = req.query?.profileId || '1';
    const requestedDate = req.query?.date; // Nhận biến ngày từ Frontend
    
    const db1 = process.env.NOTION_DATABASE_1_ID || process.env.NOTION_DB_1;
    const db2 = process.env.NOTION_DATABASE_2_ID || process.env.NOTION_DB_2;
    const token = process.env.NOTION_TOKEN;

    const DATABASE_ID = profileId === '2' ? db2 : db1;

    if (!DATABASE_ID || !token) {
      return res.status(500).json({ error: 'Chưa cấu hình Notion DB ID hoặc Token' });
    }

    const HEADERS = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    };

    // Chốt ngày: Ưu tiên ngày gửi từ web lên, nếu không có thì tính giờ VN (UTC+7)
    const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const todayISO = now.toISOString().split('T')[0];
    const targetDate = requestedDate || todayISO;
    
    console.log(`[API LỊCH TẬP] Quét Notion ngày: ${targetDate} cho User ${profileId}...`);

    const queryRes = await fetch(
      `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
      {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          // Cắm targetDate vào đây để Notion lọc bài chuẩn
          filter: { property: 'Date', date: { equals: targetDate } },
        }),
      }
    );

    if (!queryRes.ok) {
      const err = await queryRes.text();
      return res.status(queryRes.status).send(err);
    }

    const queryData = await queryRes.json();
    const page = queryData.results?.[0];

    if (!page) {
      return res.status(200).json({ found: false });
    }

    const title = page.properties?.Name?.title?.[0]?.plain_text || 'Buổi tập hôm nay';

    const blocksRes = await fetch(
      `https://api.notion.com/v1/blocks/${page.id}/children?page_size=100`,
      { headers: HEADERS }
    );
    const blocksData = await blocksRes.json();

    const lines: string[] = (blocksData.results || [])
      .map((b: any) => {
        const rich = b[b.type]?.rich_text || [];
        return rich.map((t: any) => t.plain_text).join('');
      })
      .filter((line: string) => line.trim().length > 0);

    // Trả về kèm theo đúng cái ngày mà người dùng đang xem
    return res.status(200).json({ found: true, title, date: targetDate, lines });

  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}