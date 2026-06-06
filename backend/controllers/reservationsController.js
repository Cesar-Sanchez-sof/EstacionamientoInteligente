const db = require('../config/db');

// @desc    Create a reservation
// @route   POST /api/reservations
// @access  Private
const createReservation = async (req, res) => {
  try {
    const { id_lugar, id_vehiculo, fecha, hora } = req.body;
    const userId = req.user.id;

    if (!id_vehiculo) {
      return res.status(400).json({ message: 'El vehículo es obligatorio para reservar' });
    }

    // Validate if the space is already occupied or reserved
    // 1. Check physical estado
    const spaceQuery = await db.query('SELECT disponible FROM Lugar WHERE id_lugar = $1', [id_lugar]);
    if (spaceQuery.rows.length === 0) {
      return res.status(404).json({ message: 'Lugar no encontrado' });
    }
    if (!spaceQuery.rows[0].disponible) {
      return res.status(400).json({ message: 'El lugar está físicamente ocupado' });
    }

    // 2. Check existing reservation for that date and time
    const existingReservation = await db.query(
      'SELECT * FROM Reserva WHERE id_lugar = $1 AND fecha = $2 AND hora = $3',
      [id_lugar, fecha, hora]
    );

    if (existingReservation.rows.length > 0) {
      return res.status(400).json({ message: 'El lugar ya está reservado para esta fecha y hora' });
    }

    // Insert reservation
    const newReservation = await db.query(
      'INSERT INTO Reserva (id_usuario, id_lugar, id_vehiculo, fecha, hora) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, id_lugar, id_vehiculo, fecha, hora]
    );

    res.status(201).json(newReservation.rows[0]);
  } catch (error) {
    console.error(error);
    if (error.constraint === 'uq_reserva_lugar_tiempo') {
      return res.status(400).json({ message: 'Ya existe una reserva para ese lugar y tiempo' });
    }
    res.status(500).json({ message: 'Error al crear la reserva' });
  }
};

// @desc    Get user's reservations
// @route   GET /api/reservations/myreservations
// @access  Private
const getMyReservations = async (req, res) => {
  try {
    const userId = req.user.id;
    const reservations = await db.query(
      `SELECT r.*, l.numero, v.placa_vehiculo 
       FROM Reserva r 
       JOIN Lugar l ON r.id_lugar = l.id_lugar 
       LEFT JOIN Vehiculo v ON r.id_vehiculo = v.id_vehiculo
       WHERE r.id_usuario = $1 
       ORDER BY r.fecha DESC, r.hora DESC`,
      [userId]
    );
    res.json(reservations.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener reservas' });
  }
};

// @desc    Get all reservations (Admin)
// @route   GET /api/reservations
// @access  Private/Admin
const getReservations = async (req, res) => {
  try {
    const reservations = await db.query(
      `SELECT r.*, l.numero, u.email, v.placa_vehiculo 
       FROM Reserva r 
       JOIN Lugar l ON r.id_lugar = l.id_lugar 
       JOIN Usuario u ON r.id_usuario = u.id_usuario
       LEFT JOIN Vehiculo v ON r.id_vehiculo = v.id_vehiculo
       ORDER BY r.fecha DESC, r.hora DESC`
    );
    res.json(reservations.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener reservas' });
  }
};

// @desc    Cancel/Delete reservation
// @route   DELETE /api/reservations/:id
// @access  Private
const deleteReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if reservation exists and belongs to user (or if admin)
    const reservation = await db.query('SELECT * FROM Reserva WHERE id_reserva = $1', [id]);
    
    if (reservation.rows.length === 0) {
      return res.status(404).json({ message: 'Reserva no encontrada' });
    }

    if (reservation.rows[0].id_usuario !== userId && req.user.rol !== 'ADMIN') {
      return res.status(401).json({ message: 'No autorizado para eliminar esta reserva' });
    }

    await db.query('DELETE FROM Reserva WHERE id_reserva = $1', [id]);
    res.json({ message: 'Reserva eliminada exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar reserva' });
  }
};

module.exports = {
  createReservation,
  getMyReservations,
  getReservations,
  deleteReservation
};
