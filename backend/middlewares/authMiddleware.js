const jwt = require('jsonwebtoken');
const db = require('../config/db');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Validate that token_version matches DB
      const userQuery = await db.query('SELECT token_version FROM Usuario WHERE id_usuario = $1', [decoded.id]);
      if (userQuery.rows.length === 0 || userQuery.rows[0].token_version !== decoded.token_version) {
        return res.status(401).json({ message: 'Sesión expirada o iniciada en otro dispositivo' });
      }
      
      req.user = decoded;
      return next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: 'No autorizado, token falló' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'No autorizado, no hay token' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.rol === 'ADMIN') {
    next();
  } else {
    res.status(401).json({ message: 'No autorizado como administrador' });
  }
};

module.exports = { protect, admin };
