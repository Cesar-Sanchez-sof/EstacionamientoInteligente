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

    // Validate that the reservation is not in the past (up to the minute)
    const now = new Date();
    now.setSeconds(0);
    now.setMilliseconds(0);

    const timeParts = hora.split(':');
    const hh = timeParts[0].padStart(2, '0');
    const mm = timeParts[1] ? timeParts[1].padStart(2, '0') : '00';
    const reservationDateTime = new Date(`${fecha}T${hh}:${mm}:00-05:00`);

    if (isNaN(reservationDateTime.getTime())) {
      return res.status(400).json({ message: 'Fecha o hora inválida' });
    }

    if (reservationDateTime <= now) {
      return res.status(400).json({ message: 'No se puede reservar para la fecha u hora actual o en el pasado' });
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

    // 2. Check existing reservation for that date and time (looking for active ones)
    const existingReservation = await db.query(
      "SELECT * FROM Reserva WHERE id_lugar = $1 AND fecha = $2 AND hora = $3 AND estado IN ('Espera', 'Atendido')",
      [id_lugar, fecha, hora]
    );

    if (existingReservation.rows.length > 0) {
      return res.status(400).json({ message: 'El lugar ya está reservado para esta fecha y hora' });
    }

    // Insert reservation - explicitly set status to 'Espera' to handle database constraint defaults
    const newReservation = await db.query(
      "INSERT INTO Reserva (id_usuario, id_lugar, id_vehiculo, fecha, hora, estado) VALUES ($1, $2, $3, $4, $5, 'Espera') RETURNING *",
      [userId, id_lugar, id_vehiculo, fecha, hora]
    );

    // Update the corresponding Lugar availability to occupied/reserved (disponible = false)
    await db.query('UPDATE Lugar SET disponible = false WHERE id_lugar = $1', [id_lugar]);

    res.status(201).json(newReservation.rows[0]);
  } catch (error) {
    console.error(error);
    if (error.constraint && error.constraint.includes('uq_reserva_lugar_tiempo')) {
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
    // Auto-expire reservations whose date and time have passed
    const expiredRes = await db.query(`
      UPDATE Reserva 
      SET estado = 'Perdida', updated_at = CURRENT_TIMESTAMP 
      WHERE estado = 'Espera' 
        AND timezone('America/Bogota', fecha + hora) < CURRENT_TIMESTAMP
      RETURNING id_lugar
    `);

    if (expiredRes.rows.length > 0) {
      const expiredLugarIds = expiredRes.rows.map(r => r.id_lugar);
      await db.query(
        'UPDATE Lugar SET disponible = true WHERE id_lugar = ANY($1)',
        [expiredLugarIds]
      );
    }

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
    // Auto-expire reservations whose date and time have passed
    const expiredRes = await db.query(`
      UPDATE Reserva 
      SET estado = 'Perdida', updated_at = CURRENT_TIMESTAMP 
      WHERE estado = 'Espera' 
        AND timezone('America/Bogota', fecha + hora) < CURRENT_TIMESTAMP
      RETURNING id_lugar
    `);

    if (expiredRes.rows.length > 0) {
      const expiredLugarIds = expiredRes.rows.map(r => r.id_lugar);
      await db.query(
        'UPDATE Lugar SET disponible = true WHERE id_lugar = ANY($1)',
        [expiredLugarIds]
      );
    }

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

// @desc    Cancel/Delete reservation (Soft Cancel)
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

    await db.query("UPDATE Reserva SET estado = 'Cancelado', updated_at = CURRENT_TIMESTAMP WHERE id_reserva = $1", [id]);
    
    // Update corresponding Lugar to available (disponible = true)
    await db.query('UPDATE Lugar SET disponible = true WHERE id_lugar = $1', [reservation.rows[0].id_lugar]);

    res.json({ message: 'Reserva cancelada exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar reserva' });
  }
};

// @desc    Update reservation status (Admin/User)
// @route   PUT /api/reservations/:id/status
// @access  Private
const updateReservationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body; // 'Espera', 'Atendido', 'Cancelado', 'Perdida'
    const userId = req.user.id;
    const userRol = req.user.rol;

    if (!['Espera', 'Atendido', 'Cancelado', 'Perdida'].includes(estado)) {
      return res.status(400).json({ message: 'Estado inválido. Debe ser Espera, Atendido, Cancelado o Perdida' });
    }

    // Check if reservation exists
    const reservation = await db.query('SELECT * FROM Reserva WHERE id_reserva = $1', [id]);
    if (reservation.rows.length === 0) {
      return res.status(404).json({ message: 'Reserva no encontrada' });
    }

    const targetRes = reservation.rows[0];

    // Check authorization:
    // 1. Regular users can only cancel their own reservations
    // 2. Admins can update any reservation to any status
    if (userRol !== 'ADMIN') {
      if (targetRes.id_usuario !== userId) {
        return res.status(401).json({ message: 'No autorizado para actualizar esta reserva' });
      }
      if (estado !== 'Cancelado') {
        return res.status(400).json({ message: 'Los usuarios regulares solo pueden cancelar reservas' });
      }
    }

    // Perform update
    const updatedRes = await db.query(
      'UPDATE Reserva SET estado = $1, updated_at = CURRENT_TIMESTAMP WHERE id_reserva = $2 RETURNING *',
      [estado, id]
    );

    // If updated to Cancelado or Perdida, free the spot. If Espera or Atendido, occupy the spot.
    if (estado === 'Cancelado' || estado === 'Perdida') {
      await db.query('UPDATE Lugar SET disponible = true WHERE id_lugar = $1', [targetRes.id_lugar]);
    } else if (estado === 'Espera' || estado === 'Atendido') {
      await db.query('UPDATE Lugar SET disponible = false WHERE id_lugar = $1', [targetRes.id_lugar]);
    }

    res.json(updatedRes.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar el estado de la reserva' });
  }
};

module.exports = {
  createReservation,
  getMyReservations,
  getReservations,
  deleteReservation,
  updateReservationStatus
};
