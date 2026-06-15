import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../services/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Iniciar Sesión - ParkFlow';
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await api.post('/auth/login', { email, password });
      login(response.data, response.data.token);
      if (response.data.rol === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 glass-panel p-8 rounded-2xl">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Iniciar Sesión
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded text-sm text-center">
              {error}
            </div>
          )}
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-3 border border-gray-600 bg-gray-800/50 text-white placeholder-gray-400 focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] focus:z-10 sm:text-sm"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Contraseña</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-3 border border-gray-600 bg-gray-800/50 text-white placeholder-gray-400 focus:outline-none focus:ring-[var(--neon-blue)] focus:border-[var(--neon-blue)] focus:z-10 sm:text-sm"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-black bg-[var(--neon-blue)] hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--neon-blue)] shadow-[0_0_15px_rgba(0,243,255,0.4)] transition-all"
            >
              Entrar
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default Login;
