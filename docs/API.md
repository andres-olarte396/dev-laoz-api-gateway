# API Reference — dev-laoz-api-gateway

El gateway no implementa logica de negocio propia: enruta cada peticion al microservicio destino segun la tabla configurada en `src/config/services.json`. La autenticacion se valida contra `authorization-api` antes de llegar al servicio destino (excepto las rutas marcadas como publicas).

Puerto interno: `3002`. Puerto expuesto en el host: `9000`.

---

## Tabla de enrutamiento

| Metodo | Ruta publica | Auth | Destino interno |
| --- | --- | --- | --- |
| GET | `/health` | No | Gateway propio |
| POST | `/api/auth/login` | No | `authentication-api:4000` |
| POST | `/api/auth/refresh` | No | `authentication-api:4000` |
| POST | `/api/auth/logout` | Si | `authentication-api:4000` |
| GET | `/api/auth/verify` | Si | `authentication-api:4000` |
| POST | `/api/authorization/validate` | Si | `authorization-api:5000` |
| GET | `/api/user` | No | `user-api:6000` |
| POST | `/api/user` | No | `user-api:6000` (registro) |
| GET/PUT/DELETE | `/api/user/:id` | Si | `user-api:6000` |
| GET/POST | `/api/roles` | Si | `api-roles:5002` |
| POST | `/api/roles/check` | No | `api-roles:5002` (interno) |
| GET/PUT/DELETE | `/api/roles/:id` | Si | `api-roles:5002` |
| POST | `/api/secrets` | Si | `api-secrets:3501` (HTTPS) |
| POST | `/api/insights` | No | `api-insights:3600` (ingestion) |
| GET | `/api/insights` | Si | `api-insights:3600` (consulta) |
| GET | `/api/insights/stream` | Si | `api-insights:3600` (SSE directo) |
| GET/POST/PUT/DELETE | `/api/files` | Si | `api-files:3700` |
| GET/POST | `/api/manager` | Si | `api-manager:3800` |
| GET/POST | `/api/billing` | Si | `billing-api:3004` |

---

## Cadena de middleware

Las peticiones atraviesan los siguientes middlewares en orden:

1. `httpLoggerMiddleware` — registra la peticion en `api-insights`.
2. `cors()` — permite `http://localhost:8080` (o `CORS_ORIGIN`).
3. `bodyParser.json` (limite 10 MB) + `bodyParser.urlencoded`.
4. `rateLimitMiddleware` — limita peticiones por IP (configurado en `@dev-laoz/core`).
5. `authMiddleware` — llama a `POST authorization-api:5000/api/authorization/validate` con el JWT del header `Authorization: Bearer <token>`.
6. `cacheMiddleware` — cache en memoria por clave `METHOD:URL` con TTL de 60 s.
7. `circuitBreakerMiddleware` — abre el circuito si el servicio destino falla repetidamente.

Las rutas `/api/auth/login`, `/api/auth/refresh` y `/api/roles/check` entran por un bloque separado que solo aplica el circuit breaker, sin autenticacion.

---

## Endpoints del gateway

### GET /health

Comprueba que el proceso del gateway esta en ejecucion. No requiere autenticacion.

**Respuesta 200**

```json
{
  "status": "healthy",
  "service": "api-gateway"
}
```

**curl**

```bash
curl http://localhost:9000/health
```

---

### POST /api/auth/login

Enruta a `authentication-api`. No requiere token.

**Request body**

```json
{
  "username": "juan.perez",
  "password": "MiPassword123"
}
```

**Respuesta 200**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
  "user": {
    "id": 42,
    "username": "juan.perez",
    "role": "admin"
  }
}
```

**Errores**

| Codigo | Descripcion |
| --- | --- |
| 400 | Cuerpo de la peticion invalido |
| 401 | Credenciales incorrectas |
| 503 | Circuit breaker abierto (authentication-api no disponible) |

**curl**

```bash
curl -X POST http://localhost:9000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "juan.perez", "password": "MiPassword123"}'
```

---

### POST /api/auth/refresh

Renueva el JWT usando el refresh token. No requiere autenticacion previa.

**Request body**

```json
{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
}
```

**Respuesta 200**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(nuevo)"
}
```

**curl**

```bash
curl -X POST http://localhost:9000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."}'
```

---

### POST /api/auth/logout

Invalida la sesion activa. Requiere token valido.

**Headers**

```
Authorization: Bearer <token>
```

**Respuesta 200**

```json
{
  "message": "Sesion cerrada correctamente"
}
```

**curl**

```bash
curl -X POST http://localhost:9000/api/auth/logout \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/insights/stream

Conexion SSE para recibir eventos en tiempo real. Omite el circuit breaker y hace proxy directo a `api-insights:3600`. Requiere token valido.

**Headers**

```
Authorization: Bearer <token>
Accept: text/event-stream
```

**Respuesta** — stream de eventos SSE

```
data: {"tipo":"HTTP_REQUEST","servicio":"api-gateway","ts":"2025-06-14T10:23:00Z"}

data: {"tipo":"CONTAINER_START","servicio":"api-manager","ts":"2025-06-14T10:23:05Z"}
```

**curl**

```bash
curl -N http://localhost:9000/api/insights/stream \
  -H "Authorization: Bearer <token>" \
  -H "Accept: text/event-stream"
```

---

## Errores comunes del gateway

| Codigo | Causa |
| --- | --- |
| 401 | Token no proporcionado o expirado |
| 403 | Token valido pero sin permisos suficientes |
| 404 | Servicio destino no registrado en `services.json` |
| 429 | Limite de peticiones por IP excedido |
| 503 | Circuit breaker abierto para el servicio destino |

---

## Notas de configuracion

- El archivo `src/config/services.json` define el mapa de rutas. Cada entrada incluye `path`, `target`, `methods` y opcionalmente `auth: true`.
- El cache en memoria se invalida automaticamente tras 60 s o al reiniciar el proceso.
- El circuit breaker usa configuracion por defecto de opossum: umbral de fallos 50 %, ventana de 10 s, tiempo de recuperacion 30 s.
