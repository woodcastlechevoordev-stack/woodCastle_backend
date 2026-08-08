const jwt = require('jsonwebtoken');

function adminAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'admin') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    req.admin = { id: payload.sub, username: payload.username, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = adminAuth;
