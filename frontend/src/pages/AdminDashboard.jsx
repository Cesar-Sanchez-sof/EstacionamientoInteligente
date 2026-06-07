import React, { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const AdminDashboard = () => {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para el registro de usuario desde el panel admin
  const [registerForm, setRegisterForm] = useState({
    primer_nombre: '',
    segundo_nombre: '',
    primer_apellido: '',
    segundo_apellido: '',
    documento_tipo: 'DNI',
    documento_numero: '',
    placa_vehiculo: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [registerError, setRegisterError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');
  const [docTypes, setDocTypes] = useState([]);

  useEffect(() => {
    if (!user || user.rol !== 'ADMIN') {
      navigate('/');
      return;
    }

    const fetchData = async () => {
      try {
        const [spacesRes, resRes, docTypesRes] = await Promise.all([
          api.get('/spaces'),
          api.get('/reservations'),
          api.get('/auth/document-types')
        ]);
        setSpaces(spacesRes.data);
        setReservations(resRes.data);
        setDocTypes(docTypesRes.data);
        if (docTypesRes.data.length > 0) {
          setRegisterForm(prev => ({ ...prev, documento_tipo: docTypesRes.data[0] }));
        }
      } catch (error) {
        console.error('Error fetching admin data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, navigate]);

  const toggleSpaceStatus = async (id, currentStatus) => {
    try {
      await api.put(`/spaces/${id}`, { disponible: !currentStatus });
      // Refresh
      const spacesRes = await api.get('/spaces');
      setSpaces(spacesRes.data);
    } catch (error) {
      console.error('Error updating space', error);
    }
  };

  const deleteReservation = async (id) => {
    try {
      await api.delete(`/reservations/${id}`);
      const resRes = await api.get('/reservations');
      setReservations(resRes.data);
    } catch (error) {
      console.error('Error deleting res', error);
    }
  };

  const changeReservationStatus = async (id, newStatus) => {
    try {
      await api.put(`/reservations/${id}/status`, { estado: newStatus });
      const resRes = await api.get('/reservations');
      setReservations(resRes.data);
    } catch (error) {
      console.error('Error updating reservation status', error);
    }
  };

  const handleRegisterChange = (e) => {
    setRegisterForm({ ...registerForm, [e.target.name]: e.target.value });
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegisterError('');
    setRegisterSuccess('');

    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterError('Las contraseñas no coinciden');
      return;
    }

    // Validación de número de documento por expresión regular
    const { documento_tipo, documento_numero } = registerForm;
    if (documento_tipo === 'DNI') {
      if (!/^\d{8}$/.test(documento_numero)) {
        setRegisterError('El DNI debe tener exactamente 8 dígitos numéricos.');
        return;
      }
    } else if (documento_tipo === 'Pasaporte') {
      if (!/^[a-zA-Z]{3}\d{6}$/.test(documento_numero)) {
        setRegisterError('El Pasaporte debe tener exactamente 9 caracteres (3 letras y 6 números).');
        return;
      }
    } else if (documento_tipo === 'Carnet de Extranjeria' || documento_tipo === 'Carnet de Extranjería') {
      if (!/^\d{9}$/.test(documento_numero)) {
        setRegisterError('El Carnet de Extranjería debe tener exactamente 9 dígitos numéricos.');
        return;
      }
    }

    try {
      await api.post('/auth/register', registerForm);
      setRegisterSuccess('¡Usuario registrado exitosamente!');
      setRegisterForm({
        primer_nombre: '',
        segundo_nombre: '',
        primer_apellido: '',
        segundo_apellido: '',
        documento_tipo: docTypes[0] || 'DNI',
        documento_numero: '',
        placa_vehiculo: '',
        email: '',
        password: '',
        confirmPassword: ''
      });
    } catch (err) {
      setRegisterError(err.response?.data?.message || 'Error al registrar usuario');
    }
  };

  if (loading) return <div className="text-center mt-20">Cargando Panel Admin...</div>;

  // Prepare chart data
  const occupiedCount = spaces.filter(s => !s.disponible).length;
  const availableCount = spaces.filter(s => s.disponible).length;
  
  const chartData = [
    { name: 'Ocupados/Físico', cantidad: occupiedCount, fill: '#ff0055' },
    { name: 'Disponibles', cantidad: availableCount, fill: '#00ff66' },
    { name: 'Reservas Activas', cantidad: reservations.length, fill: '#00f3ff' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <h1 className="text-3xl font-bold">Panel Administrativo</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Gráfico de Ocupación */}
        <div className="glass-panel p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">Estado General</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#cbd5e1" />
                <YAxis stroke="#cbd5e1" />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gestión de Lugares */}
        <div className="glass-panel p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">Control de Espacios Físicos</h2>
          <div className="grid grid-cols-5 gap-2">
            {spaces.map(space => (
              <button
                key={space.id_lugar}
                onClick={() => toggleSpaceStatus(space.id_lugar, space.disponible)}
                className={`p-2 rounded font-bold text-center transition-colors ${
                  !space.disponible ? 'bg-red-500/20 text-red-500 border border-red-500' : 'bg-green-500/20 text-green-500 border border-green-500'
                }`}
              >
                #{space.numero}
                <div className="text-xs font-normal mt-1">{space.disponible ? 'LIBRE' : 'OCUPADO'}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4">Haz clic para alternar el estado físico de un lugar de forma manual (simulando sensor).</p>
        </div>
      </div>

      {/* Registrar Nuevo Usuario */}
      <div className="glass-panel p-6 rounded-xl">
        <h2 className="text-xl font-bold mb-4 text-white">Registrar Nuevo Usuario</h2>
        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          {registerError && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded text-sm text-center">
              {registerError}
            </div>
          )}
          {registerSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-500 p-3 rounded text-sm text-center">
              {registerSuccess}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Primer Nombre *</label>
              <input
                name="primer_nombre"
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                value={registerForm.primer_nombre}
                onChange={handleRegisterChange}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Segundo Nombre (opcional)</label>
              <input
                name="segundo_nombre"
                type="text"
                className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                value={registerForm.segundo_nombre}
                onChange={handleRegisterChange}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Primer Apellido *</label>
              <input
                name="primer_apellido"
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                value={registerForm.primer_apellido}
                onChange={handleRegisterChange}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Segundo Apellido *</label>
              <input
                name="segundo_apellido"
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                value={registerForm.segundo_apellido}
                onChange={handleRegisterChange}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Tipo Documento *</label>
              <select
                name="documento_tipo"
                className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                value={registerForm.documento_tipo}
                onChange={handleRegisterChange}
              >
                {docTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Nro Documento *</label>
              <input
                name="documento_numero"
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                value={registerForm.documento_numero}
                onChange={handleRegisterChange}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Placa Vehículo *</label>
              <input
                name="placa_vehiculo"
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm font-mono uppercase"
                value={registerForm.placa_vehiculo}
                onChange={handleRegisterChange}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Email *</label>
              <input
                name="email"
                type="email"
                required
                className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                value={registerForm.email}
                onChange={handleRegisterChange}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Contraseña *</label>
              <input
                name="password"
                type="password"
                required
                className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                value={registerForm.password}
                onChange={handleRegisterChange}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Confirmar Contraseña *</label>
              <input
                name="confirmPassword"
                type="password"
                required
                className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                value={registerForm.confirmPassword}
                onChange={handleRegisterChange}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 bg-[var(--neon-blue)] text-black font-bold rounded-lg hover:bg-opacity-90 transition-all shadow-[0_0_15px_rgba(0,243,255,0.4)] text-sm"
            >
              Registrar Usuario
            </button>
          </div>
        </form>
      </div>

      {/* Lista de Reservas */}
      <div className="glass-panel p-6 rounded-xl">
        <h2 className="text-xl font-bold mb-4">Todas las Reservas</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Usuario</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Lugar</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Fecha/Hora</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {reservations.map(res => (
                <tr key={res.id_reserva}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{res.id_reserva}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--neon-blue)]">{res.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">#{res.numero}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(res.fecha).toLocaleDateString()} {res.hora}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {res.estado === 'Espera' && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium text-xs">Espera</span>
                    )}
                    {res.estado === 'Atendido' && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium text-xs">Atendido</span>
                    )}
                    {res.estado === 'Cancelado' && (
                      <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-medium text-xs">Cancelado</span>
                    )}
                    {res.estado === 'Perdida' && (
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-medium text-xs">Perdida</span>
                    )}
                  </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    {res.estado === 'Espera' ? (
                      <>
                        <button
                          onClick={() => changeReservationStatus(res.id_reserva, 'Atendido')}
                          className="text-emerald-400 hover:text-emerald-300 font-semibold"
                        >
                          Atender
                        </button>
                        <span className="text-gray-600">|</span>
                        <button
                          onClick={() => changeReservationStatus(res.id_reserva, 'Cancelado')}
                          className="text-red-400 hover:text-red-300 font-semibold"
                        >
                          Cancelar
                        </button>
                        <span className="text-gray-600">|</span>
                        <button
                          onClick={() => changeReservationStatus(res.id_reserva, 'Perdida')}
                          className="text-rose-400 hover:text-rose-300 font-semibold"
                        >
                          Perdida
                        </button>
                      </>
                    ) : (
                      <span className="text-gray-500 text-xs">Sin acciones</span>
                    )}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
          {reservations.length === 0 && <p className="text-gray-400 mt-4 text-center">No hay reservas registradas.</p>}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
