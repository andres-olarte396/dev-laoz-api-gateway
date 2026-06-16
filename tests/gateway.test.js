'use strict';

/**
 * Tests del API Gateway (dev-laoz-api-gateway)
 * Herramientas: Jest + Supertest
 * Estrategia: se mockean @dev-laoz/core, http-proxy-middleware, axios (para authMiddleware),
 *             y el circuit breaker para probar el enrutamiento, healthcheck,
 *             la estructura de configuracion y el comportamiento de autenticacion.
 */

// ─── Mocks globales ───────────────────────────────────────────────────────────

jest.mock('@dev-laoz/core', () => ({
  authMiddleware: (req, res, next) => next(),
  rateLimitMiddleware: (req, res, next) => next(),
  createSwaggerDocs: () => () => {},
  config: { loadRemoteSecrets: jest.fn().mockResolvedValue({}) },
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    transaction: jest.fn(),
  },
}));

// Mock de http-proxy-middleware para evitar llamadas reales a microservicios
jest.mock('http-proxy-middleware', () => ({
  createProxyMiddleware: jest.fn(() => (req, res, next) => {
    // Simula una respuesta proxy exitosa
    res.status(200).json({ proxied: true, path: req.path });
  }),
}));

// Mock de axios (usado por authMiddleware del gateway)
jest.mock('axios');
const axios = require('axios');

// Mock del circuit breaker: cada llamada al middleware enruta directamente
jest.mock('../src/middlewares/circuitBreaker/middleware', () =>
  () => (req, res, next) => {
    // Simula un proxy exitoso desde el circuit breaker
    res.status(200).json({ proxied: true, service: 'mocked-service' });
  }
);

// Mock del cache middleware (pass-through)
jest.mock('../src/middlewares/cacheMiddleware', () => (req, res, next) => next());

// ─── Setup de la app Express ─────────────────────────────────────────────────
// Cargamos el modulo de configuracion de servicios directamente para inspeccion
const servicesConfig = require('../src/config/servicesConfig');

// Construimos una app minima que replica server.js sin llamar a app.listen()
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const request = require('supertest');

const { rateLimitMiddleware } = require('@dev-laoz/core');
const cacheMiddleware = require('../src/middlewares/cacheMiddleware');
const authMiddleware = require('../src/middlewares/authMiddleware');
const circuitBreakerMiddleware = require('../src/middlewares/circuitBreaker/middleware');
const httpLoggerMiddleware = require('../src/middlewares/httpLoggerMiddleware');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.use(httpLoggerMiddleware);
app.use(cors({ origin: 'http://localhost:8080', credentials: true }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Healthcheck (sin autenticacion)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'api-gateway' });
});

// SSE Stream (con auth, sin circuit breaker)
app.use('/api/insights/stream', authMiddleware, createProxyMiddleware({
  target: 'http://api-insights:3600',
  changeOrigin: true,
}));

// Rutas con circuit breaker
app.use('/api/auth', circuitBreakerMiddleware(servicesConfig));
app.use(rateLimitMiddleware);
app.use(authMiddleware);
app.use('/api', rateLimitMiddleware, cacheMiddleware, authMiddleware, circuitBreakerMiddleware(servicesConfig));

// ─── Suite de pruebas ─────────────────────────────────────────────────────────

