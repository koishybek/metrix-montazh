import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { FileText, Clock, CheckCircle, ArrowRight, Trash2 } from 'lucide-react';

const History: React.FC = () => {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    // Load drafts from localStorage
    const savedDrafts = JSON.parse(localStorage.getItem('installation_drafts') || '[]');
    setDrafts(savedDrafts);

    // Load history (mock for now, or from local storage success log)
    const savedHistory = JSON.parse(localStorage.getItem('installation_history') || '[]');
    setHistory(savedHistory);
  }, []);

  const continueDraft = (draft: any) => {
    // Pass draft data via state to NewInstallation page
    navigate('/new-installation', { state: { draft } });
  };

  const deleteDraft = (index: number) => {
    const newDrafts = [...drafts];
    newDrafts.splice(index, 1);
    setDrafts(newDrafts);
    localStorage.setItem('installation_drafts', JSON.stringify(newDrafts));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">История и Черновики</h1>
        <p className="text-gray-500">Управляйте вашими установками и незавершенными заявками</p>
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

      {/* History Section */}
      <section>
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
            <Clock size={18} />
          </div>
          <h2 className="text-lg font-bold text-gray-800">Недавние установки</h2>
        </div>

        {history.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-500">История пуста</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900">{item.address}</h3>
                  <p className="text-xs text-gray-500">Счетчик: {item.meterNumber} • {format(new Date(item.timestamp), 'dd.MM.yyyy HH:mm')}</p>
                </div>
                <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  <CheckCircle size={14} />
                  <span className="text-xs font-bold">Успешно</span>
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
