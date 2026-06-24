import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getServiceNodes } from '../api';
import { format } from 'date-fns';
import { MapPin, CheckCircle, Clock, XCircle, CalendarCheck, ListChecks } from 'lucide-react';

interface Stat {
  total: number;
  today: number;
  week: number;
  accepted: number;
  inProgress: number;
  rejected: number;
}

const Profile: React.FC = () => {
  const { user } = useAuth();
  const username = user?.username || 'anon';
  const isAdmin = user?.role === 'admin';

  const [regions, setRegions] = useState<string[]>([]);
  const [stats, setStats] = useState<Stat>({ total: 0, today: 0, week: 0, accepted: 0, inProgress: 0, rejected: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    // Stats from this account's own history (per-user key).
    const history: any[] = JSON.parse(localStorage.getItem(`installation_history_${username}`) || '[]');
    const todayStr = new Date().toDateString();
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const us = (h: any) => (h.upload_status || '') as string;
    setStats({
      total: history.length,
      today: history.filter(h => new Date(h.timestamp).toDateString() === todayStr).length,
      week: history.filter(h => new Date(h.timestamp).getTime() >= weekAgo).length,
      accepted: history.filter(h => us(h).startsWith('Принято')).length,
      rejected: history.filter(h => us(h).startsWith('Не принято')).length,
      inProgress: history.filter(h => !us(h)).length,
    });
    setRecent(history.slice(0, 5));

    // Real regions the account has access to (scoped server-side for installers).
    getServiceNodes()
      .then(ns => setRegions([...new Set(ns.map(n => n.city).filter(Boolean))]))
      .catch(() => { /* offline: leave empty */ });
  }, [username]);

  const initials = username.replace(/[^a-zA-Zа-яА-Я0-9]/g, '').substring(0, 2).toUpperCase() || 'МН';

  const statusBadge = (item: any) => {
    const s: string = item.upload_status || '';
    if (s.startsWith('Принято')) return <span className="text-[11px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle size={12} />Принято</span>;
    if (s.startsWith('Не принято')) return <span className="text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1"><XCircle size={12} />Отклонено</span>;
    return <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1"><Clock size={12} />В разработке</span>;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center md:items-start gap-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-200 shrink-0">
          {initials}
        </div>
        <div className="flex-1 text-center md:text-left space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">{username}</h1>
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
            {isAdmin ? 'Администратор' : 'Монтажник'}
          </span>
          <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-1">
            {regions.length > 0 ? regions.map(r => (
              <span key={r} className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-700 flex items-center gap-1">
                <MapPin size={12} /> {r}
              </span>
            )) : (
              <span className="text-xs text-gray-400">Регионы загружаются…</span>
            )}
          </div>
        </div>
        <div className="bg-blue-50 px-6 py-4 rounded-xl text-center min-w-[130px]">
          <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">Всего актов</div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1"><CalendarCheck size={16} /> Сегодня</div>
          <div className="text-3xl font-bold text-gray-900">{stats.today}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1"><ListChecks size={16} /> За неделю</div>
          <div className="text-3xl font-bold text-gray-900">{stats.week}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-green-100 shadow-sm">
          <div className="flex items-center gap-2 text-green-600 text-xs font-medium mb-1"><CheckCircle size={16} /> Принято в АСИЦРА</div>
          <div className="text-3xl font-bold text-green-700">{stats.accepted}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-amber-100 shadow-sm">
          <div className="flex items-center gap-2 text-amber-600 text-xs font-medium mb-1"><Clock size={16} /> В разработке</div>
          <div className="text-3xl font-bold text-amber-700">{stats.inProgress}</div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="font-bold text-gray-900 mb-4">Последние акты</h3>
        {recent.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">Пока нет установок</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {recent.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{item.address || 'Без адреса'}{item.houseNumber ? `, ${item.houseNumber}` : ''}</p>
                  <p className="text-xs text-gray-400">
                    № {item.meterNumber || '—'} · {item.timestamp ? format(new Date(item.timestamp), 'dd.MM.yyyy HH:mm') : ''}
                  </p>
                </div>
                {statusBadge(item)}
              </div>
            ))}
          </div>
        )}
        {stats.rejected > 0 && (
          <p className="text-xs text-red-600 mt-4 flex items-center gap-1">
            <XCircle size={12} /> Отклонено системой: {stats.rejected} — проверьте данные и пересоздайте.
          </p>
        )}
      </div>

    </div>
  );
};

export default Profile;
