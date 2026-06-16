# Documento de Requerimientos — dev-laoz-api-gateway

## 1. Descripcion general

`api-gateway` es el punto de entrada unico del ecosistema Dev Laoz. Actua como proxy inverso que enruta todas las peticiones externas hacia los microservicios internos. Gestiona autenticacion/autorizacion delegada, rate limiting, cache, circuit breaker y registro de transacciones HTTP. Ninguna peticion del frontend debe llegar directamente a los microservicios internos.

---

## 2. Requerimientos Funcionales

### 2.1 Proxy y enrutamiento

| ID | Descripcion | Prioridad |
|----|-------------|-----------|
| RF-GW-001 | El sistema debe enrutar peticiones a todos los microservicios del ecosistema segun la tabla de rutas definida en `src/config/services.json`. | Alta |
| RF-GW-002 | El enrutamiento debe ser dinamico: agregar un nuevo servicio a `services.json` no debe requerir cambios en el codigo del gateway. | Alta |
| RF-GW-003 | El sistema debe soportar el streaming SSE para `GET /api/insights/stream` usando `http-proxy-middleware` directamente, sin pasar por el circuit breaker estandar. | Alta |
| RF-GW-004 | El endpoint `GET /health` debe responder HTTP 200 con `{ status: "healthy", service: "api-gateway" }` sin autenticacion, para healthchecks de Docker. | Alta |

### 2.2 Autenticacion y autorizacion

| ID | Descripcion | Prioridad |
|----|-------------|-----------|
| RF-GW-005 | Las rutas publicas (`POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/roles/check`, `POST /api/user`) deben poder accederse sin token JWT. | Alta |
| RF-GW-006 | Las rutas protegidas deben requerir un JWT valido en el header `Authorization: Bearer <token>`. El token se valida delegando a `authorization-api`. | Alta |
| RF-GW-007 | Si el token esta ausente en una ruta protegida, el gateway debe responder HTTP 401 con `{ message: "Acceso denegado: Token no proporcionado" }`. | Alta |
| RF-GW-008 | Si el token es invalido o expirado, el gateway debe responder HTTP 401 con `{ message: "Token invalido o expirado" }`. | Alta |
| RF-GW-009 | El middleware de autenticacion (`src/middlewares/authMiddleware.js`) debe delegar la verificacion a `http://authorization-api:5000/api/authorization/validate` usando el token extraido del header. | Alta |
| RF-GW-010 | Las rutas `/api/files` y `/api/manager` tienen bypass de autenticacion en el middleware actual; este comportamiento debe estar documentado y ser revisable. | Media |

### 2.3 Rate limiting

| ID | Descripcion | Prioridad |
|----|-------------|-----------|
| RF-GW-011 | El gateway debe aplicar rate limiting global usando `rateLimitMiddleware` de `@dev-laoz/core` a todas las rutas `/api/*` protegidas. | Alta |
| RF-GW-012 | Las rutas de autenticacion (`/api/auth`) deben tener rate limiting independiente para prevenir ataques de fuerza bruta. | Alta |

### 2.4 Circuit breaker

| ID | Descripcion | Prioridad |
|----|-------------|-----------|
| RF-GW-013 | El gateway debe implementar el patron circuit breaker (usando `opossum`) para todas las llamadas proxy a microservicios internos. | Alta |
| RF-GW-014 | Si un microservicio destino falla repetidamente, el circuit breaker debe abrir y devolver error 500 con mensaje descriptivo, sin reintento inmediato. | Alta |
| RF-GW-015 | Si el servicio destino no existe en `services.json`, el gateway debe responder HTTP 404 con `{ error: "Service <nombre> not found" }`. | Media |

### 2.5 Cache

| ID | Descripcion | Prioridad |
|----|-------------|-----------|
| RF-GW-016 | El gateway debe aplicar cache a respuestas de rutas GET protegidas usando `cacheMiddleware` para reducir la carga en microservicios. | Media |

### 2.6 Logging de transacciones

| ID | Descripcion | Prioridad |
|----|-------------|-----------|
| RF-GW-017 | El gateway debe registrar cada transaccion HTTP (metodo, ruta, statusCode, durationMs) usando `httpLoggerMiddleware` que llama a `logger.transaction()` de `@dev-laoz/core`. | Alta |
| RF-GW-018 | Las respuestas con statusCode >= 500 deben generar adicionalmente un log de error con `logger.error()`. | Media |
| RF-GW-019 | Las respuestas con statusCode 4xx deben generar un log informativo con `logger.info()`. | Baja |

---

## 3. Tabla de rutas

