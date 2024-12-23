# API Gateway

Este proyecto implementa un **API Gateway** que actúa como punto de entrada central para varios microservicios. El Gateway redirige las solicitudes a los microservicios correspondientes, incluyendo la API de autenticación para gestionar usuarios, roles y permisos.

## **Estructura del Proyecto**

```plaintext
api-gateway/
├── config/
│   └── routes.json         # Configuración de rutas y servicios
├── routes/
│   └── index.js            # Middleware para enrutar solicitudes a servicios
├── server.js               # Archivo principal que configura y corre el servidor
├── package.json            # Dependencias y scripts del proyecto
└── .env                    # Variables de entorno (opcional)
```

## **Instalación**

1. Clona este repositorio:

   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd api-gateway
   ```

2. Instala las dependencias:

   ```bash
   npm install
   ```

3. (Opcional) Configura las variables de entorno en un archivo `.env` si es necesario.

4. Inicia el servidor:

   ```bash
   npm start
   ```

   El API Gateway correrá en el puerto configurado (por defecto `3000`).

## **Rutas**

El API Gateway enruta las solicitudes a los microservicios configurados en el archivo `routes.json`. A continuación se detallan las rutas disponibles para la API de autenticación:

### **Rutas de Autenticación**

El API Gateway redirige las siguientes rutas a la API de autenticación que corre en `http://localhost:5000/api/auth`:

- `POST /api/auth/register`: Registra un nuevo usuario. 
- `POST /api/auth/login`: Inicia sesión y devuelve un token JWT.
- `GET /api/auth/read`: Accede a un recurso protegido (requiere token JWT).
- `POST /api/auth/write`: Accede a un recurso de escritura (requiere token JWT y permiso `write`).
- `DELETE /api/auth/delete`: Elimina un recurso (requiere token JWT y permiso `delete`).

### **Estructura de las Rutas**

La configuración de las rutas se encuentra en el archivo `src/config/routes.json`. Este archivo contiene la información de los servicios a los que el API Gateway debe enrutar las solicitudes. Aquí un ejemplo:

```json
{
  "auth": {
    "path": "/api/auth",
    "target": "http://localhost:5000/api/auth",
    "methods": ["GET", "POST", "DELETE", "PUT"]
  },
  "otherService": {
    "path": "/api/other-service",
    "target": "http://localhost:4000/api",
    "methods": ["GET", "POST"]
  }
}
```

## **Desarrollo Local**

Para desarrollar localmente, asegúrate de tener corriendo la **API de autenticación** en el puerto `5000` o el puerto configurado en el archivo `routes.json`. Si tienes otros microservicios, asegúrate de que estén también corriendo en los puertos correspondientes.

### **Cómo probar las rutas**

1. **Registrar un Usuario**

   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
   -H "Content-Type: application/json" \
   -d '{"username": "testuser", "password": "password123", "role": "user", "permissions": ["read"]}'
   ```

2. **Iniciar Sesión**

   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
   -H "Content-Type: application/json" \
   -d '{"username": "testuser", "password": "password123"}'
   ```

3. **Acceder a una Ruta Protegida**

   (Reemplaza `<TOKEN>` con el JWT recibido en el inicio de sesión)
   ```bash
   curl -X GET http://localhost:3000/api/auth/read \
   -H "Authorization: Bearer <TOKEN>"
   ```

---

## **Desarrollo y Personalización**

### **Agregar Nuevas Rutas**

Las rutas del API Gateway se configuran en el archivo `src/config/routes.json`. Si deseas agregar un nuevo servicio, simplemente sigue el formato JSON y agrega el nuevo objeto en el archivo.

Ejemplo de cómo agregar un nuevo microservicio:

```json
{
  "newService": {
    "path": "/api/new-service",
    "target": "http://localhost:6000/api",
    "methods": ["GET", "POST"]
  }
}
```

### **Middleware y Logs**

El API Gateway también permite agregar middleware para manejar errores, autenticación o logging. Si usas herramientas como **Winston** o **Prometheus**, puedes añadir el código necesario para recopilar métricas y logs de las solicitudes.

---

## **Tecnologías Utilizadas**

- **Node.js**: Plataforma de backend para ejecutar el API Gateway.
- **Express.js**: Framework para crear el servidor y enrutar las solicitudes.
- **http-proxy-middleware**: Biblioteca para redirigir las solicitudes a otros servicios.
- **dotenv**: Para manejar variables de entorno de forma segura.

---

## **Licencia**

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles.