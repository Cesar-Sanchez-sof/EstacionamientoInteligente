const db = require('./config/db');

async function inspect() {
  try {
    const res = await db.pool.query('SELECT * FROM Lugar');
    console.log('Filas reales de LUGAR:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await db.pool.end();
  }
}

inspect();