describe('dev-laoz-api-gateway', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /health ─────────────────────────────────────────────────────────────

  describe('GET /health', () => {

    it('caso 1 — debe responder HTTP 200 con status healthy', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });

    it('caso 2 — debe incluir el nombre del servicio', async () => {
      const res = await request(app).get('/health');
      expect(res.body.service).toBe('api-gateway');
    });

    it('caso 3 — el healthcheck no debe pasar por authMiddleware (debe responder sin token)', async () => {
      // Si pasara por auth, con axios mockeado para fallar, devolveria 401
      axios.post.mockRejectedValue(new Error('auth error'));

      const res = await request(app).get('/health');
      // Debe responder 200 independientemente de la disponibilidad de authorization-api
      expect(res.status).toBe(200);
    });

  });

  // ─── Autenticacion delegada ──────────────────────────────────────────────────

  describe('Autenticacion delegada — authMiddleware propio del gateway', () => {

    /**
     * Nota: el authMiddleware del gateway (src/middlewares/authMiddleware.js) es el
     * middleware REAL (no el de @dev-laoz/core). Llamamos directamente al modulo
     * para probar su logica de extraccion de token y bypass de rutas.
     */
    const gatewayAuthMiddleware = require('../src/middlewares/authMiddleware');

    it('caso 4 — debe responder HTTP 401 si no hay token en ruta protegida', async () => {
      const miniApp = express();
      miniApp.use(express.json());
      miniApp.use(gatewayAuthMiddleware);
      miniApp.get('/api/user', (req, res) => res.status(200).json({ ok: true }));

      // Sin header Authorization y sin token en query
      const res = await request(miniApp).get('/api/user');
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Token no proporcionado/i);
    });

    it('caso 5 — debe responder HTTP 401 si el token es invalido (axios lanza error)', async () => {
      axios.post.mockRejectedValue(new Error('Token invalido'));

      const miniApp = express();
      miniApp.use(express.json());
      miniApp.use(gatewayAuthMiddleware);
      miniApp.get('/api/user', (req, res) => res.status(200).json({ ok: true }));

      const res = await request(miniApp)
        .get('/api/user')
        .set('Authorization', 'Bearer token-invalido');

      expect(res.status).toBe(401);
    });

    it('caso 6 — debe permitir el paso si authorization-api responde 200', async () => {
      axios.post.mockResolvedValue({ status: 200, data: { valid: true } });

      const miniApp = express();
      miniApp.use(express.json());
      miniApp.use(gatewayAuthMiddleware);
      miniApp.get('/api/roles', (req, res) => res.status(200).json({ roles: [] }));

      const res = await request(miniApp)
        .get('/api/roles')
        .set('Authorization', 'Bearer token-valido');

      expect(res.status).toBe(200);
    });

  });

  // ─── Estructura de services.json ─────────────────────────────────────────────

  describe('Estructura de services.json', () => {

    it('caso 7 — el archivo de configuracion debe existir y ser un objeto', () => {
      expect(servicesConfig).toBeDefined();
      expect(typeof servicesConfig).toBe('object');
      expect(servicesConfig).not.toBeNull();
    });

    it('caso 8 — debe contener la clave de autenticacion (login)', () => {
      expect(servicesConfig).toHaveProperty('login');
      expect(servicesConfig.login).toHaveProperty('target');
      expect(servicesConfig.login).toHaveProperty('path');
      expect(servicesConfig.login).toHaveProperty('methods');
    });

    it('caso 9 — debe contener el servicio de usuarios', () => {
      expect(servicesConfig).toHaveProperty('users');
      expect(servicesConfig.users.target).toMatch(/user-api/);
    });

    it('caso 10 — debe contener el servicio de roles', () => {
      expect(servicesConfig).toHaveProperty('roles');
      expect(servicesConfig.roles).toHaveProperty('target');
      expect(Array.isArray(servicesConfig.roles.methods)).toBe(true);
    });

    it('caso 11 — debe contener el servicio de archivos con los metodos CRUD', () => {
      expect(servicesConfig).toHaveProperty('files');
      const methods = servicesConfig.files.methods;
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
    });

    it('caso 12 — debe contener el servicio de insights para ingesta (sin auth)', () => {
      expect(servicesConfig).toHaveProperty('insightsIngest');
      // La ingesta no requiere autenticacion
      expect(servicesConfig.insightsIngest.auth).toBeFalsy();
    });

    it('caso 13 — debe contener el servicio de insights para consulta (con auth)', () => {
      expect(servicesConfig).toHaveProperty('insightsQuery');
      expect(servicesConfig.insightsQuery.auth).toBe(true);
    });

    it('caso 14 — debe contener el servicio de billing', () => {
      expect(servicesConfig).toHaveProperty('billing');
      expect(servicesConfig.billing.target).toMatch(/billing/);
      expect(servicesConfig.billing.auth).toBe(true);
    });

    it('caso 15 — debe contener el servicio de secretos con target HTTPS', () => {
      expect(servicesConfig).toHaveProperty('secrets');
      expect(servicesConfig.secrets.target).toMatch(/^https:\/\//);
    });

    it('caso 16 — todos los servicios deben tener los campos minimos requeridos (path, target, methods)', () => {
      const claves = Object.keys(servicesConfig);
      claves.forEach((clave) => {
        const servicio = servicesConfig[clave];
        expect(servicio).toHaveProperty('path');
        expect(servicio).toHaveProperty('target');
        expect(servicio).toHaveProperty('methods');
        expect(Array.isArray(servicio.methods)).toBe(true);
        expect(servicio.methods.length).toBeGreaterThan(0);
      });
    });

  });

  // ─── httpLoggerMiddleware ────────────────────────────────────────────────────

  describe('httpLoggerMiddleware — registro de transacciones', () => {

    it('caso 17 — debe llamar a logger.transaction al completar una peticion', async () => {
      const { logger } = require('@dev-laoz/core');

      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(logger.transaction).toHaveBeenCalled();
    });

  });

});
