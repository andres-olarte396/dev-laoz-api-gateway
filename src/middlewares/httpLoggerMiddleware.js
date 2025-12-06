const logger = require('../config/logger');

const httpLoggerMiddleware = (req, res, next) => {
    const start = Date.now();
    const { method, originalUrl } = req;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Intercept response finish
    res.on('finish', () => {
        const durationMs = Date.now() - start;
        const statusCode = res.statusCode;

        // Log transaction
        logger.transaction(originalUrl, method, statusCode, durationMs); // Transaction métrica

        // Si es error, loguear detalle
        if (statusCode >= 400) {
            if (statusCode >= 500) {
                logger.error(`Gateway Error ${statusCode} on ${method} ${originalUrl}`, null, { ip, durationMs });
            } else {
                logger.info(`Gateway Warning ${statusCode} on ${method} ${originalUrl}`, { ip, durationMs });
            }
        }
    });

    next();
};

module.exports = httpLoggerMiddleware;
