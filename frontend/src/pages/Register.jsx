import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../services/api';

const Register = () => {
  const [formData, setFormData] = useState({
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
  const [error, setError] = useState('');
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const [docTypes, setDocTypes] = useState([]);

  React.useEffect(() => {
    const fetchDocTypes = async () => {
      try {
        const res = await api.get('/auth/document-types');
        setDocTypes(res.data);
        if (res.data.length > 0) {
          setFormData(prev => ({ ...prev, documento_tipo: res.data[0] }));
        }
      } catch (err) {
        console.error('Error fetching document types:', err);
      }
    };
    fetchDocTypes();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    // Validación de número de documento por expresión regular
    const { documento_tipo, documento_numero } = formData;
    if (documento_tipo === 'DNI') {
      if (!/^\d{8}$/.test(documento_numero)) {
        setError('El DNI debe tener exactamente 8 dígitos numéricos.');
        return;
      }
    } else if (documento_tipo === 'Pasaporte') {
      if (!/^[a-zA-Z]{3}\d{6}$/.test(documento_numero)) {
        setError('El Pasaporte debe tener exactamente 9 caracteres (3 letras y 6 números en ese orden).');
        return;
      }
    } else if (documento_tipo === 'Carnet de Extranjeria' || documento_tipo === 'Carnet de Extranjería') {
      if (!/^\d{9}$/.test(documento_numero)) {
        setError('El Carnet de Extranjería debe tener exactamente 9 dígitos numéricos.');
        return;
      }
    }

    try {
      const response = await api.post('/auth/register', formData);
      login(response.data, response.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al registrar usuario');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 glass-panel p-8 rounded-2xl">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-white">
            Crear Cuenta
          </h2>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded text-sm text-center">
              {error}
            </div>
          )}
          <div className="rounded-md shadow-sm space-y-4">
            {/* Nombres */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Primer Nombre *</label>
                <input
                  name="primer_nombre"
                  type="text"
                  required
                  className="appearance-none rounded-lg relative block w-full px-3 py-2.5 border border-gray-600 bg-gray-800/50 text-white placeholder-gray-500 focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] sm:text-sm"
                  placeholder="Nombre"
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Segundo Nombre (opcional)</label>
                <input
                  name="segundo_nombre"
                  type="text"
                  className="appearance-none rounded-lg relative block w-full px-3 py-2.5 border border-gray-600 bg-gray-800/50 text-white placeholder-gray-500 focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] sm:text-sm"
                  placeholder="Opcional"
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Apellidos */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Primer Apellido *</label>
                <input
                  name="primer_apellido"
                  type="text"
                  required
                  className="appearance-none rounded-lg relative block w-full px-3 py-2.5 border border-gray-600 bg-gray-800/50 text-white placeholder-gray-500 focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] sm:text-sm"
                  placeholder="Apellido Paterno"
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Segundo Apellido *</label>
                <input
                  name="segundo_apellido"
                  type="text"
                  required
                  className="appearance-none rounded-lg relative block w-full px-3 py-2.5 border border-gray-600 bg-gray-800/50 text-white placeholder-gray-500 focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] sm:text-sm"
                  placeholder="Apellido Materno"
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Documento de Identidad */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Documento de Identidad *</label>
              <div className="grid grid-cols-3 gap-4">
                <select
                  name="documento_tipo"
                  className="col-span-1 appearance-none rounded-lg relative block w-full px-3 py-2.5 border border-gray-600 bg-gray-800/50 text-white focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] sm:text-sm"
                  onChange={handleChange}
                  value={formData.documento_tipo}
                >
                  {docTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <input
                  name="documento_numero"
                  type="text"
                  required
                  className="col-span-2 appearance-none rounded-lg relative block w-full px-3 py-2.5 border border-gray-600 bg-gray-800/50 text-white placeholder-gray-500 focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] sm:text-sm"
                  placeholder="Número de documento"
                  onChange={handleChange}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 pl-1">
                {formData.documento_tipo === 'DNI' && 'Formato: 8 dígitos numéricos (Ej. 12345678)'}
                {formData.documento_tipo === 'Pasaporte' && 'Formato: 9 caracteres (3 letras y 6 números, Ej. ABC123456)'}
                {(formData.documento_tipo === 'Carnet de Extranjeria' || formData.documento_tipo === 'Carnet de Extranjería') && 'Formato: 9 dígitos numéricos (Ej. 123456789)'}
              </p>
            </div>

            {/* Placa del Vehículo */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Placa del Vehículo *</label>
              <input
                name="placa_vehiculo"
                type="text"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-2.5 border border-gray-600 bg-gray-800/50 text-white placeholder-gray-500 focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] sm:text-sm font-mono uppercase"
                placeholder="Ej. ABC-123 o 123456"
                onChange={handleChange}
              />
            </div>

            {/* Correo Electrónico */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Email *</label>
              <input
                name="email"
                type="email"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-2.5 border border-gray-600 bg-gray-800/50 text-white placeholder-gray-500 focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] sm:text-sm"
                placeholder="correo@ejemplo.com"
                onChange={handleChange}
              />
            </div>

            {/* Contraseñas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Contraseña *</label>
                <input
                  name="password"
                  type="password"
                  required
                  className="appearance-none rounded-lg relative block w-full px-3 py-2.5 border border-gray-600 bg-gray-800/50 text-white placeholder-gray-500 focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] sm:text-sm"
                  placeholder="Mín. 6 caracteres"
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Verificar Contraseña *</label>
                <input
                  name="confirmPassword"
                  type="password"
                  required
                  className="appearance-none rounded-lg relative block w-full px-3 py-2.5 border border-gray-600 bg-gray-800/50 text-white placeholder-gray-500 focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] sm:text-sm"
                  placeholder="Repite la contraseña"
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-black bg-[var(--neon-blue)] hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--neon-blue)] shadow-[0_0_15px_rgba(0,243,255,0.4)] transition-all"
            >
              Registrarse
            </button>
          </div>
          
          <div className="text-center text-sm">
            <span className="text-gray-400">¿Ya tienes cuenta? </span>
            <Link to="/login" className="font-medium text-[var(--neon-blue)] hover:underline">
              Inicia sesión aquí
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
