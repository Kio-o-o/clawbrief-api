function isProd() {
  return (process.env.ENVIRONMENT || process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function useDb() {
  // For Render, set DATABASE_URL => true
  return !!process.env.DATABASE_URL;
}

module.exports = { isProd, useDb };
