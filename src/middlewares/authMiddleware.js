const axios = require('axios');
const config = require('../config/services.json');

const validateTokenAndPermissions = async (req, res, next) => {
  console.log('[AuthMiddleware] Path:', req.path);
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