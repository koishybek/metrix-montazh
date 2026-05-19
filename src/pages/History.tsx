import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { FileText, Clock, CheckCircle, ArrowRight, Trash2, Search, Copy, Loader2 } from 'lucide-react';

const History: React.FC = () => {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<any[]>([]);
  const [outbox, setOutbox] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Load drafts from localStorage
    const savedDrafts = JSON.parse(localStorage.getItem('installation_drafts') || '[]');
    setDrafts(savedDrafts);

    // Load outbox
    const savedOutbox = JSON.parse(localStorage.getItem('installation_outbox') || '[]');
    setOutbox(savedOutbox);

    // Load history
    const savedHistory = JSON.parse(localStorage.getItem('installation_history') || '[]');
    setHistory(savedHistory);
  }, []);

  const continueDraft = (draft: any) => {
    navigate('/new-installation', { state: { draft } });
  };

  const useAsTemplate = (item: any) => {
    // Create a new draft based on history item
    const template = {
      ...item,
      timestamp: new Date().toISOString(),
      isTemplate: true
    };
    navigate('/new-installation', { state: { draft: template } });
  };

  const deleteDraft = (index: number) => {
    if (window.confirm('Вы уверены, что хотите удалить этот черновик? Это действие нельзя отменить.')) {
      const newDrafts = [...drafts];
      newDrafts.splice(index, 1);
      setDrafts(newDrafts);
      localStorage.setItem('installation_drafts', JSON.stringify(newDrafts));
    }
  };

  const filteredHistory = history.filter(item => 
    item.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.meterNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.modemSerial?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">История и Черновики</h1>
          <p className="text-gray-500">Управляйте вашими установками</p>
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Поиск по адресу, номеру..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64 shadow-sm"
          />
        </div>
      </div>

      {/* Drafts Section */}
      <section>
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center text-yellow-600">
            <FileText size={18} />
          </div>
          <h2 className="text-lg font-bold text-gray-800">Черновики (Оффлайн)</h2>
          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-bold">{drafts.length}</span>
        </div>

        {drafts.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300">
              <FileText size={32} />
            </div>
            <p className="text-gray-500">Нет сохраненных черновиков</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {drafts.map((draft, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative group">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{draft.address || 'Без адреса'}</h3>
                    <p className="text-xs text-gray-500">{format(new Date(draft.timestamp), 'dd.MM.yyyy HH:mm')}</p>
                  </div>
                  <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-lg font-bold">Draft</span>
                </div>

                <div className="space-y-1 text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Модем:</span>
                    <span className="font-mono bg-gray-100 px-1 rounded">{draft.modemSerial || '---'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Потребитель:</span>
                    <span>{draft.consumerName || '---'}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => continueDraft(draft)}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2"
                  >
                    Продолжить <ArrowRight size={16} />
                  </button>
                  <button
                    onClick={() => deleteDraft(i)}
                    className="px-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Outbox Section */}
      {outbox.length > 0 && (
        <section>
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
              <Clock size={18} className="animate-pulse" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Ожидают синхронизации</h2>
            <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-xs font-bold">{outbox.length}</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {outbox.map((item, i) => (
              <div key={i} className="bg-white border-2 border-blue-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] px-2 py-1 font-bold uppercase tracking-wider">
                  В очереди
                </div>
                <div className="mb-3">
                  <h3 className="font-bold text-gray-900">{item.address || 'Без адреса'}</h3>
                  <p className="text-xs text-gray-500">Дом: {item.house}, № {item.serial_number}</p>
                </div>
                <div className="flex items-center text-blue-600 text-xs font-medium">
                  <Loader2 size={14} className="animate-spin mr-1" />
                  Отправится автоматически при появлении сети
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* History Section */}
      <section>
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
            <Clock size={18} />
          </div>
          <h2 className="text-lg font-bold text-gray-800">Недавние установки</h2>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-500">История пуста или ничего не найдено</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((item, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">{item.address}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    <p className="text-xs text-gray-500">Счетчик: <span className="text-gray-700 font-medium">{item.meterNumber}</span></p>
                    <p className="text-xs text-gray-500">Модем: <span className="text-gray-700 font-medium">{item.modemSerial}</span></p>
                    <p className="text-xs text-gray-400">{format(new Date(item.timestamp), 'dd.MM.yyyy HH:mm')}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => useAsTemplate(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition"
                    title="Использовать как шаблон"
                  >
                    <Copy size={14} /> Шаблон
                  </button>
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                    <CheckCircle size={14} />
                    <span className="text-xs font-bold">Успешно</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
};

export default History;
