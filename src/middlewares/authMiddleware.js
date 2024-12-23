module.exports = (req, res, next) => {
  const authToken = req.headers['authorization'];
  if (!authToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Add token validation logic here
  

  next();
};