import React, { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  Users, BarChart3, Car, Search, CheckCircle, XCircle, AlertCircle, Clock
} from 'lucide-react';

const AdminDashboard = () => {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [users, setUsers] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics', 'parking', 'users'

  useEffect(() => {
    document.title = 'Panel Administrativo - ParkFlow';
  }, []);

  // Search filters
  const [resSearch, setResSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // States for filtering reservations in the Pie Chart (Rendimiento e Historial de Reservas)
  const [filterPeriod, setFilterPeriod] = useState('day'); // 'day', 'month', 'year', 'all'
  const [filterDate, setFilterDate] = useState(() => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const partMap = {};
    parts.forEach(p => partMap[p.type] = p.value);
    return `${partMap.year}-${partMap.month}-${partMap.day}`;
  });
  
  const [filterMonth, setFilterMonth] = useState(() => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const partMap = {};
    parts.forEach(p => partMap[p.type] = p.value);
    return `${partMap.year}-${partMap.month}`;
  });

  const [filterYear, setFilterYear] = useState(() => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      year: 'numeric'
    });
    const parts = formatter.formatToParts(new Date());
    const partMap = {};
    parts.forEach(p => partMap[p.type] = p.value);
    return partMap.year;
  });

  // States for user registration from admin panel
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

  // States for editing user in modal
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    primer_nombre: '',
    segundo_nombre: '',
    primer_apellido: '',
    segundo_apellido: '',
    documento_tipo: 'DNI',
    documento_numero: '',
    email: '',
    password: ''
  });
  const [editingUserVehicles, setEditingUserVehicles] = useState([]);
  const [newVehiclePlate, setNewVehiclePlate] = useState('');
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [addVehicleError, setAddVehicleError] = useState('');

  // IoT & Telemetry States
  const [barriers, setBarriers] = useState([
    { id_barrera: 1, estado: 'CERRADA' },
    { id_barrera: 2, estado: 'CERRADA' }
  ]);
  const [sensorLogs, setSensorLogs] = useState([]);
  const [countdownEntrada, setCountdownEntrada] = useState(null);
  const [countdownSalida, setCountdownSalida] = useState(null);
  const [barrierAlert, setBarrierAlert] = useState(null);
  const [alertTimeoutId, setAlertTimeoutId] = useState(null);

  const handleEditClick = async (u) => {
    setEditingUser(u);
    setEditError('');
    setEditSuccess('');
    setAddVehicleError('');
    setNewVehiclePlate('');
    setEditForm({
      primer_nombre: u.primer_nombre || '',
      segundo_nombre: u.segundo_nombre || '',
      primer_apellido: u.primer_apellido || '',
      segundo_apellido: u.segundo_apellido || '',
      documento_tipo: u.documento_tipo || 'DNI',
      documento_numero: u.numero_documento || '',
      email: u.email || '',
      password: ''
    });
    try {
      const response = await api.get(`/auth/admin/users/${u.id_usuario}/vehicles`);
      setEditingUserVehicles(response.data);
    } catch (err) {
      console.error('Error fetching user vehicles:', err);
    }
  };

  const handleEditFormChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditSuccess('');
    try {
      await api.put(`/auth/admin/users/${editingUser.id_usuario}`, editForm);
      setEditSuccess('Usuario actualizado exitosamente.');
      const usersRes = await api.get('/auth/users');
      setUsers(usersRes.data);
    } catch (err) {
      setEditError(err.response?.data?.message || 'Error al actualizar usuario');
    }
  };

  const handleAdminAddVehicle = async (e) => {
    e.preventDefault();
    setAddVehicleError('');
    if (!newVehiclePlate.trim()) return;
    try {
      const response = await api.post('/auth/admin/add-vehicle', {
        userId: editingUser.id_usuario,
        placa_vehiculo: newVehiclePlate
      });
      setEditingUserVehicles(prev => [response.data, ...prev]);
      setNewVehiclePlate('');
    } catch (err) {
      setAddVehicleError(err.response?.data?.message || 'Error al agregar vehículo');
    }
  };

  const showTemporaryAlert = (message, type) => {
    if (alertTimeoutId) {
      clearTimeout(alertTimeoutId);
    }
    setBarrierAlert({ message, type });
    const timer = setTimeout(() => {
      setBarrierAlert(null);
    }, 3500);
    setAlertTimeoutId(timer);
  };

  const handleOpenBarrier = async (barrierId) => {
    try {
      await api.post('/spaces/barrier/open', { barrierId });
      setBarriers(prev => prev.map(b => b.id_barrera === barrierId ? { ...b, estado: 'ABIERTA' } : b));
      const name = barrierId === 1 ? 'Entrada' : 'Salida';
      if (barrierId === 1) {
        setCountdownEntrada(5);
      } else {
        setCountdownSalida(5);
      }
      showTemporaryAlert(`⚠️ Barrera de ${name} Abierta - El vehículo puede pasar`, 'info');
    } catch (err) {
      console.error('Error opening barrier', err);
      showTemporaryAlert('❌ Error al intentar abrir la barrera', 'error');
    }
  };

  useEffect(() => {
    if (countdownEntrada === null) return;
    if (countdownEntrada === 0) {
      setCountdownEntrada(null);
      return;
    }
    const timer = setTimeout(() => {
      setCountdownEntrada(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdownEntrada]);

  useEffect(() => {
    if (countdownSalida === null) return;
    if (countdownSalida === 0) {
      setCountdownSalida(null);
      return;
    }
    const timer = setTimeout(() => {
      setCountdownSalida(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdownSalida]);

  const fetchData = async () => {
    try {
      const [spacesRes, resRes, docTypesRes, usersRes, logsRes, barrierRes] = await Promise.all([
        api.get('/spaces'),
        api.get('/reservations'),
        api.get('/auth/document-types'),
        api.get('/auth/users'),
        api.get('/spaces/logs'),
        api.get('/spaces/barrier/status')
      ]);
      setSpaces(spacesRes.data);
      setReservations(resRes.data);
      setDocTypes(docTypesRes.data);
      setUsers(usersRes.data);
      setSensorLogs(logsRes.data);
      setBarriers(barrierRes.data);
      if (docTypesRes.data.length > 0 && !registerForm.documento_tipo) {
        setRegisterForm(prev => ({ ...prev, documento_tipo: docTypesRes.data[0] }));
      }
    } catch (error) {
      console.error('Error fetching admin data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.rol !== 'ADMIN') {
      navigate('/');
      return;
    }
    fetchData();
  }, [user, navigate]);

  // Polling for real-time sensor updates and barrier status
  useEffect(() => {
    if (!user || user.rol !== 'ADMIN') return;

    const interval = setInterval(async () => {
      try {
        const [spacesRes, logsRes, barrierRes] = await Promise.all([
          api.get('/spaces'),
          api.get('/spaces/logs'),
          api.get('/spaces/barrier/status')
        ]);
        setSpaces(spacesRes.data);
        setSensorLogs(logsRes.data);
        
        setBarriers(prevBarriers => {
          const nextBarriers = barrierRes.data;
          
          nextBarriers.forEach(next => {
            const prev = prevBarriers.find(p => p.id_barrera === next.id_barrera);
            if (prev && prev.estado !== next.estado) {
              const name = next.id_barrera === 1 ? 'Entrada' : 'Salida';
              if (next.estado === 'ABIERTA') {
                showTemporaryAlert(`⚠️ Barrera de ${name} Abierta`, 'info');
              } else if (next.estado === 'CERRADA' && prev.estado === 'ABIERTA') {
                showTemporaryAlert(`🔒 Barrera de ${name} Cerrada`, 'success');
              }
            }
          });
          
          return nextBarriers;
        });
      } catch (err) {
        console.error('Error polling admin data', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [user]);

  const toggleSpaceStatus = async (id, currentStatus) => {
    try {
      await api.put(`/spaces/${id}`, { disponible: !currentStatus });
      const [spacesRes, logsRes] = await Promise.all([
        api.get('/spaces'),
        api.get('/spaces/logs')
      ]);
      setSpaces(spacesRes.data);
      setSensorLogs(logsRes.data);
    } catch (error) {
      console.error('Error updating space', error);
    }
  };

  const changeReservationStatus = async (id, newStatus) => {
    try {
      await api.put(`/reservations/${id}/status`, { estado: newStatus });
      const resRes = await api.get('/reservations');
      setReservations(resRes.data);
      // Refresh spaces just in case status change freed/occupied a space
      const [spacesRes, logsRes] = await Promise.all([
        api.get('/spaces'),
        api.get('/spaces/logs')
      ]);
      setSpaces(spacesRes.data);
      setSensorLogs(logsRes.data);
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
      // Refresh user list
      const usersRes = await api.get('/auth/users');
      setUsers(usersRes.data);
    } catch (err) {
      setRegisterError(err.response?.data?.message || 'Error al registrar usuario');
    }
  };

  if (loading) return <div className="text-center mt-20 text-white font-semibold">Cargando Panel Admin...</div>;

  // Recharts: general occupancy bar data
  const occupiedCount = spaces.filter(s => !s.disponible).length;
  const availableCount = spaces.filter(s => s.disponible).length;
  
  const barChartData = [
    { name: 'Ocupados', cantidad: occupiedCount, fill: '#ff0055' },
    { name: 'Disponibles', cantidad: availableCount, fill: '#00ff66' },
    { name: 'Reservas Activas', cantidad: reservations.filter(r => ['Espera', 'Atendido'].includes(r.estado)).length, fill: '#00f3ff' }
  ];

  // Lógica de filtrado de reservas para la gráfica de rendimiento e historial
  const filteredPieReservations = reservations.filter(res => {
    if (!res.fecha) return false;
    
    // Parse fecha string safely to avoid timezone shift
    const datePart = typeof res.fecha === 'string' ? res.fecha.split('T')[0] : '';
    if (!datePart) return false;
    const [rYear, rMonth, rDay] = datePart.split('-').map(Number);
    const rMonthStr = rMonth < 10 ? `0${rMonth}` : `${rMonth}`;
    const rDayStr = rDay < 10 ? `0${rDay}` : `${rDay}`;

    if (filterPeriod === 'day') {
      return `${rYear}-${rMonthStr}-${rDayStr}` === filterDate;
    } else if (filterPeriod === 'month') {
      return `${rYear}-${rMonthStr}` === filterMonth;
    } else if (filterPeriod === 'year') {
      return rYear.toString() === filterYear.toString();
    }
    return true; // 'all'
  });

  // Recharts: pie chart data of reservation states (filtered)
  const pieStatusCounts = { Espera: 0, Atendido: 0, Cancelado: 0, Perdida: 0 };
  filteredPieReservations.forEach(r => {
    if (pieStatusCounts[r.estado] !== undefined) {
      pieStatusCounts[r.estado]++;
    }
  });

  const pieChartData = [
    { name: 'En Espera', value: pieStatusCounts.Espera, color: '#f59e0b' },
    { name: 'Atendidas', value: pieStatusCounts.Atendido, color: '#10b981' },
    { name: 'Canceladas', value: pieStatusCounts.Cancelado, color: '#ef4444' },
    { name: 'Perdidas', value: pieStatusCounts.Perdida, color: '#f43f5e' }
  ].filter(item => item.value > 0);

  const totalReservationsPeriod = filteredPieReservations.length;

  // Generate Activity Logs / Report Logs from reservations sorted chronologically
  const activityLogs = reservations.map(res => {
    let message = '';
    let timestamp = res.updated_at || res.created_at;
    let icon = <Clock className="h-4 w-4 text-gray-400" />;

    const formattedTime = new Date(timestamp).toLocaleString('es-PE', { 
      timeZone: 'America/Bogota',
      hour12: false
    });

    const plateText = res.placa_vehiculo ? ` (Vehículo: ${res.placa_vehiculo})` : '';

    if (res.estado === 'Espera') {
      message = `El usuario ${res.email}${plateText} agendó el Lugar #${res.numero} para el ${new Date(res.fecha).toLocaleDateString()} a las ${res.hora.slice(0, 5)}`;
      icon = <Clock className="h-4 w-4 text-amber-400" />;
    } else if (res.estado === 'Atendido') {
      message = `La reserva de ${res.email}${plateText} para el Lugar #${res.numero} se marcó como ATENDIDA (vehículo ingresado)`;
      icon = <CheckCircle className="h-4 w-4 text-emerald-400" />;
    } else if (res.estado === 'Cancelado') {
      message = `La reserva de ${res.email}${plateText} para el Lugar #${res.numero} fue CANCELADA`;
      icon = <XCircle className="h-4 w-4 text-red-400" />;
    } else if (res.estado === 'Perdida') {
      message = `La reserva de ${res.email}${plateText} para el Lugar #${res.numero} expiró a estado PERDIDA (no se presentó)`;
      icon = <AlertCircle className="h-4 w-4 text-rose-400" />;
    }

    return {
      id: res.id_reserva + '-' + res.estado,
      message,
      time: formattedTime,
      icon
    };
  });

  // Filter lists based on search
  const filteredReservations = reservations.filter(res => 
    res.email.toLowerCase().includes(resSearch.toLowerCase()) || 
    res.numero.toString().includes(resSearch) ||
    res.estado.toLowerCase().includes(resSearch.toLowerCase())
  );

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.primer_nombre.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.primer_apellido.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.numero_documento.includes(userSearch)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 relative">
      {/* Alerta flotante de barrera */}
      {barrierAlert && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border shadow-2xl backdrop-blur-xl transition-all duration-300 transform translate-y-0 scale-100 ${
          barrierAlert.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/10' 
            : barrierAlert.type === 'error'
            ? 'bg-red-500/10 border-red-500/30 text-red-400 shadow-red-500/10'
            : 'bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-blue-500/10'
        }`}>
          <div className="w-2 h-2 rounded-full animate-ping bg-current"></div>
          <span className="font-semibold text-sm">{barrierAlert.message}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-700 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Panel Administrativo</h1>
          <p className="text-sm text-gray-400 mt-1">Supervisión en tiempo real y administración del estacionamiento</p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap md:flex-nowrap gap-2 mt-4 md:mt-0 bg-slate-900/60 p-1 rounded-xl border border-gray-800 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex-1 md:flex-none ${
              activeTab === 'analytics'
                ? 'bg-[var(--neon-blue)] text-black shadow-[0_0_15px_rgba(0,243,255,0.3)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <BarChart3 size={16} />
            Estadísticas y Reportes
          </button>
          <button
            onClick={() => setActiveTab('parking')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex-1 md:flex-none ${
              activeTab === 'parking'
                ? 'bg-[var(--neon-blue)] text-black shadow-[0_0_15px_rgba(0,243,255,0.3)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Car size={16} />
            Estacionamiento y Reservas
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex-1 md:flex-none ${
              activeTab === 'users'
                ? 'bg-[var(--neon-blue)] text-black shadow-[0_0_15px_rgba(0,243,255,0.3)]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users size={16} />
            Gestión de Usuarios
          </button>
        </div>
      </div>

      {/* TAB 1: ANALYTICS & REPORTS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Ocupación General Bar Chart */}
            <div className="glass-panel p-6 rounded-xl">
              <h2 className="text-xl font-bold mb-4 text-white">Estado General de Cajones</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#cbd5e1" />
                    <YAxis stroke="#cbd5e1" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                    <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>
                      {barChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Reservas Status Pie Chart */}
            <div className="glass-panel p-6 rounded-xl flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                  <h2 className="text-xl font-bold text-white font-mono tracking-tight">Rendimiento e Historial de Reservas</h2>
                  
                  {/* Controles de filtro */}
                  <div className="flex gap-2 items-center">
                    <select
                      className="rounded-lg px-2 py-1 border border-gray-700 bg-gray-900/60 text-white focus:outline-none text-xs"
                      value={filterPeriod}
                      onChange={(e) => setFilterPeriod(e.target.value)}
                    >
                      <option value="day">Diario</option>
                      <option value="month">Mensual</option>
                      <option value="year">Anual</option>
                      <option value="all">Histórico</option>
                    </select>

                    {/* Inputs dinámicos */}
                    {filterPeriod === 'day' && (
                      <input
                        type="date"
                        className="rounded-lg px-2 py-1 border border-gray-700 bg-gray-900/60 text-white focus:outline-none text-xs w-32"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                      />
                    )}
                    {filterPeriod === 'month' && (
                      <input
                        type="month"
                        className="rounded-lg px-2 py-1 border border-gray-700 bg-gray-900/60 text-white focus:outline-none text-xs w-32"
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                      />
                    )}
                    {filterPeriod === 'year' && (
                      <input
                        type="number"
                        min="2020"
                        max="2100"
                        className="rounded-lg px-2 py-1 border border-gray-700 bg-gray-900/60 text-white focus:outline-none text-xs w-20"
                        value={filterYear}
                        onChange={(e) => setFilterYear(e.target.value)}
                      />
                    )}
                  </div>
                </div>

                {/* Resumen de métricas del período */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="bg-slate-800/40 border border-gray-800/30 p-2 rounded-lg text-center">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Total</p>
                    <p className="text-base font-bold text-[var(--neon-blue)]">{totalReservationsPeriod}</p>
                  </div>
                  <div className="bg-slate-800/40 border border-gray-800/30 p-2 rounded-lg text-center">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Espera</p>
                    <p className="text-base font-bold text-amber-500">{pieStatusCounts.Espera}</p>
                  </div>
                  <div className="bg-slate-800/40 border border-gray-800/30 p-2 rounded-lg text-center">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Atendidas</p>
                    <p className="text-base font-bold text-emerald-500">{pieStatusCounts.Atendido}</p>
                  </div>
                  <div className="bg-slate-800/40 border border-gray-800/30 p-2 rounded-lg text-center">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Cancel/Perd</p>
                    <p className="text-base font-bold text-red-500">{pieStatusCounts.Cancelado + pieStatusCounts.Perdida}</p>
                  </div>
                </div>
              </div>

              <div className="h-56 flex items-center justify-center">
                {pieChartData.length === 0 ? (
                  <p className="text-gray-400 text-sm">No hay datos de reservas en este período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="45%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>

          {/* Activity Logs Panel */}
          <div className="glass-panel p-6 rounded-xl">
            <h2 className="text-xl font-bold mb-4 text-white">Logs de Actividad e Informes</h2>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2 divide-y divide-gray-800">
              {activityLogs.length === 0 ? (
                <p className="text-gray-400 text-sm">No hay registros de actividad recientes.</p>
              ) : (
                activityLogs.map((log) => (
                  <div key={log.id} className="flex gap-4 pt-4 first:pt-0">
                    <div className="mt-1 flex-shrink-0 bg-slate-800/80 p-1.5 rounded-lg border border-gray-700/50">
                      {log.icon}
                    </div>
                    <div className="flex-grow flex flex-col md:flex-row md:justify-between md:items-center gap-1">
                      <p className="text-sm text-gray-300 font-medium">{log.message}</p>
                      <span className="text-xs text-gray-500 font-mono flex-shrink-0">{log.time}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PARKING CONTROL */}
      {activeTab === 'parking' && (
        <div className="space-y-6">
          
          {/* Physical Spaces Grid */}
          <div className="glass-panel p-6 rounded-xl">
            <h2 className="text-xl font-bold mb-2 text-white">Control de Sensores Físicos</h2>
            <p className="text-xs text-gray-400 mb-4">Simula la activación física de los sensores del cajón. Haz clic en un espacio para alternar su ocupación.</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-3">
              {spaces.map(space => (
                <button
                  key={space.id_lugar}
                  onClick={() => toggleSpaceStatus(space.id_lugar, space.disponible)}
                  className={`p-3 rounded-xl font-bold text-center transition-all ${
                    !space.disponible 
                      ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20' 
                      : 'bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20'
                  }`}
                >
                  <span className="text-sm block">#{space.numero}</span>
                  <span className="text-[10px] font-normal uppercase tracking-wider block mt-1">
                    {space.disponible ? 'Libre' : 'Ocupado'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Grid layout for Barrier Control and Sensor Activity Logs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Control de Barrera IoT */}
            <div className="glass-panel p-6 rounded-xl flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-bold mb-2 text-white flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-400" />
                  Control de Barreras de Acceso (IoT)
                </h2>
                <p className="text-xs text-gray-400 mb-6">Abre de forma remota las barreras físicas de entrada o salida. Se cerrarán automáticamente tras 5 segundos.</p>
                
                {/* Two barriers side-by-side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  
                  {/* Barrier 1: Entrada */}
                  {(() => {
                    const bEntrada = barriers.find(b => b.id_barrera === 1) || { estado: 'CERRADA' };
                    const isOpen = bEntrada.estado === 'ABIERTA';
                    return (
                      <div className="bg-slate-900/40 p-4 rounded-xl border border-gray-800 flex flex-col justify-between space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-white">1. Entrada</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${isOpen ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                            {bEntrada.estado}
                          </span>
                        </div>
                        
                        {/* Simulation Arm */}
                        <div className="relative w-full h-28 bg-slate-950/60 rounded-lg border border-gray-800/80 flex items-center justify-center overflow-hidden">
                          <div className="absolute inset-x-0 bottom-0 h-3 bg-slate-900 border-t border-gray-800"></div>
                          <div className="absolute left-[20%] bottom-[12px] w-4 h-10 bg-slate-700 rounded-t border-t border-gray-600 z-10"></div>
                          <div 
                            className="absolute left-[21%] bottom-[16px] w-24 h-1.5 rounded origin-left transition-transform duration-700 ease-in-out z-0"
                            style={{ 
                              transform: isOpen ? 'rotate(-90deg)' : 'rotate(0deg)',
                              background: 'repeating-linear-gradient(45deg, #f59e0b, #f59e0b 6px, #000 6px, #000 12px)'
                            }}
                          ></div>
                        </div>

                        <button
                          onClick={() => handleOpenBarrier(1)}
                          disabled={isOpen}
                          className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            isOpen
                              ? 'bg-slate-800 text-gray-500 border border-gray-700 cursor-not-allowed'
                              : 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.15)] hover:bg-amber-400 active:scale-[0.98]'
                          }`}
                        >
                          <AlertCircle className="h-4 w-4" />
                          {isOpen 
                            ? `Entrada (${countdownEntrada || 0}s)` 
                            : 'Abrir Entrada'
                          }
                        </button>
                      </div>
                    );
                  })()}

                  {/* Barrier 2: Salida */}
                  {(() => {
                    const bSalida = barriers.find(b => b.id_barrera === 2) || { estado: 'CERRADA' };
                    const isOpen = bSalida.estado === 'ABIERTA';
                    return (
                      <div className="bg-slate-900/40 p-4 rounded-xl border border-gray-800 flex flex-col justify-between space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-white">2. Salida</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${isOpen ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                            {bSalida.estado}
                          </span>
                        </div>
                        
                        {/* Simulation Arm */}
                        <div className="relative w-full h-28 bg-slate-950/60 rounded-lg border border-gray-800/80 flex items-center justify-center overflow-hidden">
                          <div className="absolute inset-x-0 bottom-0 h-3 bg-slate-900 border-t border-gray-800"></div>
                          <div className="absolute left-[20%] bottom-[12px] w-4 h-10 bg-slate-700 rounded-t border-t border-gray-600 z-10"></div>
                          <div 
                            className="absolute left-[21%] bottom-[16px] w-24 h-1.5 rounded origin-left transition-transform duration-700 ease-in-out z-0"
                            style={{ 
                              transform: isOpen ? 'rotate(-90deg)' : 'rotate(0deg)',
                              background: 'repeating-linear-gradient(45deg, #f59e0b, #f59e0b 6px, #000 6px, #000 12px)'
                            }}
                          ></div>
                        </div>

                        <button
                          onClick={() => handleOpenBarrier(2)}
                          disabled={isOpen}
                          className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            isOpen
                              ? 'bg-slate-800 text-gray-500 border border-gray-700 cursor-not-allowed'
                              : 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.15)] hover:bg-amber-400 active:scale-[0.98]'
                          }`}
                        >
                          <AlertCircle className="h-4 w-4" />
                          {isOpen 
                            ? `Salida (${countdownSalida || 0}s)` 
                            : 'Abrir Salida'
                          }
                        </button>
                      </div>
                    );
                  })()}

                </div>
              </div>
            </div>

            {/* Historial de Actividad de Sensores */}
            <div className="glass-panel p-6 rounded-xl flex flex-col">
              <h2 className="text-xl font-bold mb-2 text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-400" />
                Historial de Actividad de Sensores (IoT)
              </h2>
              <p className="text-xs text-gray-400 mb-4">Registro en tiempo real de cambios de presencia física detectados en cada cajón.</p>
              
              <div className="flex-grow space-y-3 overflow-y-auto max-h-[220px] pr-2 divide-y divide-gray-800">
                {sensorLogs.length === 0 ? (
                  <p className="text-gray-400 text-sm py-8 text-center">No hay actividad de sensores registrada.</p>
                ) : (
                  sensorLogs.map((log) => {
                    const timeStr = new Date(log.fecha_hora).toLocaleTimeString('es-ES', {
                      timeZone: 'America/Bogota',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    });
                    const isIngreso = log.tipo === 'INGRESO';
                    return (
                      <div key={log.id_registro} className="flex items-center justify-between pt-3 first:pt-0">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg border ${
                            isIngreso 
                              ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                              : 'bg-green-500/10 border-green-500/20 text-green-400'
                          }`}>
                            <Car className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-200">
                              Lugar #{log.numero}
                            </p>
                            <p className="text-xs text-gray-400">
                              Se cambió a <span className={`font-semibold ${isIngreso ? 'text-red-400' : 'text-green-400'}`}>
                                {isIngreso ? 'ocupado' : 'disponible'}
                              </span>
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-gray-500">{timeStr}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* Reservations Table */}
          <div className="glass-panel p-6 rounded-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4">
              <h2 className="text-xl font-bold text-white">Todas las Reservas</h2>
              
              {/* Search reservations */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por correo, cajón o estado..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-700 bg-gray-900/60 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                  value={resSearch}
                  onChange={(e) => setResSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-800">
                <thead>
                  <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="px-6 py-3">ID</th>
                    <th className="px-6 py-3">Usuario</th>
                    <th className="px-6 py-3">Lugar</th>
                    <th className="px-6 py-3">Fecha/Hora</th>
                    <th className="px-6 py-3">Estado</th>
                    <th className="px-6 py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/80">
                  {filteredReservations.map(res => (
                    <tr key={res.id_reserva} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">#{res.id_reserva}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--neon-blue)] font-medium">{res.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white">Cajón #{res.numero}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {new Date(res.fecha).toLocaleDateString()} - {res.hora.slice(0, 5)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {res.estado === 'Espera' && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold">Espera</span>
                        )}
                        {res.estado === 'Atendido' && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">Atendido</span>
                        )}
                        {res.estado === 'Cancelado' && (
                          <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold">Cancelado</span>
                        )}
                        {res.estado === 'Perdida' && (
                          <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold">Perdida</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center space-x-2">
                        {res.estado === 'Espera' ? (
                          <div className="inline-flex rounded-lg border border-gray-700 bg-gray-900/50 p-0.5">
                            <button
                              onClick={() => changeReservationStatus(res.id_reserva, 'Atendido')}
                              className="px-2 py-1 text-xs font-semibold rounded text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                            >
                              Atender
                            </button>
                            <span className="text-gray-700 py-1">|</span>
                            <button
                              onClick={() => changeReservationStatus(res.id_reserva, 'Cancelado')}
                              className="px-2 py-1 text-xs font-semibold rounded text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              Cancelar
                            </button>
                            <span className="text-gray-700 py-1">|</span>
                            <button
                              onClick={() => changeReservationStatus(res.id_reserva, 'Perdida')}
                              className="px-2 py-1 text-xs font-semibold rounded text-rose-400 hover:bg-rose-500/10 transition-colors"
                            >
                              Perdida
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-xs">Completada</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredReservations.length === 0 && (
                <p className="text-gray-400 mt-6 text-center text-sm py-4">No se encontraron reservas con ese criterio.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* User Registration Form Card */}
            <div className="glass-panel p-6 rounded-xl lg:col-span-1 h-fit">
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
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Primer Nombre *</label>
                    <input
                      name="primer_nombre"
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-gray-600 bg-gray-850 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                      value={registerForm.primer_nombre}
                      onChange={handleRegisterChange}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Primer Apellido *</label>
                    <input
                      name="primer_apellido"
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-gray-650 bg-gray-850 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                      value={registerForm.primer_apellido}
                      onChange={handleRegisterChange}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Segundo Nombre</label>
                    <input
                      name="segundo_nombre"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-600 bg-gray-850 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                      value={registerForm.segundo_nombre}
                      onChange={handleRegisterChange}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Segundo Apellido *</label>
                    <input
                      name="segundo_apellido"
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-gray-600 bg-gray-850 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                      value={registerForm.segundo_apellido}
                      onChange={handleRegisterChange}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Documento Identidad *</label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      name="documento_tipo"
                      className="col-span-1 px-2 py-2 border border-gray-600 bg-gray-850 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-xs"
                      value={registerForm.documento_tipo}
                      onChange={handleRegisterChange}
                    >
                      {docTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <input
                      name="documento_numero"
                      type="text"
                      required
                      placeholder="Nro documento"
                      className="col-span-2 px-3 py-2 border border-gray-650 bg-gray-850 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                      value={registerForm.documento_numero}
                      onChange={handleRegisterChange}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Placa Vehículo *</label>
                  <input
                    name="placa_vehiculo"
                    type="text"
                    required
                    placeholder="ABC-123"
                    className="w-full px-3 py-2 border border-gray-600 bg-gray-850 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm font-mono uppercase"
                    value={registerForm.placa_vehiculo}
                    onChange={handleRegisterChange}
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Email *</label>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="correo@ejemplo.com"
                    className="w-full px-3 py-2 border border-gray-600 bg-gray-850 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
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
                    className="w-full px-3 py-2 border border-gray-600 bg-gray-855 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
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
                    className="w-full px-3 py-2 border border-gray-600 bg-gray-855 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                    value={registerForm.confirmPassword}
                    onChange={handleRegisterChange}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 mt-2 bg-[var(--neon-blue)] text-black font-bold rounded-lg hover:bg-opacity-90 transition-all shadow-[0_0_15px_rgba(0,243,255,0.4)] text-sm"
                >
                  Registrar Cliente
                </button>
              </form>
            </div>

            {/* Registered Users List Card */}
            <div className="glass-panel p-6 rounded-xl lg:col-span-2">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4">
                <h2 className="text-xl font-bold text-white">Lista de Usuarios</h2>
                
                {/* Search users */}
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, correo o documento..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-700 bg-gray-900/60 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-800">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <th className="px-6 py-3">Nombre</th>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3">Documento</th>
                      <th className="px-6 py-3">Rol</th>
                      <th className="px-6 py-3">Registro</th>
                      <th className="px-6 py-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/80">
                    {filteredUsers.map(u => (
                      <tr key={u.id_usuario} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-medium flex items-center">
                          {u.primer_nombre} {u.primer_apellido}
                          {(u.id_usuario === user.id || u.id_usuario === user.id_usuario) && (
                            <span className="text-[10px] bg-slate-800 text-gray-400 font-semibold px-1.5 py-0.5 rounded ml-2 border border-gray-700/60">(Tú)</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--neon-blue)]">{u.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 font-mono">
                          <span className="text-gray-500 mr-1.5">{u.documento_tipo}:</span>{u.numero_documento}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            u.rol === 'ADMIN' 
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {u.rol}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-medium">
                          {u.rol === 'USER' && (
                            <button
                              onClick={() => handleEditClick(u)}
                              className="px-3 py-1.5 bg-[var(--neon-blue)] text-black font-semibold rounded-lg hover:bg-opacity-90 text-xs transition-colors cursor-pointer"
                            >
                              Editar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <p className="text-gray-400 mt-6 text-center text-sm py-4">No se encontraron usuarios con ese criterio.</p>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modal flotante de edición de usuario */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-700/80 shadow-2xl p-6 relative flex flex-col space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div>
                <h3 className="text-xl font-bold text-white">Editar Usuario</h3>
                <p className="text-xs text-gray-400 mt-0.5 font-medium">Modifica los datos y gestiona los vehículos de {editingUser.email}</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-gray-400 hover:text-white transition-colors text-2xl font-bold px-2 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Error and Success banners */}
            {editError && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-sm text-center">
                {editError}
              </div>
            )}
            {editSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-500 p-3 rounded-lg text-sm text-center">
                {editSuccess}
              </div>
            )}

            {/* Content Split: Form left, Vehicles right */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Left Column: Edit Form */}
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider border-b border-gray-800 pb-1.5">Datos Personales y de Cuenta</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Primer Nombre</label>
                    <input
                      name="primer_nombre"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-650 bg-gray-850 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                      value={editForm.primer_nombre}
                      onChange={handleEditFormChange}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Primer Apellido</label>
                    <input
                      name="primer_apellido"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-650 bg-gray-850 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                      value={editForm.primer_apellido}
                      onChange={handleEditFormChange}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Segundo Nombre</label>
                    <input
                      name="segundo_nombre"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-650 bg-gray-850 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                      value={editForm.segundo_nombre}
                      onChange={handleEditFormChange}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Segundo Apellido</label>
                    <input
                      name="segundo_apellido"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-650 bg-gray-850 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                      value={editForm.segundo_apellido}
                      onChange={handleEditFormChange}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Tipo y Nro Documento</label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      name="documento_tipo"
                      className="col-span-1 px-2 py-2 border border-gray-650 bg-gray-850 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-xs"
                      value={editForm.documento_tipo}
                      onChange={handleEditFormChange}
                    >
                      {docTypes.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <input
                      name="documento_numero"
                      type="text"
                      className="col-span-2 px-3 py-2 border border-gray-650 bg-gray-850 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                      value={editForm.documento_numero}
                      onChange={handleEditFormChange}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Correo Electrónico</label>
                  <input
                    name="email"
                    type="email"
                    className="w-full px-3 py-2 border border-gray-650 bg-gray-850 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                    value={editForm.email}
                    onChange={handleEditFormChange}
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Contraseña (Dejar vacío para mantener actual)</label>
                  <input
                    name="password"
                    type="password"
                    placeholder="Nueva contraseña"
                    className="w-full px-3 py-2 border border-gray-655 bg-gray-855 text-white rounded-lg focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-sm"
                    value={editForm.password}
                    onChange={handleEditFormChange}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[var(--neon-blue)] text-black font-bold rounded-lg hover:bg-opacity-95 shadow-[0_0_15px_rgba(0,243,255,0.4)] text-sm cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </form>

              {/* Right Column: Vehicles management */}
              <div className="space-y-6 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider border-b border-gray-800 pb-1.5 mb-3">Vehículos Registrados</h4>
                  
                  {/* List of current vehicles */}
                  {editingUserVehicles.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No hay vehículos registrados para este usuario.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                      {editingUserVehicles.map(v => (
                        <div key={v.id_vehiculo} className="px-2.5 py-1.5 bg-slate-800/80 border border-gray-700/60 rounded-lg font-mono text-white text-xs">
                          {v.placa_vehiculo}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Form to add vehicle */}
                <form onSubmit={handleAdminAddVehicle} className="border-t border-gray-800 pt-4 space-y-3">
                  <h5 className="text-xs font-semibold text-gray-300 font-medium">Asociar Nuevo Vehículo</h5>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ABC-123"
                      className="flex-grow rounded-lg px-3 py-2 border border-gray-650 bg-gray-850 text-white focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] text-xs uppercase font-mono"
                      value={newVehiclePlate}
                      onChange={(e) => setNewVehiclePlate(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-750 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      + Registrar
                    </button>
                  </div>
                  {addVehicleError && <p className="text-red-400 text-[10px]">{addVehicleError}</p>}
                </form>
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
