const rateLimit = require('express-rate-limit');

const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Limitar a 100 solicitudes por IP por ventana de tiempo
  message: {
    error: 'Too many requests, please try again later.'
  },
  standardHeaders: true, // Devuelve información de límite en los headers `RateLimit-*`
  legacyHeaders: false, // Desactiva los headers `X-RateLimit-*`
});

module.exports = rateLimitMiddleware;
