const axios = require('axios');
const config = require('../config/services.json');

const getFullPath = (req) => `${req.baseUrl || ''}${req.path}`;

const getServiceMatch = (req) => {
  const fullPath = getFullPath(req);
  const method = req.method.toUpperCase();

  return Object.values(config)
    .filter((service) => service.methods?.includes(method))
    .map((service) => {
      const basePath = service.path.includes('/:')
        ? service.path.slice(0, service.path.indexOf('/:'))
        : service.path;

      const matches = fullPath === service.path
        || fullPath === basePath
        || fullPath.startsWith(`${basePath}/`);

      return matches ? { service, basePath } : null;
    })
    .filter(Boolean)
    .sort((left, right) => right.basePath.length - left.basePath.length)[0]?.service;
};

const validateTokenAndPermissions = async (req, res, next) => {
  console.log('[AuthMiddleware] Path:', req.path);
  const matchedService = getServiceMatch(req);

  if (matchedService?.auth === false) {
    return next();
  }

  if (req.path.includes('/files') || req.path.includes('/manager')) return next();
  const token = req.header('Authorization')?.split(' ')[1] || req.query.token;

  if (!token) {
    return res.status(401).json({ message: 'Acceso denegado: Token no proporcionado' });
  }

  try {
    const response = await axios.post(config.authorization.target, {
      requiredPermission: req.requiredPermission || ''
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 200) {
      next();
    } else {
      res.status(403).json({ message: 'Permiso denegado' });
    }
  } catch (error) {
    res.status(401).json({ message: 'Token inválido o expirado' });
  }
};

module.exports = validateTokenAndPermissions;