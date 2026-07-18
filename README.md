# macro-master

App tính macro cá nhân.

## Setup Cloud Sync (lưu data lên server, dùng chung nhiều thiết bị)

Data (profile, food database, log ăn theo ngày) được đồng bộ qua Upstash Redis (free tier) thông qua `/api/sync`.

1. Tạo tài khoản free tại https://upstash.com → tạo 1 Redis database (chọn region gần VN, ví dụ Singapore).
2. Vào tab "REST API" của database vừa tạo, copy `UPSTASH_REDIS_REST_URL` và `UPSTASH_REDIS_REST_TOKEN`.
3. Trên Vercel project → Settings → Environment Variables, thêm:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `SYNC_SECRET` — tự đặt 1 chuỗi bí mật bất kỳ.
   - `VITE_SYNC_SECRET` — đặt **giống hệt** giá trị `SYNC_SECRET` ở trên (frontend cần gửi kèm khi gọi API).
4. Redeploy. Chấm tròn nhỏ cạnh logo trên header: xanh = đã sync, vàng = đang tải, đỏ = mất kết nối server (app vẫn chạy bình thường bằng localStorage).

Nếu chưa cấu hình `SYNC_SECRET`/`VITE_SYNC_SECRET`, API vẫn hoạt động nhưng không có lớp bảo vệ (ai biết URL cũng ghi đè được data) — nên set cho chắc vì app deploy public trên Vercel.
