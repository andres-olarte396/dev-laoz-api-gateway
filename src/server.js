const express = require('express');
const dotenv = require('dotenv');
const services = require('./config/servicesConfig');
const authMiddleware = require('./middlewares/authMiddleware');
const rateLimitMiddleware = require('./middlewares/rateLimitMiddleware');
const circuitBreakerMiddleware = require('./middlewares/circuitBreaker/middleware');
const cacheMiddleware = require('./middlewares/cacheMiddleware');

dotenv.config();

const app = express();
const PORT = process.env.LOCAL_PORT || 3001;

app.use(express.json());
app.use(rateLimitMiddleware);
app.use(authMiddleware);
app.use('/api', rateLimitMiddleware, cacheMiddleware, circuitBreakerMiddleware(services));

app.listen(PORT, () => {
  console.log(`API Gateway running on http://localhost:${PORT}`);
});