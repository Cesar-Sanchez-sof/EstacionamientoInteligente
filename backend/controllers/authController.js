const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const generateToken = (id, rol) => {
  return jwt.sign({ id, rol }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

const registerUser = async (req, res) => {
  const { 
    email, 
    password, 
    confirmPassword, 
    primer_nombre, 
    segundo_nombre, 
    primer_apellido, 
    segundo_apellido, 
    documento_tipo, 
    documento_numero,
    placa_vehiculo
  } = req.body;
  
  if (!email || !password || !confirmPassword || !primer_nombre || !primer_apellido || !segundo_apellido || !documento_tipo || !documento_numero || !placa_vehiculo) {
    return res.status(400).json({ message: 'Por favor incluya todos los campos requeridos' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Las contraseñas no coinciden'});
  }
 
  // Validaciones del tipo de documento y número
  if (documento_tipo === 'DNI') {
    if (!/^\d{8}$/.test(documento_numero)) {
      return res.status(400).json({ message: 'El DNI debe tener exactamente 8 dígitos numéricos.' });
    }
  } else if (documento_tipo === 'Pasaporte') {
    if (!/^[a-zA-Z]{3}\d{6}$/.test(documento_numero)) {
      return res.status(400).json({ message: 'El Pasaporte debe tener exactamente 9 caracteres (3 letras seguidas de 6 números).' });
    }
  } else if (documento_tipo === 'Carnet de Extranjeria' || documento_tipo === 'Carnet de Extranjería') {
    if (!/^\d{9}$/.test(documento_numero)) {
      return res.status(400).json({ message: 'El Carnet de Extranjería debe tener exactamente 9 dígitos numéricos.' });
    }
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Check if user exists
    const userExists = await client.query('SELECT * FROM Usuario WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'El usuario ya existe' });
    }

    // Obtener id_documento correspondiente al tipo de documento seleccionado
    const docQuery = await client.query('SELECT id_documento FROM Documento WHERE tipo = $1', [documento_tipo]);
    if (docQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'El tipo de documento seleccionado no es válido' });
    }
    const id_documento = docQuery.rows[0].id_documento;

    // Insertar Persona (segundo_apellido y numero_documento son obligatorios, segundo_nombre es opcional)
    const newPersona = await client.query(
      `INSERT INTO Persona (id_documento, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_documento) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_persona`,
      [id_documento, primer_nombre, segundo_nombre || null, primer_apellido, segundo_apellido, documento_numero]
    );
    const id_persona = newPersona.rows[0].id_persona;

    // Insertar Vehículo (obligatorio durante registro)
    await client.query(
      'INSERT INTO Vehiculo (id_persona, placa_vehiculo) VALUES ($1, $2)',
      [id_persona, placa_vehiculo.toUpperCase().trim()]
    );

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert Usuario
    const newUser = await client.query(
      'INSERT INTO Usuario (id_persona, email, contrasena, rol) VALUES ($1, $2, $3, $4) RETURNING id_usuario, email, rol',
      [id_persona, email, hashedPassword, 'USER']
    );

    await client.query('COMMIT');

    res.status(201).json({
      id: newUser.rows[0].id_usuario,
      email: newUser.rows[0].email,
      rol: newUser.rows[0].rol,
      primer_nombre,
      primer_apellido,
      token: generateToken(newUser.rows[0].id_usuario, newUser.rows[0].rol),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor al registrar', error: error.message });
  } finally {
    client.release();
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await db.query(
      `SELECT u.*, p.primer_nombre, p.primer_apellido 
       FROM Usuario u 
       JOIN Persona p ON u.id_persona = p.id_persona 
       WHERE u.email = $1`, 
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const user = result.rows[0];

    if (user && (await bcrypt.compare(password, user.contrasena))) {
      res.json({
        id: user.id_usuario,
        email: user.email,
        rol: user.rol,
        primer_nombre: user.primer_nombre,
        primer_apellido: user.primer_apellido,
        token: generateToken(user.id_usuario, user.rol),
      });
    } else {
      res.status(401).json({ message: 'Credenciales inválidas' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id_usuario, u.email, u.rol, p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido, d.tipo, p.numero_documento AS numero 
       FROM Usuario u 
       JOIN Persona p ON u.id_persona = p.id_persona 
       JOIN Documento d ON p.id_documento = d.id_documento
       WHERE u.id_usuario = $1`, 
      [req.user.id]
    );

    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ message: 'Usuario no encontrado' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

const getDocumentTypes = async (req, res) => {
  try {
    const result = await db.query('SELECT DISTINCT tipo FROM Documento');
    let types = result.rows.map(r => r.tipo);
    // Si la tabla documento está vacía inicialmente, damos un fallback con los valores requeridos
    if (types.length === 0) {
      types = ['DNI', 'Pasaporte', 'Carnet de Extranjeria'];
    }
    res.json(types);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener tipos de documento' });
  }
};

const getMyVehicles = async (req, res) => {
  try {
    const userId = req.user.id;
    // Se respeta la consulta solicitada: SELECT id_usuario, placa_vehiculo FROM Vehiculo V JOIN persona p ON p.id_persona = V.id_persona JOIN usuario u ON u.id_persona = p.id_persona
    // Se agrega u.id_usuario = $1 y V.id_vehiculo para el correcto funcionamiento de las llaves en React
    const result = await db.query(
      `SELECT u.id_usuario, V.id_vehiculo, V.placa_vehiculo 
       FROM Vehiculo V 
       JOIN persona p ON p.id_persona = V.id_persona 
       JOIN usuario u ON u.id_persona = p.id_persona
       WHERE u.id_usuario = $1`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener vehículos' });
  }
};

const addVehicle = async (req, res) => {
  return res.status(400).json({ message: 'No se permite registrar vehículos adicionales.' });
};

const getAllUsers = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id_usuario, u.email, u.rol, u.created_at, 
              p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido, 
              d.tipo AS documento_tipo, p.numero_documento
       FROM Usuario u 
       JOIN Persona p ON u.id_persona = p.id_persona 
       JOIN Documento d ON p.id_documento = d.id_documento
       ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor al obtener los usuarios' });
  }
};

module.exports = { registerUser, loginUser, getUserProfile, getDocumentTypes, getMyVehicles, addVehicle, getAllUsers };
