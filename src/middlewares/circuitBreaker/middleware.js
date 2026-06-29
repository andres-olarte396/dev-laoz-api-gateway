const { getCircuitBreaker } = require('./instances');

const resolveService = (services, req) => {
  const fullPath = `${req.baseUrl || ''}${req.path}`;
  const method = req.method.toUpperCase();

  const matches = Object.entries(services)
    .filter(([, service]) => service.methods?.includes(method))
    .map(([serviceName, service]) => {
      const basePath = service.path.includes('/:')
        ? service.path.slice(0, service.path.indexOf('/:'))
        : service.path;

      const matched = fullPath === service.path
        || fullPath === basePath
        || fullPath.startsWith(`${basePath}/`);

      if (!matched) {
        return null;
      }

      return { serviceName, service, basePath, fullPath };
    })
    .filter(Boolean)
    .sort((left, right) => right.basePath.length - left.basePath.length);

  return matches[0] || null;
};

// Middleware del Circuit Breaker
const circuitBreakerMiddleware = (services) => async (req, res, next) => {
  const resolved = resolveService(services, req);

  if (!resolved) {
    return res.status(404).json({ error: `Service not found for ${req.method} ${req.baseUrl || ''}${req.path}` });
  }

  const { serviceName, service, basePath, fullPath } = resolved;
  const serviceUrl = service.target;
  const suffix = fullPath.slice(basePath.length);

  const circuitBreaker = getCircuitBreaker(serviceName);

  try {
    // Preparar la solicitud para el microservicio
    const request = {
      url: serviceUrl + suffix,
      params: req.query,
      method: req.method,
      data: req.body,
      headers: {
        ...req.headers,
        host: serviceUrl.replace(/^https?:\/\//, '')
      },
    };

    const response = await circuitBreaker.fire(request);
    return res.status(response?.status || 200).json(response?.data);
  } catch (error) {
    console.error(`[Circuit Breaker] Error al llamar al servicio ${serviceName}:`, error.message);

    const statusCode = error.response?.status || 500;
    const errorData = error.response?.data || { error: 'Error interno del servidor' };

    return res.status(statusCode).json(errorData);
  }
};

module.exports = circuitBreakerMiddleware;
