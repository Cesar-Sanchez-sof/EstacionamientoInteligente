const db = require('../config/db');

// @desc    Get all parking spaces with their dynamic status
// @route   GET /api/spaces
// @access  Private (Requires token to calculate "Reservado por ti")
const getSpaces = async (req, res) => {
  try {
    const userId = req.user.id;
    // 1. Auto-expire reservations whose date and time have passed
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

    // Get all spaces
    const spacesResult = await db.query('SELECT * FROM Lugar ORDER BY numero ASC');
    const spaces = spacesResult.rows;

    // Get active reservations for today (assuming reservations are per day)
    // We check if there's any active reservation (Espera or Atendido)
    const reservationsResult = await db.query(
      `SELECT id_lugar, id_usuario FROM Reserva 
       WHERE fecha >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date AND estado IN ('Espera', 'Atendido')`
    );
    const reservations = reservationsResult.rows;

    // Calculate dynamic status
    // Verde = Disponible, Rojo = Ocupado, Azul = Reservado por ti, Gris = No disponible (we will use estado = true if it's occupied physically, but if there's a reservation it overrides it to red or blue)
    const processedSpaces = spaces.map(space => {
      let status = space.disponible ? 'DISPONIBLE' : 'OCUPADO'; // disponible = true es libre, false es ocupado

      // Check if reserved
      const reservation = reservations.find(r => r.id_lugar === space.id_lugar);
      
      if (reservation) {
        if (reservation.id_usuario === userId) {
          status = 'RESERVADO_POR_TI';
        } else {
          status = 'RESERVADO'; // Someone else reserved it, so it's red/occupied
        }
      }

      return {
        ...space,
        statusColor: status === 'DISPONIBLE' ? 'green' : 
                     status === 'OCUPADO' || status === 'RESERVADO' ? 'red' : 
                     status === 'RESERVADO_POR_TI' ? 'blue' : 'gray'
      };
    });

    res.json(processedSpaces);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener los lugares' });
  }
};

// @desc    Update space status (Admin)
// @route   PUT /api/spaces/:id
// @access  Private/Admin
const updateSpaceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { disponible } = req.body; // boolean (true = disponible, false = ocupado)

    const updatedSpace = await db.query(
      'UPDATE Lugar SET disponible = $1 WHERE id_lugar = $2 RETURNING *',
      [disponible, id]
    );

    if (updatedSpace.rows.length === 0) {
      return res.status(404).json({ message: 'Lugar no encontrado' });
    }

    res.json(updatedSpace.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar el lugar' });
  }
};

// @desc    Get count of free/occupied spaces for IoT/ESP32 display (Public)
// @route   GET /api/spaces/public/count
// @access  Public
const getPublicSpacesCount = async (req, res) => {
  try {
    // 1. Auto-expire reservations whose date and time have passed
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

    // Get all spaces
    const spacesResult = await db.query('SELECT * FROM Lugar');
    const spaces = spacesResult.rows;

    // Get active reservations for today
    const reservationsResult = await db.query(
      `SELECT id_lugar FROM Reserva 
       WHERE fecha >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date AND estado IN ('Espera', 'Atendido')`
    );
    const reservations = reservationsResult.rows;

    let freeCount = 0;
    spaces.forEach(space => {
      const isReserved = reservations.some(r => r.id_lugar === space.id_lugar);
      if (space.disponible && !isReserved) {
        freeCount++;
      }
    });

    res.json({
      total: spaces.length,
      free: freeCount,
      occupied: spaces.length - freeCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener conteo de lugares' });
  }
};

module.exports = { getSpaces, updateSpaceStatus, getPublicSpacesCount };
