const express = require('express');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const cors = require('cors');

const cacheMiddleware = require('./middlewares/cacheMiddleware');
const rateLimitMiddleware = require('./middlewares/rateLimitMiddleware');
const authMiddleware = require('./middlewares/authMiddleware');
const circuitBreakerMiddleware = require('./middlewares/circuitBreaker/middleware');
const services = require('./config/servicesConfig');

const httpLoggerMiddleware = require('./middlewares/httpLoggerMiddleware');

dotenv.config();

const app = express();
const PORT = process.env.LOCAL_PORT || 3002;

// Middleware de monitoreo (primero para medir todo)
app.use(httpLoggerMiddleware);

// Habilitar CORS para permitir peticiones desde el frontend
app.use(cors({
  origin: 'http://localhost:8080',
  credentials: true
}));

// Middleware para analizar JSON
app.use(bodyParser.json({ limit: '10mb' })); // Ajusta el límite si necesitas más
app.use(bodyParser.urlencoded({ extended: true }));
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  req.on('aborted', () => {
    console.error('Request aborted by the client');
  });
  next();
});

const { createProxyMiddleware } = require('http-proxy-middleware');

// Healthcheck endpoint para Docker (sin autenticación)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'api-gateway' });
});

// Proxy para Streaming de Insights (SSE) - Bypass del Circuit Breaker standard
app.use('/api/insights/stream', authMiddleware, createProxyMiddleware({
  target: 'http://api-insights:3600',
  changeOrigin: true,
  pathRewrite: {
    '^/api/insights/stream': '/api/insights/stream',
  },
}));

app.use('/api/auth', circuitBreakerMiddleware(services));
app.use(rateLimitMiddleware);
app.use(authMiddleware);
app.use('/api', rateLimitMiddleware, cacheMiddleware, authMiddleware, circuitBreakerMiddleware(services));

app.listen(PORT, () => {
  console.log(`API Gateway running on http://localhost:${PORT}`);
});