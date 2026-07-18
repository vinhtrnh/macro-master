export function isAuthorized(req: any): boolean {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return true;
  const provided = req.headers['x-sync-secret'];
  return provided === secret;
}