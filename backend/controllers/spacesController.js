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

const getPublicSpacesStatus = async (req, res) => {
  try {
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

    const spacesResult = await db.query('SELECT id_lugar, numero, disponible FROM Lugar ORDER BY numero ASC');
    const spaces = spacesResult.rows;

    const reservationsResult = await db.query(
      `SELECT id_lugar FROM Reserva 
       WHERE fecha >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date AND estado IN ('Espera', 'Atendido')`
    );
    const reservations = reservationsResult.rows;

    const result = spaces.map(space => {
      const hasReservation = reservations.some(r => r.id_lugar === space.id_lugar);
      return {
        id_lugar: space.id_lugar,
        numero: space.numero,
        disponible: space.disponible,
        reservado: hasReservation
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching public spaces status:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

const getHistoricalUsageReport = async (req, res) => {
  try {
    const { tipo, fecha, mes, anio } = req.query;

    let startDate, endDate;

    if (tipo === 'dia') {
      if (!fecha) {
        return res.status(400).json({ message: 'Fecha es requerida para reporte diario' });
      }
      startDate = new Date(`${fecha}T00:00:00-05:00`);
      endDate = new Date(`${fecha}T23:59:59-05:00`);
    } else if (tipo === 'mes') {
      if (!anio || !mes) {
        return res.status(400).json({ message: 'Año y mes son requeridos para reporte mensual' });
      }
      const yearNum = Number(anio);
      const monthNum = Number(mes) - 1;
      startDate = new Date(yearNum, monthNum, 1, 0, 0, 0);
      endDate = new Date(yearNum, monthNum + 1, 0, 23, 59, 59);
    } else if (tipo === 'anio') {
      if (!anio) {
        return res.status(400).json({ message: 'Año es requerido para reporte anual' });
      }
      const yearNum = Number(anio);
      startDate = new Date(yearNum, 0, 1, 0, 0, 0);
      endDate = new Date(yearNum, 11, 31, 23, 59, 59);
    } else {
      return res.status(400).json({ message: 'Tipo de reporte inválido. Debe ser dia, mes o anio' });
    }

    const now = new Date();
    let limitDate = endDate;
    if (endDate > now) {
      limitDate = now;
    }

    let totalPeriodMs;
    if (tipo === 'dia') {
      totalPeriodMs = 24 * 60 * 60 * 1000;
    } else {
      totalPeriodMs = endDate.getTime() - startDate.getTime();
    }
    if (totalPeriodMs <= 0) totalPeriodMs = 1;

    const spacesRes = await db.query('SELECT id_lugar, numero FROM Lugar ORDER BY numero ASC');
    const spaces = spacesRes.rows;

    const occupancyMap = {};
    const detectionsMap = {};

    // Calcula el tiempo total ocupado por cada cajón de manera robusta usando una máquina de estados
    for (const space of spaces) {
      const id = space.id_lugar;
      
      let state = 'FREE';
      let lastChangeTime = null;
      let totalDetections = 0;
      
      // 2. Obtiene todos los eventos de ingreso/salida ocurridos durante el rango
      const eventsRes = await db.query(
        `SELECT tipo, fecha_hora FROM registro_vehicular 
         WHERE id_lugar = $1 AND fecha_hora >= $2 AND fecha_hora <= $3 
         ORDER BY fecha_hora ASC`,
        [id, startDate.toISOString(), limitDate.toISOString()]
      );
      
      let totalOccupiedTime = 0;
      
      for (const event of eventsRes.rows) {
        const eventTime = new Date(event.fecha_hora);
        
        if (event.tipo === 'INGRESO') {
          totalDetections++;
          if (state === 'FREE') {
            state = 'OCCUPIED';
            lastChangeTime = eventTime;
          }
        } else if (event.tipo === 'SALIDA') {
          if (state === 'OCCUPIED') {
            const duration = eventTime - lastChangeTime;
            totalOccupiedTime += duration;
            state = 'FREE';
            lastChangeTime = null;
          }
        }
      }
      
      // 3. Si al finalizar el periodo sigue ocupado, suma el remanente hasta limitDate
      if (state === 'OCCUPIED' && lastChangeTime) {
        const duration = limitDate - lastChangeTime;
        totalOccupiedTime += duration;
      }
      
      occupancyMap[id] = totalOccupiedTime;
      detectionsMap[id] = totalDetections;
    }

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    const reservationsRes = await db.query(`
      SELECT 
          id_lugar,
          COUNT(*) AS total_reservas,
          COUNT(*) FILTER (WHERE estado = 'Atendido') AS reservas_atendidas,
          COUNT(*) FILTER (WHERE estado IN ('Cancelado', 'Perdida')) AS reservas_no_atendidas
      FROM reserva
      WHERE fecha >= $1::date AND fecha <= $2::date
      GROUP BY id_lugar
    `, [startStr, endStr]);
    const reservationMap = {};
    reservationsRes.rows.forEach(r => {
      reservationMap[r.id_lugar] = {
        total: Number(r.total_reservas),
        atendidas: Number(r.reservas_atendidas),
        noAtendidas: Number(r.reservas_no_atendidas)
      };
    });

    const report = spaces.map(space => {
      const id = space.id_lugar;
      let tiempoOcupadoMs = occupancyMap[id] || 0;
      
      if (tiempoOcupadoMs > totalPeriodMs) {
        tiempoOcupadoMs = totalPeriodMs;
      }
      
      const tiempoLibreMs = totalPeriodMs - tiempoOcupadoMs;
      const porcentajeUtilizacion = Number(((tiempoOcupadoMs / totalPeriodMs) * 100).toFixed(1));
      
      const resData = reservationMap[id] || { total: 0, atendidas: 0, noAtendidas: 0 };

      return {
        id_lugar: id,
        numero: space.numero,
        tiempoOcupadoMs,
        tiempoLibreMs,
        porcentajeUtilizacion,
        totalReservas: resData.total,
        reservasAtendidas: resData.atendidas,
        reservasCanceladas: resData.noAtendidas,
        usosFisicos: detectionsMap[id] || 0
      };
    });

    res.json(report);
  } catch (error) {
    console.error('Error al generar reporte de uso:', error);
    res.status(500).json({ message: 'Error interno al generar el reporte de uso' });
  }
};

const registerAccessEntry = async (req, res) => {
  const { codigo_rfid } = req.body;
  if (!codigo_rfid) {
    return res.status(400).json({ success: false, message: 'Código RFID es requerido' });
  }

  try {
    await saveLastScannedRfid(codigo_rfid);
    const rfidSanitized = codigo_rfid.replace(/\s+/g, '').toUpperCase().trim();
    const userQuery = await db.query(
      `SELECT u.id_usuario, p.primer_nombre, p.primer_apellido 
       FROM Usuario u
       JOIN Persona p ON u.id_persona = p.id_persona
       WHERE REPLACE(u.codigo_rfid, ' ', '') = $1`,
      [rfidSanitized]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tarjeta RFID no registrada' });
    }

    const user = userQuery.rows[0];
    const nombreCompleto = `${user.primer_nombre} ${user.primer_apellido}`;

    await db.query(
      `INSERT INTO historial_accesos (id_usuario, tipo, codigo_rfid) 
       VALUES ($1, 'INGRESO', $2)`,
      [user.id_usuario, codigo_rfid.toUpperCase().trim()]
    );

    await db.query("UPDATE barrera SET estado = 'ABIERTA', updated_at = CURRENT_TIMESTAMP WHERE id_barrera = 1");

    return res.status(200).json({
      success: true,
      message: 'Acceso de entrada concedido',
      usuario: nombreCompleto
    });
  } catch (error) {
    console.error('Error al registrar acceso de entrada:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const registerAccessExit = async (req, res) => {
  const { codigo_rfid } = req.body;
  if (!codigo_rfid) {
    return res.status(400).json({ success: false, message: 'Código RFID es requerido' });
  }

  try {
    await saveLastScannedRfid(codigo_rfid);
    const rfidSanitized = codigo_rfid.replace(/\s+/g, '').toUpperCase().trim();
    const userQuery = await db.query(
      `SELECT u.id_usuario, p.primer_nombre, p.primer_apellido 
       FROM Usuario u
       JOIN Persona p ON u.id_persona = p.id_persona
       WHERE REPLACE(u.codigo_rfid, ' ', '') = $1`,
      [rfidSanitized]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tarjeta RFID no registrada' });
    }

    const user = userQuery.rows[0];
    const nombreCompleto = `${user.primer_nombre} ${user.primer_apellido}`;

    await db.query(
      `INSERT INTO historial_accesos (id_usuario, tipo, codigo_rfid) 
       VALUES ($1, 'SALIDA', $2)`,
      [user.id_usuario, codigo_rfid.toUpperCase().trim()]
    );

    await db.query("UPDATE barrera SET estado = 'ABIERTA', updated_at = CURRENT_TIMESTAMP WHERE id_barrera = 2");

    return res.status(200).json({
      success: true,
      message: 'Acceso de salida concedido',
      usuario: nombreCompleto
    });
  } catch (error) {
    console.error('Error al registrar acceso de salida:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const getAccessLogs = async (req, res) => {
  try {
    const logsQuery = await db.query(
      `SELECT h.id_acceso, h.tipo, h.fecha_hora, h.codigo_rfid,
              u.email, p.primer_nombre, p.primer_apellido,
              COALESCE(v.placa_vehiculo, 'SIN PLACA') AS placa_vehiculo
       FROM historial_accesos h
       JOIN Usuario u ON h.id_usuario = u.id_usuario
       JOIN Persona p ON u.id_persona = p.id_persona
       LEFT JOIN Vehiculo v ON v.id_persona = p.id_persona
       ORDER BY h.fecha_hora DESC`
    );

    return res.status(200).json(logsQuery.rows);
  } catch (error) {
    console.error('Error al obtener historial de accesos:', error);
    return res.status(500).json({ message: 'Error interno del servidor al obtener historial' });
  }
};

const saveLastScannedRfid = async (codigo_rfid) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS ultimo_escaneo (
        id INT PRIMARY KEY DEFAULT 1,
        codigo_rfid VARCHAR(50) NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await db.query(`
      INSERT INTO ultimo_escaneo (id, codigo_rfid, updated_at)
      VALUES (1, $1, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET codigo_rfid = EXCLUDED.codigo_rfid, updated_at = EXCLUDED.updated_at
    `, [codigo_rfid.toUpperCase().trim()]);
  } catch (error) {
    console.error('Error saving last scanned RFID:', error);
  }
};

const getLastScannedRfid = async (req, res) => {
  try {
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ultimo_escaneo'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.status(200).json({ codigo_rfid: null });
    }
    
    const result = await db.query("SELECT codigo_rfid, updated_at FROM ultimo_escaneo WHERE id = 1");
    if (result.rows.length === 0) {
      return res.status(200).json({ codigo_rfid: null });
    }
    
    const scanTime = new Date(result.rows[0].updated_at);
    const now = new Date();
    const diffMs = now - scanTime;
    const diffMins = diffMs / (1000 * 60);
    
    if (diffMins > 5) {
      return res.status(200).json({ codigo_rfid: null, message: 'El último escaneo es antiguo' });
    }
    
    return res.status(200).json({ codigo_rfid: result.rows[0].codigo_rfid });
  } catch (error) {
    console.error('Error al obtener el último RFID escaneado:', error);
    return res.status(500).json({ message: 'Error interno al obtener el último escaneo' });
  }
};

module.exports = {
  getSpaces,
  updateSpaceStatus,
  getPublicSpacesCount,
  getSpacesLogs,
  getBarrierStatus,
  openBarrier,
  getPublicSpacesStatus,
  getHistoricalUsageReport,
  registerAccessEntry,
  registerAccessExit,
  getAccessLogs,
  getLastScannedRfid
};
