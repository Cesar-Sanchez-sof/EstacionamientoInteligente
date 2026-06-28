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

    // 1. Get current status to compare
    const currentSpaceRes = await db.query('SELECT disponible, numero FROM Lugar WHERE id_lugar = $1', [id]);
    if (currentSpaceRes.rows.length === 0) {
      return res.status(404).json({ message: 'Lugar no encontrado' });
    }
    const currentSpace = currentSpaceRes.rows[0];

    // 2. Perform update
    const updatedSpace = await db.query(
      'UPDATE Lugar SET disponible = $1 WHERE id_lugar = $2 RETURNING *',
      [disponible, id]
    );

    // 3. Log the change if it changed
    if (currentSpace.disponible !== disponible) {
      const tipoMovimiento = disponible ? 'SALIDA' : 'INGRESO';
      await db.query(
        'INSERT INTO registro_vehicular (id_lugar, tipo) VALUES ($1, $2)',
        [id, tipoMovimiento]
      );
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

// @desc    Get recent parking sensor logs (Admin)
// @route   GET /api/spaces/logs
// @access  Private/Admin
const getSpacesLogs = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.id_registro, r.tipo, r.fecha_hora, l.numero
      FROM registro_vehicular r
      JOIN Lugar l ON r.id_lugar = l.id_lugar
      ORDER BY r.fecha_hora DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener los logs de los espacios' });
  }
};

// @desc    Get barrier status
// @route   GET /api/spaces/barrier/status
// @access  Private
const getBarrierStatus = async (req, res) => {
  try {
    const result = await db.query('SELECT id_barrera, estado, updated_at FROM barrera ORDER BY id_barrera ASC');
    
    // Auto-close check for each barrier
    const processedBarriers = [];
    for (const row of result.rows) {
      let currentEstado = row.estado;
      if (row.estado === 'ABIERTA') {
        const secondsPassed = (new Date() - new Date(row.updated_at)) / 1000;
        if (secondsPassed >= 5) {
          await db.query(
            "UPDATE barrera SET estado = 'CERRADA', updated_at = CURRENT_TIMESTAMP WHERE id_barrera = $1",
            [row.id_barrera]
          );
          currentEstado = 'CERRADA';
        }
      }
      processedBarriers.push({
        id_barrera: row.id_barrera,
        estado: currentEstado
      });
    }

    res.json(processedBarriers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener el estado de las barreras' });
  }
};

// @desc    Open barrier (Admin)
// @route   POST /api/spaces/barrier/open
// @access  Private/Admin
const openBarrier = async (req, res) => {
  try {
    const { barrierId } = req.body; // 1 = Entrada, 2 = Salida
    if (!barrierId || ![1, 2].includes(Number(barrierId))) {
      return res.status(400).json({ message: 'ID de barrera inválido. Debe ser 1 (Entrada) o 2 (Salida)' });
    }

    await db.query(
      "INSERT INTO barrera (id_barrera, estado) VALUES ($1, 'CERRADA') ON CONFLICT (id_barrera) DO NOTHING",
      [barrierId]
    );

    const updated = await db.query(
      "UPDATE barrera SET estado = 'ABIERTA', updated_at = CURRENT_TIMESTAMP WHERE id_barrera = $1 RETURNING *",
      [barrierId]
    );
    res.json(updated.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al abrir la barrera' });
  }
};

module.exports = {
  getSpaces,
  updateSpaceStatus,
  getPublicSpacesCount,
  getSpacesLogs,
  getBarrierStatus,
  openBarrier
};