| Servicio clave | Ruta gateway | Metodos | Auth requerida | Destino |
|----------------|-------------|---------|----------------|---------|
| `login` | `/api/auth/login` | POST | No | `http://authentication-api:4000/api/auth/login` |
| `authRefresh` | `/api/auth/refresh` | POST | No | `http://authentication-api:4000/api/auth/refresh` |
| `authLogout` | `/api/auth/logout` | POST | Si | `http://authentication-api:4000/api/auth/logout` |
| `authVerify` | `/api/auth/verify` | GET | Si | `http://authentication-api:4000/api/auth/verify` |
| `authorization` | `/api/authorization/validate` | POST | Si | `http://authorization-api:5000/api/authorization/validate` |
| `users` | `/api/user` | GET, POST | No | `http://user-api:6000/api/user` |
| `userById` | `/api/user/:id` | GET, PUT, DELETE | Si | `http://user-api:6000/api/user` |
| `roles` | `/api/roles` | GET, POST | Si | `http://api-roles:5002/api/roles` |
| `rolesCheck` | `/api/roles/check` | POST | No | `http://api-roles:5002/api/roles/check` |
| `roleById` | `/api/roles/:id` | GET, PUT, DELETE | Si | `http://api-roles:5002/api/roles` |
| `secrets` | `/api/secrets` | POST | Si | `https://api-secrets:3501/api/secrets` |
| `insightsIngest` | `/api/insights` | POST | No | `http://api-insights:3600/api/insights` |
| `insightsQuery` | `/api/insights` | GET | Si | `http://api-insights:3600/api/insights` |
| `files` | `/api/files` | POST, GET, PUT, DELETE | Si | `http://api-files:3700/api/files` |
| `manager` | `/api/manager` | GET, POST | Si | `http://api-manager:3800/api/manager` |
| `billing` | `/api/billing` | GET, POST | Si | `http://billing-api:3004/api/billing` |
| *(directo SSE)* | `/api/insights/stream` | GET | Si | `http://api-insights:3600/api/insights/stream` |

---

## 4. Requerimientos No Funcionales

| ID | Descripcion | Prioridad |
|----|-------------|-----------|
| RNF-GW-001 | El overhead introducido por el gateway (autenticacion delegada + proxy) debe ser inferior a 5 ms adicionales en condiciones de red local. | Alta |
| RNF-GW-002 | El gateway es el unico punto de entrada desde el exterior; ningun microservicio interno debe exponer puertos al host en produccion. | Alta |
| RNF-GW-003 | El circuit breaker debe proteger al gateway de fallos en cascada: si un microservicio cae, el resto del ecosistema debe seguir operativo. | Alta |
| RNF-GW-004 | El gateway debe soportar peticiones con body de hasta 10 MB (configurable en `bodyParser`). | Media |
| RNF-GW-005 | El gateway solo debe aceptar peticiones CORS desde el origin configurado (`http://localhost:8080` en desarrollo); en produccion el origin debe ser configurable via variable de entorno. | Media |
| RNF-GW-006 | La configuracion de servicios (`services.json`) debe ser validada al arrancar: si el archivo no existe o tiene JSON invalido, el proceso debe terminar con error descriptivo. | Alta |
| RNF-GW-007 | El gateway no debe almacenar ni transformar el contenido de las peticiones/respuestas; actua exclusivamente como proxy transparente. | Alta |

---

## 5. Casos de uso

### CU-GW-001: Login de usuario

**Actor:** Frontend / Cliente externo

**Flujo principal:**
1. El cliente realiza `POST /api/auth/login` con credenciales.
2. El gateway aplica rate limiting.
3. El gateway enruta la peticion a `authentication-api:4000` via circuit breaker.
4. Devuelve la respuesta al cliente con el JWT generado.

---

### CU-GW-002: Peticion a ruta protegida

**Actor:** Frontend con JWT valido

**Flujo principal:**
1. El cliente realiza `GET /api/user` con `Authorization: Bearer <token>`.
2. `httpLoggerMiddleware` registra el inicio de la transaccion.
3. `authMiddleware` extrae el token y llama a `authorization-api` para validarlo.
4. Si es valido, el circuit breaker enruta la peticion a `user-api:6000`.
5. La respuesta se devuelve al cliente.
6. `httpLoggerMiddleware` registra la duracion y statusCode al terminar.

**Flujo alternativo (sin token):**
- En el paso 3, `authMiddleware` devuelve HTTP 401 sin llegar a `user-api`.

---

### CU-GW-003: Microservicio caido (Circuit Breaker abierto)

**Actor:** Frontend

**Flujo principal:**
1. El cliente realiza una peticion a un microservicio cuyo circuit breaker esta abierto.
2. El gateway responde inmediatamente con HTTP 500 sin intentar conectar al microservicio.
3. El resto de rutas del gateway siguen funcionando con normalidad.

---

## 6. Dependencias externas

| Servicio | Rol | URL interna |
|----------|-----|-------------|
| `authentication-api` | Emision de JWT (login/refresh/logout) | `http://authentication-api:4000` |
| `authorization-api` | Validacion de JWT y permisos | `http://authorization-api:5000` |
| `user-api` | CRUD de usuarios | `http://user-api:6000` |
| `api-roles` | Gestion de roles y permisos | `http://api-roles:5002` |
| `api-secrets` | Almacen de secretos | `https://api-secrets:3501` |
| `api-insights` | Observabilidad y logs | `http://api-insights:3600` |
| `api-files` | Gestion de archivos | `http://api-files:3700` |
| `api-manager` | Administracion del ecosistema | `http://api-manager:3800` |
| `billing-api` | Facturacion | `http://billing-api:3004` |
