const client = require('prom-client');

client.collectDefaultMetrics();

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20],
});

const creditsCharged = new client.Counter({
  name: 'clawbrief_credits_charged_total',
  help: 'Total credits charged',
  labelNames: ['source_kind', 'mimetype'],
});

const creditsToppedUp = new client.Counter({
  name: 'clawbrief_credits_topped_up_total',
  help: 'Total credits topped up',
  labelNames: ['asset', 'chain'],
});

module.exports = {
  promClient: client,
  httpRequestDuration,
  creditsCharged,
  creditsToppedUp,
};
