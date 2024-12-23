const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 }); // TTL: 60 segundos

const cacheMiddleware = (req, res, next) => {
  const key = `${req.method}:${req.originalUrl}`;
  const cachedResponse = cache.get(key);

  if (cachedResponse) {
    return res.status(200).json(cachedResponse);
  }

  res.sendResponse = res.json;
  res.json = (body) => {
    cache.set(key, body);
    res.sendResponse(body);
  };

  next();
};

module.exports = cacheMiddleware;
