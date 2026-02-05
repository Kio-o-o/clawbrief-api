const Sentry = require('@sentry/node');

function initSentry(app) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.ENVIRONMENT || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.05),
  });

  app.addHook('onError', async (req, reply, err) => {
    Sentry.captureException(err, {
      tags: {
        route: req.routerPath,
        method: req.method,
      },
      extra: {
        statusCode: reply.statusCode,
      },
    });
  });
}

module.exports = { initSentry };
