const { promClient } = require('./metrics');

function registerMonitoringRoutes(app) {
  app.get('/metrics', async (req, reply) => {
    const token = process.env.METRICS_TOKEN;
    if (token) {
      const h = req.headers['authorization'] || '';
      const ok = String(h) === `Bearer ${token}`;
      if (!ok) {
        reply.code(401);
        return { error: 'unauthorized' };
      }
    }
    reply.header('Content-Type', promClient.register.contentType);
    return promClient.register.metrics();
  });
}

module.exports = { registerMonitoringRoutes };
