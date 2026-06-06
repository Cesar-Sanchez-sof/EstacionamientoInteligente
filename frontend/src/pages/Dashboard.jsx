import React, { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import ParkingLot from '../components/3d/ParkingLot';

const Dashboard = () => {
  const user = useAuthStore((state) => state.user);
  const [spaces, setSpaces] = useState([]);
  const [myReservations, setMyReservations] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [bookingError, setBookingError] = useState('');
  const [reserveDate, setReserveDate] = useState('');
  const [reserveTime, setReserveTime] = useState('');
  
  // Registrar nuevo vehículo
  const [newPlate, setNewPlate] = useState('');
  const [vehicleError, setVehicleError] = useState('');

  const fetchData = async () => {
    try {
      const results = await Promise.allSettled([
        api.get('/spaces'),
        api.get('/reservations/myreservations'),
        api.get('/auth/myvehicles')
      ]);

      if (results[0].status === 'fulfilled') {
        setSpaces(results[0].value.data);
      } else {
        console.error('Error loading spaces:', results[0].reason);
      }

      if (results[1].status === 'fulfilled') {
        setMyReservations(results[1].value.data);
      } else {
        console.error('Error loading reservations:', results[1].reason);
      }

      if (results[2].status === 'fulfilled') {
        const vehiclesData = results[2].value.data;
        setVehicles(vehiclesData);
        if (vehiclesData.length > 0 && !selectedVehicleId) {
          setSelectedVehicleId(vehiclesData[0].id_vehiculo);
        }
      } else {
        console.error('Error loading vehicles:', results[2].reason);
      }
    } catch (error) {
      console.error('Unexpected error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [selectedVehicleId]);

  const handleSelectSpace = (space) => {
    if (space.statusColor === 'green') {
      setSelectedSpace(space);
      setBookingError('');
      // Pre-llenar con la fecha y hora actuales
      const today = new Date().toISOString().split('T')[0];
      const nowTime = new Date().toTimeString().split(' ')[0].slice(0, 5); // Formato HH:MM
      setReserveDate(today);
      setReserveTime(nowTime);
    }
  };

  const handleAddVehicleSubmit = async (e) => {
    e.preventDefault();
    setVehicleError('');
    if (!newPlate.trim()) return;
    try {
      const response = await api.post('/auth/myvehicles', { placa_vehiculo: newPlate });
      setVehicles(prev => [response.data, ...prev]);
      setSelectedVehicleId(response.data.id_vehiculo);
      setNewPlate('');
    } catch (error) {
      setVehicleError(error.response?.data?.message || 'Error al registrar placa');
    }
  };

  const handleBook = async () => {
    if (!selectedSpace) return;
    if (!selectedVehicleId) {
      setBookingError('Debes seleccionar un vehículo primero.');
      return;
    }
    if (!reserveDate || !reserveTime) {
      setBookingError('Por favor selecciona la fecha y hora de la reserva.');
      return;
    }
    try {
      await api.post('/reservations', {
        id_lugar: selectedSpace.id_lugar,
        id_vehiculo: selectedVehicleId,
        fecha: reserveDate,
        hora: reserveTime
      });
      
      setSelectedSpace(null);
      fetchData(); // Refresh spaces and reservations
    } catch (error) {
      setBookingError(error.response?.data?.message || 'Error al reservar');
    }
  };

  const handleCancel = async (id) => {
    try {
      await api.delete(`/reservations/${id}`);
      fetchData();
    } catch (error) {
      console.error('Error canceling reservation:', error);
    }
  };

  if (loading) return <div className="text-center mt-20">Cargando...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Left column: 3D Map */}
        <div className="flex-grow">
          <h2 className="text-2xl font-bold mb-4">Croquis del Estacionamiento</h2>
          <div className="mb-4 flex gap-4 text-sm font-medium">
            <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#00ff66]"></div> Disponible</span>
            <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#ff0055]"></div> Ocupado</span>
            <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#00f3ff]"></div> Tu Reserva</span>
          </div>
          <ParkingLot spaces={spaces} onSelectSpace={handleSelectSpace} />
        </div>

        {/* Right column: Booking & History */}
        <div className="w-full md:w-96 space-y-6">
          {/* Vehículos del Usuario */}
          <div className="glass-panel p-6 rounded-xl">
            <h3 className="text-xl font-bold mb-3">Mis Vehículos</h3>
            {vehicles.length === 0 ? (
              <p className="text-gray-400 text-xs mb-3">No tienes vehículos registrados.</p>
            ) : (
              <div className="mb-3">
                <label className="text-xs text-gray-400 block mb-1">Selecciona tu Vehículo para Reservar:</label>
                <select
                  className="w-full rounded-lg px-3 py-2 border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                >
                  {vehicles.map(v => (
                    <option key={v.id_vehiculo} value={v.id_vehiculo}>
                      {v.placa_vehiculo}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Reservar Espacio */}
          <div className="glass-panel p-6 rounded-xl">
            <h3 className="text-xl font-bold mb-4">Reservar Espacio</h3>
            {selectedSpace ? (
              <div className="space-y-4">
                <p>Lugar seleccionado: <span className="font-bold text-[var(--neon-blue)]">#{selectedSpace.numero}</span></p>
                
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Fecha de Reserva:</label>
                  <input
                    type="date"
                    className="w-full rounded-lg px-3 py-2 border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                    value={reserveDate}
                    onChange={(e) => setReserveDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Hora de Reserva:</label>
                  <input
                    type="time"
                    className="w-full rounded-lg px-3 py-2 border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                    value={reserveTime}
                    onChange={(e) => setReserveTime(e.target.value)}
                  />
                </div>

                {bookingError && <p className="text-red-400 text-sm mb-2">{bookingError}</p>}
                
                <button
                  onClick={handleBook}
                  className="w-full py-2 bg-[var(--neon-blue)] text-black font-bold rounded-lg hover:bg-opacity-90 shadow-[0_0_15px_rgba(0,243,255,0.4)]"
                >
                  Confirmar Reserva
                </button>
                <button
                  onClick={() => setSelectedSpace(null)}
                  className="w-full py-2 mt-2 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-600"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Haz clic en un espacio verde en el mapa para seleccionarlo.</p>
            )}
          </div>

          {/* Historial de Reservas */}
          <div className="glass-panel p-6 rounded-xl">
            <h3 className="text-xl font-bold mb-4">Mis Reservas</h3>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {myReservations.length === 0 ? (
                <p className="text-gray-400 text-sm">No tienes reservas activas.</p>
              ) : (
                myReservations.map((res) => (
                  <div key={res.id_reserva} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-[var(--neon-blue)]">Lugar #{res.numero}</span>
                      <span className="text-xs text-gray-400">{new Date(res.fecha).toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs text-gray-300 mb-2">
                      Vehículo: <span className="font-mono text-white bg-gray-700/50 px-1.5 py-0.5 rounded">{res.placa_vehiculo || 'No registrado'}</span>
                    </div>
                    <button
                      onClick={() => handleCancel(res.id_reserva)}
                      className="text-sm text-red-400 hover:text-red-300 transition-colors"
                    >
                      Cancelar Reserva
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
