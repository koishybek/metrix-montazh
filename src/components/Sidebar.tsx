import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PlusCircle, History, User, LogOut } from 'lucide-react';

const Sidebar: React.FC = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { path: '/new-installation', label: 'Установка', icon: <PlusCircle size={20} /> },
    { path: '/history', label: 'История', icon: <History size={20} /> },
    { path: '/profile', label: 'Профиль', icon: <User size={20} /> },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex justify-around items-center h-16 px-2 shadow-lg">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-colors
              ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'}
            `}
          >
            {item.icon}
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
          </NavLink>
        ))}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center flex-1 h-full space-y-1 text-red-500"
        >
          <LogOut size={20} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Выйти</span>
        </button>
      </nav>

      {/* Desktop Sidebar (unchanged logic, added hidden md:block) */}
      <aside className="hidden md:flex fixed top-0 left-0 h-screen w-64 bg-white border-r border-gray-200 z-40 flex-col transform transition-transform duration-300 ease-in-out translate-x-0">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-100 flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-200">
              M
            </div>
            <div>
              <h2 className="font-bold text-gray-900 leading-tight">Metrix</h2>
              <span className="text-xs text-gray-500 font-medium">Installer Pro</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-3 mt-2">Меню</div>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `
                  flex items-center space-x-3 px-3 py-3 rounded-xl transition-all duration-200 font-medium
                  ${isActive
                    ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                `}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* User Profile Summary */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <div className="flex items-center space-x-3 mb-4 p-2 bg-white rounded-lg border border-gray-100 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold">
                {user?.username?.substring(0, 2).toUpperCase() || 'ME'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{user?.username || 'Монтажник'}</p>
                <p className="text-xs text-green-600 font-medium">В сети</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 p-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
            >
              <LogOut size={16} />
              <span>Выйти из системы</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
