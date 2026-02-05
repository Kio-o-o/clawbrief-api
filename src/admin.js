function requireAdmin(req, reply) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    reply.code(500);
    return { ok: false, error: 'admin_not_configured' };
  }
  const h = req.headers['x-admin-token'] || req.headers['X-Admin-Token'];
  if (!h || String(h) !== String(token)) {
    reply.code(403);
    return { ok: false, error: 'forbidden' };
  }
  return null;
}

module.exports = { requireAdmin };
