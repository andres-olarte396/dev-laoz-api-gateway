const express = require('express');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');

const cacheMiddleware = require('./middlewares/cacheMiddleware');
const rateLimitMiddleware = require('./middlewares/rateLimitMiddleware');
const authMiddleware = require('./middlewares/authMiddleware');
const circuitBreakerMiddleware = require('./middlewares/circuitBreaker/middleware');
const services = require('./config/servicesConfig');

dotenv.config();

const app = express();
const PORT = process.env.LOCAL_PORT || 3002;

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
app.use('/api/auth', circuitBreakerMiddleware(services));
app.use(rateLimitMiddleware);
app.use(authMiddleware);
app.use('/api', rateLimitMiddleware, cacheMiddleware, authMiddleware, circuitBreakerMiddleware(services));

app.listen(PORT, () => {
  console.log(`API Gateway running on http://localhost:${PORT}`);
});