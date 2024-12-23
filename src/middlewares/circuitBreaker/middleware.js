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
    const response = await circuitBreaker.fire({
      url: serviceUrl + req.path.replace('/' + serviceName, ''),
      method: req.method,
      data: req.body,
      headers: req.headers,
    });

    return res.status(200).json(response.data);
  } catch (error) {
    return res.status(500).json(error);
  }
};

module.exports = circuitBreakerMiddleware;
