# Tareas de desarrollo — dev-laoz-api-gateway

## Historias de usuario

---

### US-GW-001: Enrutamiento proxy a microservicios

**Como** frontend del ecosistema Dev Laoz,  
**quiero** que el gateway enrute mis peticiones al microservicio correcto segun la ruta solicitada,  
**para** tener un unico punto de entrada sin necesidad de conocer las URLs internas de cada servicio.

**Criterios de aceptacion:**
- [ ] Las rutas definidas en `services.json` se enrutan correctamente al servicio destino.
- [ ] Agregar un nuevo servicio a `services.json` no requiere cambios en el codigo del gateway.
- [ ] Si el servicio destino no existe en la configuracion, responde HTTP 404.
- [ ] El body, headers y query params de la peticion original se reenvian al servicio destino.

**Referencia:** RF-GW-001, RF-GW-002, RF-GW-015

---

### US-GW-002: Autenticacion delegada a authorization-api

**Como** arquitecto de seguridad,  
**quiero** que las rutas protegidas validen el JWT llamando a `authorization-api`,  
**para** centralizar la logica de autenticacion y no duplicarla en cada microservicio.

**Criterios de aceptacion:**
- [ ] Las rutas protegidas (con `auth: true` en `services.json`) requieren `Authorization: Bearer <token>`.
- [ ] Sin token en rutas protegidas, el gateway responde HTTP 401 antes de llamar al servicio destino.
- [ ] Con token invalido o expirado, el gateway responde HTTP 401.
- [ ] El gateway delega la validacion del token a `http://authorization-api:5000/api/authorization/validate`.
- [ ] Las rutas publicas (login, refresh, registro) no requieren token.

**Referencia:** RF-GW-005, RF-GW-006, RF-GW-007, RF-GW-008, RF-GW-009

---

### US-GW-003: Rate limiting global

**Como** administrador del ecosistema,  
**quiero** limitar la tasa de peticiones por cliente,  
**para** proteger el ecosistema de abusos, ataques de fuerza bruta y sobrecarga.

**Criterios de aceptacion:**
- [ ] `rateLimitMiddleware` de `@dev-laoz/core` se aplica a todas las rutas `/api/*`.
- [ ] Las rutas de autenticacion (`/api/auth`) tienen rate limiting adicional independiente.
- [ ] Cuando se supera el limite, el gateway responde HTTP 429.

**Referencia:** RF-GW-011, RF-GW-012

---

### US-GW-004: Circuit breaker para microservicios

**Como** arquitecto del sistema,  
**quiero** que el gateway aplique el patron circuit breaker a las llamadas a microservicios,  
**para** evitar fallos en cascada cuando un microservicio no esta disponible.

**Criterios de aceptacion:**
- [ ] Si un microservicio falla repetidamente, el circuit breaker se abre y el gateway responde HTTP 500 inmediatamente.
- [ ] El circuit breaker se implementa con `opossum`.
- [ ] Cada microservicio tiene su propia instancia de circuit breaker (no hay un breaker global compartido).
- [ ] El resto de rutas del gateway continuan funcionando cuando el breaker de un servicio esta abierto.

**Referencia:** RF-GW-013, RF-GW-014, RNF-GW-003

---

### US-GW-005: Logging de transacciones HTTP

**Como** responsable de observabilidad,  
**quiero** que el gateway registre cada transaccion HTTP en `api-insights`,  
**para** tener metricas centralizadas de uso y rendimiento de todos los servicios.

**Criterios de aceptacion:**
- [ ] `httpLoggerMiddleware` captura `method`, `originalUrl`, `statusCode` y `durationMs` de cada peticion.
- [ ] El middleware llama a `logger.transaction()` al finalizar cada respuesta (evento `finish`).
- [ ] Los errores HTTP >= 500 generan adicionalmente un log de error con `logger.error()`.
- [ ] Los warnings HTTP 4xx generan un log informativo con `logger.info()`.
- [ ] El middleware es el primero en aplicarse para medir la duracion total incluyendo auth y proxy.

**Referencia:** RF-GW-017, RF-GW-018, RF-GW-019

---

### US-GW-006: Soporte de streaming SSE para insights

