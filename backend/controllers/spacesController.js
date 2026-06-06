const db = require('../config/db');

// @desc    Get all parking spaces with their dynamic status
// @route   GET /api/spaces
// @access  Private (Requires token to calculate "Reservado por ti")
const getSpaces = async (req, res) => {
  try {
    const userId = req.user.id;
    // Get all spaces
    const spacesResult = await db.query('SELECT * FROM Lugar ORDER BY numero ASC');
    const spaces = spacesResult.rows;

    // Get active reservations for today (assuming reservations are per day)
    // For simplicity, we check if there's any reservation in the future or today
    const reservationsResult = await db.query(
      `SELECT id_lugar, id_usuario FROM Reserva 
       WHERE fecha >= CURRENT_DATE`
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

module.exports = { getSpaces, updateSpaceStatus };
