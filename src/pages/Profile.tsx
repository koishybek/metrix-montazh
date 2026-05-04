import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { TrendingUp, Calendar, MapPin, Phone } from 'lucide-react';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    today: 0,
    week: 0,
    total: 0,
    level: 'Специалист'
  });

  useEffect(() => {
    // Calculate stats from local history
    const history = JSON.parse(localStorage.getItem('installation_history') || '[]');
    const today = new Date().toDateString();

    const countToday = history.filter((h: any) => new Date(h.timestamp).toDateString() === today).length;
    const countTotal = history.length;

    setStats({
      today: countToday,
      week: countTotal, 
      total: countTotal,
      level: 'Монтажник'
    });
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">

      {/* Profile Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center md:items-start gap-6">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-blue-200">
          {user?.username?.substring(0, 2).toUpperCase() || 'ME'}
        </div>

        <div className="flex-1 text-center md:text-left space-y-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{user?.username || 'Монтажник'}</h1>
            <p className="text-gray-500 font-medium">Отдел монтажа</p>
          </div>

          <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-2">
            <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-600 flex items-center gap-1">
              <Phone size={12} /> +7 (700) 000-00-00
            </span>
            <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-600 flex items-center gap-1">
              <MapPin size={12} /> Алматы
            </span>
          </div>
        </div>

        <div className="bg-blue-50 px-6 py-4 rounded-xl text-center min-w-[140px]">
          <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">Всего работ</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
            <Calendar size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.today}</div>
            <div className="text-xs text-gray-500 font-medium">За сегодня</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-500 font-medium">Всего выполнено</div>
          </div>
        </div>
      </div>

      {/* Recent Activity Graph Placeholder */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="font-bold text-gray-900 mb-4">Активность за месяц</h3>
        <div className="h-40 bg-gray-50 rounded-xl flex items-end justify-between p-4 px-8 gap-2">
          {[40, 60, 30, 80, 50, 90, 40].map((h, i) => (
            <div key={i} className="w-full bg-blue-500 rounded-t-lg opacity-80 hover:opacity-100 transition-opacity relative group" style={{ height: `${h}%` }}>
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                {h}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400 font-medium px-2">
          <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span>
        </div>
      </div>

    </div>
  );
};

export default Profile;
