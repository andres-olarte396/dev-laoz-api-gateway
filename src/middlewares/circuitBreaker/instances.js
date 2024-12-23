const CircuitBreaker = require('opossum');
const axios = require('axios');
const config = require('./config');

const circuitBreakers = new Map();

// Función para realizar solicitudes con Axios
const axiosRequest = async ({ url, method, data, headers }) => {
  return axios({ url, method, data, headers });
};

// Crear o recuperar una instancia de Circuit Breaker
const getCircuitBreaker = (serviceName) => {
  if (!circuitBreakers.has(serviceName)) {
    const breaker = new CircuitBreaker(axiosRequest, config);

    breaker.fallback(() => ({
      error: `Service ${serviceName} is currently unavailable. Please try again later.`,
    }));

    breaker.on('open', () => {
      console.warn(`Circuit for ${serviceName} is now OPEN.`);
    });

    breaker.on('close', () => {
      console.info(`Circuit for ${serviceName} has CLOSED.`);
    });

    circuitBreakers.set(serviceName, breaker);
  }

  return circuitBreakers.get(serviceName);
};

module.exports = {
  getCircuitBreaker,
};