**Como** dashboard de monitoreo,  
**quiero** que el gateway reenvie el stream SSE de `api-insights` sin interrupciones,  
**para** recibir eventos en tiempo real sin que el circuit breaker o el cache interfieran.

**Criterios de aceptacion:**
- [ ] `GET /api/insights/stream` se enruta directamente a `api-insights:3600` usando `http-proxy-middleware`, sin pasar por el circuit breaker.
- [ ] El endpoint requiere JWT valido (pasa por `authMiddleware`).
- [ ] La conexion SSE permanece abierta indefinidamente mientras el cliente este conectado.
- [ ] Sin JWT, el gateway responde HTTP 401.

**Referencia:** RF-GW-003

---

### US-GW-007: Cache de respuestas GET

**Como** responsable de rendimiento,  
**quiero** que el gateway cachee respuestas de endpoints GET protegidos,  
**para** reducir la carga en microservicios para peticiones frecuentes e identicas.

**Criterios de aceptacion:**
- [ ] `cacheMiddleware` se aplica a rutas GET protegidas.
- [ ] Las peticiones GET identicas (misma ruta + mismo token) retornan la respuesta cacheada sin llamar al microservicio.
- [ ] El cache se invalida automaticamente segun el TTL configurado.

**Referencia:** RF-GW-016

---

### US-GW-008: Healthcheck del gateway

**Como** orquestador de Docker,  
**quiero** un endpoint de healthcheck sin autenticacion,  
**para** verificar que el gateway esta operativo y listo para recibir trafico.

**Criterios de aceptacion:**
- [ ] `GET /health` responde HTTP 200 con `{ status: "healthy", service: "api-gateway" }`.
- [ ] El endpoint no pasa por `authMiddleware` ni por el circuit breaker.
- [ ] El endpoint responde correctamente aunque los microservicios internos esten caidos.

**Referencia:** RF-GW-004

---

### US-GW-009: Validacion de configuracion al arrancar

**Como** administrador del sistema,  
**quiero** que el gateway valide su configuracion al arrancar,  
**para** detectar errores de configuracion antes de recibir trafico real.

**Criterios de aceptacion:**
- [ ] Si `services.json` no existe, el proceso termina con `process.exit(1)` y mensaje descriptivo.
- [ ] Si `services.json` tiene JSON invalido, el proceso termina con error descriptivo.
- [ ] Si `services.json` existe y es valido, el proceso arranca normalmente.

**Referencia:** RNF-GW-006

---

### US-GW-010: CORS restringido por origin

**Como** responsable de seguridad,  
**quiero** que el gateway solo acepte peticiones desde origenes autorizados,  
**para** prevenir accesos desde dominios no autorizados (CSRF y accesos cruzados).

**Criterios de aceptacion:**
- [ ] En desarrollo, el origin permitido es `http://localhost:8080`.
- [ ] En produccion, el origin se configura via variable de entorno `CORS_ORIGIN`.
- [ ] Las peticiones desde origenes no autorizados reciben error CORS.

**Referencia:** RNF-GW-005

---

## Tareas tecnicas

| ID | Descripcion | Dependencia |
|----|-------------|-------------|
| TT-GW-001 | Agregar `jest` y `supertest` a `devDependencies` y configurar script `test: jest` | Ninguna |
| TT-GW-002 | Crear `jest.config.js` con `testEnvironment: 'node'` | TT-GW-001 |
| TT-GW-003 | Escribir suite de pruebas en `tests/gateway.test.js` con minimo 10 casos | TT-GW-002 |
| TT-GW-004 | Refactorizar `src/server.js` para exportar `app` como modulo, separando la logica de configuracion del llamado a `app.listen()` | TT-GW-003 |
| TT-GW-005 | Revisar el bypass de autenticacion para `/api/files` y `/api/manager` en `authMiddleware.js` — documentar si es intencional o es un bug | Ninguna |
| TT-GW-006 | Agregar variable de entorno `CORS_ORIGIN` para configurar el origin CORS en produccion | Ninguna |
| TT-GW-007 | Documentar en `docs/API.md` la tabla completa de rutas con auth requerida, extraida de `services.json` | Ninguna |
