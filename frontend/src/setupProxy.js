const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
      // Disable response buffering so SSE events stream through immediately
      onProxyRes(proxyRes) {
        // Prevent proxy from buffering chunks
        proxyRes.headers['cache-control'] = 'no-cache';
        proxyRes.headers['x-accel-buffering'] = 'no';
      },
    })
  );
};
