const { getCircuitBreaker } = require('./instances');

// Middleware del Circuit Breaker
const circuitBreakerMiddleware = (services) => async (req, res, next) => {
  const serviceName = req.path.split('/')[1]; // Obtener el nombre del servicio desde la ruta
  const serviceUrl = services[serviceName]?.target;

  if (!serviceUrl) {
    return res.status(404).json({ error: `Service ${serviceName} not found` });
  }

  const circuitBreaker = getCircuitBreaker(serviceName);

  try {
    // Preparar la solicitud para el microservicio
    const request = {
      url: serviceUrl + req.path.replace('/' + serviceName, ''),
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
