import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { LogOut, CarFront } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="glass-panel sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2">
              <CarFront className="h-8 w-8 text-[var(--neon-blue)]" />
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--neon-blue)] to-[var(--neon-green)]">
                ParkFlow
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm text-gray-300">Hola, {user.primer_nombre && user.primer_apellido ? `${user.primer_nombre} ${user.primer_apellido}` : user.email}</span>
                {user.rol === 'ADMIN' && (
                  <Link to="/admin" className="text-sm font-medium hover:text-[var(--neon-blue)] transition-colors">
                    Admin Dashboard
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                >
                  <LogOut size={16} />
                  Salir
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium hover:text-[var(--neon-blue)] transition-colors">
                  Iniciar Sesión
                </Link>
                <Link to="/register" className="px-4 py-2 rounded-md text-sm font-medium bg-[var(--neon-blue)] text-black hover:bg-opacity-90 transition-colors shadow-[0_0_15px_rgba(0,243,255,0.5)]">
                  Registrarse
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
