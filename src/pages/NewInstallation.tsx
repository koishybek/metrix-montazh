import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Camera, MapPin, QrCode, Check, ChevronDown, Loader2 } from 'lucide-react';
import api, { endpoints, getPortModes, getMeterModels, getInstallationPlaces, getObjectTypes } from '../api';
import streetsData from '../assets/streets.json';
import { AUTO_NODE_BY_RESOURCE } from '../constants/resourceNodes';
import type { Street, PortMode, MeterModel } from '../types';

interface DictionaryItem {
  id: number;
  name: string;
}

const NewInstallation: React.FC = () => {
  const location = useLocation();

  // -- State --
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [, setError] = useState<string | null>(null);

  // 1. Resource Type & Hidden Fields
  const [resourceType, setResourceType] = useState<'cold' | 'hot' | null>(null);
  const [node, setNode] = useState<number>(20);
  const [clientSector, setClientSector] = useState<'private' | 'legal' | 'multi_apartment' | 'physical'>('private');
  const [description, setDescription] = useState('');
  const [joinDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // 2. Modem Serial / Device
  const [modemSerial, setModemSerial] = useState('');
  const [deviceId, setDeviceId] = useState<number | null>(null); // Store selected device ID
  const [deviceAddress, setDeviceAddress] = useState<number | null>(null); // Store device address FK (required by backend)
  const [deviceType, setDeviceType] = useState<number | null>(null); // Store device model ID (18, 20, 31, etc.)
  const [deviceTypeName, setDeviceTypeName] = useState<string>(''); // For display
  const [deviceDistrict, setDeviceDistrict] = useState<number>(2); // Default to C (2) for Almaty Su
  const [isScanning, setIsScanning] = useState(false);
  const [suggestedDevices, setSuggestedDevices] = useState<any[]>([]);
  const [showDeviceSuggestions, setShowDeviceSuggestions] = useState(false);

  // Port Logic State
  const [port, setPort] = useState<number>(2); // Default to 2
  const [isPortLocked, setIsPortLocked] = useState(false); // If true, user can't change port (e.g. Kazmeter)
  const [portModes, setPortModes] = useState<PortMode[]>([]);
  const [portModeId, setPortModeId] = useState<number | null>(null);
  const [loadingModes, setLoadingModes] = useState(false);

  // 3. Meter Selection
  const [meterModels, setMeterModels] = useState<MeterModel[]>([]);
  const [selectedMeterModelId, setSelectedMeterModelId] = useState<string>('');

  // 4. Meter Number
  const [meterNumber, setMeterNumber] = useState('');

  // 5. Address
  const [address, setAddress] = useState('');
  const [suggestedStreets, setSuggestedStreets] = useState<Street[]>([]);
  const [selectedStreet, setSelectedStreet] = useState<Street | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [manualStreetCode, setManualStreetCode] = useState<string>('');
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [newAddressData, setNewAddressData] = useState({
    province: 'г. Алматы',
    locality: 'г. Алматы',
    area: 'городской акимат Алматы',
    district: '',
    street: '',
    house: '',
    lng: null as number | null,
    lat: null as number | null,
  });

  // 6. Installation Place
  const [installationPlaces, setInstallationPlaces] = useState<DictionaryItem[]>([]);
  const [installationPlace, setInstallationPlace] = useState<number>(1);

  // 6.1 Object Type
  const [objectTypes, setObjectTypes] = useState<DictionaryItem[]>([]);
  const [objectType, setObjectType] = useState<number>(1);

  // 7. Apartment
  const [apartment, setApartment] = useState('');

  // 8-10. Consumer Info
  const [consumerName, setConsumerName] = useState('');
  const [consumerPhone, setConsumerPhone] = useState('+7(7');
  const [accountId, setAccountId] = useState('');

  // Phone mask handler: +7(7XX) XXX-XX-XX
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, ''); // digits only
    let digits = raw;
    // Ensure starts with 77
    if (!digits.startsWith('7')) digits = '7' + digits;
    if (digits.length >= 1 && digits[1] !== '7') digits = '7' + '7' + digits.slice(1);
    if (digits.length < 2) digits = '77';

    // Limit to 11 digits (7 + 10)
    digits = digits.slice(0, 11);

    // Format: +7(7XX) XXX-XX-XX
    let formatted = '+7(7';
    if (digits.length > 2) formatted += digits.slice(2, 4);
    if (digits.length > 4) formatted += ') ' + digits.slice(4, 7);
    if (digits.length > 7) formatted += '-' + digits.slice(7, 9);
    if (digits.length > 9) formatted += '-' + digits.slice(9, 11);

    setConsumerPhone(formatted);
  };

  // 11. Readings
  const [joinReading, setJoinReading] = useState('');

  // 12. Photos
  const [photos, setPhotos] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // -- Effects --

  // Load Draft if passed via navigation
  useEffect(() => {
    if (location.state && location.state.draft) {
      const draft = location.state.draft;
      setResourceType(draft.resourceType || null);
      setModemSerial(draft.modemSerial || '');
      setMeterNumber(draft.meterNumber || '');
      setAddress(draft.address || '');
      setConsumerName(draft.consumerName || '');
      setConsumerPhone(draft.consumerPhone || '');
      setAccountId(draft.accountId || '');
      setJoinReading(draft.joinReading || '');
      setApartment(draft.apartment || '');
      // Restore other fields as needed
    }
  }, [location]);

  // Sync Resource switch dependent fields
  useEffect(() => {
    if (resourceType === 'cold') {
      setNode(AUTO_NODE_BY_RESOURCE[1]);
    } else if (resourceType === 'hot') {
      setNode(AUTO_NODE_BY_RESOURCE[2]);
    }
  }, [resourceType]);

  // Load Port Modes and Meter Models with Caching
  useEffect(() => {
    const loadCachedOrFetch = async (
      key: string,
      tsKey: string,
      setter: (data: any) => void,
      fetcher: () => Promise<any>
    ) => {
      const cached = localStorage.getItem(key);
      const ts = localStorage.getItem(tsKey);
      if (cached && ts && Date.now() - Number(ts) < 24 * 3600 * 1000) {
        setter(JSON.parse(cached));
      } else {
        try {
          const data = await fetcher();
          setter(data);
          localStorage.setItem(key, JSON.stringify(data));
          localStorage.setItem(tsKey, String(Date.now()));
        } catch (err) {
          console.error(`Failed to load ${key}`, err);
        }
      }
    };

    loadCachedOrFetch('meter_models_cache', 'meter_models_ts', setMeterModels, getMeterModels);
    loadCachedOrFetch('installation_places_cache', 'installation_places_ts', setInstallationPlaces, getInstallationPlaces);
    loadCachedOrFetch('object_types_cache', 'object_types_ts', setObjectTypes, getObjectTypes);
  }, []);

  // -- Handlers --

  const saveDraft = () => {
    const draft = {
      timestamp: new Date().toISOString(),
      resourceType,
      modemSerial,
      meterNumber,
      address,
      consumerName,
      consumerPhone,
      accountId,
      joinReading,
      apartment,
      // Add other fields
    };

    const existingDrafts = JSON.parse(localStorage.getItem('installation_drafts') || '[]');
    existingDrafts.unshift(draft); // Add to top
    localStorage.setItem('installation_drafts', JSON.stringify(existingDrafts));
    alert('Черновик сохранен в "Истории"');
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAddress(value);

    if (value.length > 2) {
      const timeoutId = setTimeout(() => {
        const apiKey = 'e0dcd455-3aae-4fe4-abc2-2a258e341c0b';
        fetch(`https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${value}&format=json`)
          .then(res => res.json())
          .then(data => {
            const featureMember = data.response.GeoObjectCollection.featureMember;
            const suggestions: Street[] = featureMember.map((item: any) => ({
              Название: item.GeoObject.metaDataProperty.GeocoderMetaData.text,
              Код: "0"
            }));

            // Match with local streets.json
            const enhancedSuggestions = suggestions.map((s) => {
              const localMatch = (streetsData as Street[]).find(local =>
                local.Название.toLowerCase().includes(s.Название.toLowerCase()) ||
                s.Название.toLowerCase().includes(local.Название.toLowerCase())
              );
              return localMatch ? { ...s, Код: localMatch.Код } : s;
            });

            setSuggestedStreets(enhancedSuggestions);
            setShowSuggestions(true);
          })
          .catch(err => console.error('Yandex Geocode Error', err));
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setSuggestedStreets([]);
      setShowSuggestions(false);
    }
  };

  const selectStreet = (street: Street) => {
    setAddress(street.Название);
    setSelectedStreet(street);
    setManualStreetCode(street.Код && street.Код !== "0" ? street.Код : '');
    setShowSuggestions(false);
  };

  const handleCreateAddress = async () => {
    setLoading(true);
    try {
      const { lng, lat } = newAddressData;
      const payload = {
        ...newAddressData,
        lng: lng || 0,
        lat: lat || 0,
        coordinates: `SRID=4326;POINT (${lng || 0} ${lat || 0})`
      };
      const res = await api.post('/api/v1/address/', payload);
      const createdAddress = res.data;
      
      // Auto-select created address for the device
      setDeviceAddress(createdAddress.id);
      setAddress(`${payload.street}, ${payload.house}`);
      setIsAddressModalOpen(false);
      alert('Адрес успешно создан и привязан!');
    } catch (err: any) {
      console.error('Failed to create address', err);
      let errorMsg = 'Ошибка при создании адреса';
      if (err.response?.data) {
        errorMsg += ': ' + JSON.stringify(err.response.data);
      } else {
        errorMsg += ': ' + err.message;
      }
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGeolocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLoading(false);
          const { latitude, longitude } = position.coords;
          setAddress(`Lat: ${latitude}, Long: ${longitude}`);
          setNewAddressData(prev => ({
            ...prev,
            lat: latitude,
            lng: longitude
          }));
        },
        (err) => {
          setLoading(false);
          console.error(err);
          alert('Не удалось получить геолокацию');
        }
      );
    } else {
      alert('Геолокация не поддерживается');
    }
  };

  const handleModemSerialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setModemSerial(value);
    setDeviceId(null);
    setDeviceAddress(null); // Reset device address when EUI changes
    setDeviceType(null);
    setDeviceTypeName('');
    setIsPortLocked(false);

    if (value.length > 3) {
      const timeoutId = setTimeout(async () => {
        try {
          const res = await api.get(`/api/v1/device/?ordering=-sent_date&page=1&page_size=10&search=${value}`);
          if (res.data && Array.isArray(res.data.results)) {
            setSuggestedDevices(res.data.results);
            setShowDeviceSuggestions(true);
          }
        } catch (err) {
          console.error('Device search failed', err);
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setSuggestedDevices([]);
      setShowDeviceSuggestions(false);
    }
  };

  const selectDevice = async (device: any) => {
    setModemSerial(device.eui || device.serial_number);
    setDeviceId(device.id);
    setDeviceAddress(device.address ?? null); // Backend requires device__address
    
    if (device.additional_data?.district) {
      setDeviceDistrict(Number(device.additional_data.district));
    }

    // Store device type info
    const dType = device.type || device.device_model; // Check API response structure
    setDeviceType(dType);
    setDeviceTypeName(device.type_name || `Type ${dType}`);
    setPortModeId(null); // Reset port mode on device change

    // Fetch port modes for this device model
    setLoadingModes(true);
    try {
      const modes = await getPortModes(dType);
      setPortModes(modes);
      
      // Auto-select if only one mode
      if (modes.length === 1) {
        setPortModeId(modes[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch port modes', err);
    } finally {
      setLoadingModes(false);
    }

    // -- AUTOMATED PORT LOGIC --
    if (dType === 20) {
      // Kazmeter Built-in
      setPort(1);
      setIsPortLocked(true);
    } else {
      // GSM (31), LoRaWAN (18), etc.
      setPort(2);
      setIsPortLocked(false); // Allow edit if needed, but default to 2
    }

    setShowDeviceSuggestions(false);
  };

  const startScanner = () => {
    setIsScanning(true);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      scanner.render((decodedText) => {
        setModemSerial(decodedText);
        scanner.clear();
        setIsScanning(false);
        // Trigger search immediately after scan if needed
        handleModemSerialChange({ target: { value: decodedText } } as any);
      }, () => {
        // ignore errors
      });
    }, 100);
  };

  const openCamera = () => {
    setIsCameraOpen(true);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => console.error('Error accessing camera', err));
  };

  const takePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setPhotos(prev => [...prev, dataUrl].slice(0, 3));

      const stream = videoRef.current.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      setIsCameraOpen(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!resourceType) { alert('Выберите тип ресурса'); return; }
    if (!modemSerial) { alert('Введите серийный номер модема'); return; }
    if (!deviceId) { alert('Сначала выберите устройство из списка поиска'); return; } // Enforce selection
    if (portModeId === null) { alert('Выберите режим работы устройства'); return; }
    if (!selectedMeterModelId) { alert('Выберите тип счётчика'); return; }
    if (!meterNumber) { alert('Введите номер счётчика'); return; }
    if (!address) { alert('Введите адрес'); return; }
    if (!consumerName) { alert('Введите ФИО потребителя'); return; }
    if (!consumerPhone) { alert('Введите телефон'); return; }
    if (!accountId) { alert('Введите лицевой счёт'); return; }
    if (!joinReading) { alert('Введите показания'); return; }

    if (resourceType === 'cold' && (!selectedStreet?.Код || selectedStreet.Код === "0")) {
      const confirmed = window.confirm(
        'Улица не выбрана из справочника. Акт будет создан без кода улицы Алматы Су. Продолжить?'
      );
      if (!confirmed) return;
    }

    setSubmitting(true);

    try {
      const selectedMode = portModes.find(m => m.id === portModeId);
      const needsPort = selectedMode?.additional_data?.fields?.some(f => f.name === 'port') ?? false;

      const payload: any = {
        serial_number: meterNumber || "",
        description: description || "",
        ...(needsPort ? { port: Number(port) } : {}),
        join_date: joinDate,
        join_reading: Number(joinReading),
        is_active: true,
        client_sector: clientSector,
        additional_data: (() => {
          if (resourceType === 'cold') {
            const streetId = manualStreetCode || selectedStreet?.Код;
            return {
              ...(streetId && streetId !== "0" ? { almaty_su_street_id: streetId } : {}),
              district: deviceDistrict || 2
            };
          }
          return {};
        })(),
        consumer: consumerName || "",
        apartment: apartment || "",
        phone: consumerPhone || "",
        account_id: accountId || "",
        device_mode: portModeId,
        type: Number(selectedMeterModelId) || null,
        object_type: Number(objectType) || null,
        installation_place: Number(installationPlace) || null,
        device: deviceId,
        device__address: deviceAddress, // Required by backend views.py line 574
        resource_type: resourceType === 'cold' ? 1 : 2,
        node: node,
      };

      console.log('Sending payload:', JSON.stringify(payload, null, 2));

      // Create Meter
      await api.post(endpoints.meter, payload);
      alert('Установка успешно создана!');

      // Save to History
      const historyItem = {
        timestamp: new Date().toISOString(),
        address,
        meterNumber,
        modemSerial,
        status: 'success'
      };
      const existingHistory = JSON.parse(localStorage.getItem('installation_history') || '[]');
      existingHistory.unshift(historyItem);
      localStorage.setItem('installation_history', JSON.stringify(existingHistory));

      window.location.reload();

    } catch (err: any) {
      console.error('Submission error:', err);
      let msg = 'Ошибка при создании установки';

      // Save Draft Automatically on Failure
      saveDraft();
      msg += '. \n\nВАЖНО: Ваши данные сохранены в "Черновики", вы можете попробовать позже.';

      if (err.response?.data) {
        msg += `\nДетали: ${JSON.stringify(err.response.data, null, 2)}`;
      } else if (err.message) {
        msg += `\n: ${err.message}`;
      }
      setError(msg);
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans text-gray-900">
      {/* Header removed as it is now in Layout/Sidebar, OR keep simplified title */}
      <div className="px-4 py-4 md:hidden">
        {/* Mobile padding spacer */}
      </div>

      <main className="p-4 pb-40 space-y-6 max-w-lg mx-auto">

        {/* Resource Type */}
        <section className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Тип ресурса <span className="text-red-500">*</span></label>
          <div className="flex bg-gray-200 p-1 rounded-xl">
            <button
              onClick={() => setResourceType('cold')}
              className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${resourceType === 'cold' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-300'}`}
            >
              Холодная вода (ХВС)
            </button>
            <button
              onClick={() => setResourceType('hot')}
              className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${resourceType === 'hot' ? 'bg-red-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-300'}`}
            >
              Горячая вода (ГВС)
            </button>
          </div>
        </section>

        {/* Modem Serial & Auto-Config */}
        <section className="space-y-2 relative">
          <label className="text-sm font-semibold text-gray-700">Серийный номер модема <span className="text-red-500">*</span></label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={modemSerial}
              onChange={handleModemSerialChange}
              placeholder="Поиск по серийному номеру..."
              className="flex-1 bg-white border border-gray-300 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button onClick={startScanner} className="bg-gray-900 text-white p-4 rounded-xl active:scale-95 transition-transform">
              <QrCode />
            </button>
          </div>

          {/* Detected Device Info */}
          {deviceId && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800 mt-2">
              <div className="font-bold flex items-center gap-2">
                <Check size={16} />
                Устройство найдено
              </div>
              <div>Тип: {deviceTypeName} (ID: {deviceType})</div>
              <div>Авто-настройка: Порт {port}</div>
            </div>
          )}

          {showDeviceSuggestions && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto">
              {suggestedDevices.map((d) => (
                <div key={d.id} onClick={() => selectDevice(d)} className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0 flex justify-between items-center">
                  <div>
                    <span className="font-medium">{d.eui || d.serial_number}</span>
                    <span className="text-xs text-gray-500 ml-2">({d.type_name || d.type || 'Unknown Type'})</span>
                  </div>
                  <span className="text-xs text-gray-400">ID: {d.id}</span>
                </div>
              ))}
            </div>
          )}
          {isScanning && (
            <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
              <div id="reader" className="w-full max-w-sm bg-white rounded-xl overflow-hidden"></div>
              <button onClick={() => { setIsScanning(false); window.location.reload(); }} className="mt-6 px-6 py-3 bg-white text-red-600 rounded-full font-bold">Закрыть</button>
            </div>
          )}
        </section>

        {/* Port Mode Selection */}
        {deviceId && (
          <section className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Режим работы <span className="text-red-500">*</span></label>
            <div className="relative">
              {loadingModes ? (
                <div className="flex items-center justify-center p-4 bg-gray-50 rounded-xl">
                  <Loader2 className="animate-spin text-blue-600 mr-2" size={20} />
                  <span className="text-sm text-gray-500">Загрузка режимов...</span>
                </div>
              ) : (() => {
                const availableModes = portModes; // API already filtered by device_model
                if (availableModes.length === 0) {
                  return <div className="p-4 bg-yellow-50 text-yellow-700 rounded-xl text-sm">Для этого устройства нет доступных режимов</div>;
                }
                if (availableModes.length === 1) {
                  return (
                    <div className="p-4 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium border border-blue-100 flex items-center justify-between">
                      {availableModes[0].name}
                      <Check size={16} />
                    </div>
                  );
                }
                return (
                  <>
                    <select
                      value={portModeId || ''}
                      onChange={(e) => setPortModeId(Number(e.target.value))}
                      className="w-full appearance-none bg-white border border-gray-300 text-gray-900 rounded-xl p-4 pr-10 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Выберите режим...</option>
                      {availableModes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-4 text-gray-400 pointer-events-none" size={20} />
                  </>
                );
              })()}
            </div>
          </section>
        )}

        {/* Port Input (Conditional/Read-only) */}
        {(() => {
          const selectedMode = portModes.find(m => m.id === portModeId);
          const needsPort = selectedMode?.additional_data?.fields?.some(f => f.name === 'port');
          if (!needsPort) return null;
          return (
            <section className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Порт подключения <span className="text-red-500">*</span></label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                disabled={isPortLocked}
                className={`w-full border border-gray-300 rounded-xl p-4 outline-none ${isPortLocked ? 'bg-gray-100 text-gray-500' : 'bg-white focus:ring-2 focus:ring-blue-500'}`}
              />
              <p className="text-xs text-gray-500">
                {isPortLocked ? 'Порт определен автоматически типом устройства' : 'Для внешних модемов обычно порт 2'}
              </p>
            </section>
          );
        })()}

        {/* Meter Model Selection (API data) */}
        <section className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Тип счётчика <span className="text-red-500">*</span></label>
          <div className="relative">
            <select
              value={selectedMeterModelId}
              onChange={(e) => setSelectedMeterModelId(e.target.value)}
              className="w-full appearance-none bg-white border border-gray-300 text-gray-900 rounded-xl p-4 pr-10 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Выберите модель...</option>
              {meterModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-4 text-gray-400 pointer-events-none" size={20} />
          </div>
        </section>

        {/* Meter Number */}
        <section className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Номер счётчика <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={meterNumber}
            onChange={(e) => setMeterNumber(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="№ счётчика"
          />
        </section>

        {/* Address */}
        <section className="space-y-2 relative">
          <label className="text-sm font-semibold text-gray-700">Адрес установки <span className="text-red-500">*</span></label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={address}
                onChange={handleAddressChange}
                className="w-full bg-white border border-gray-300 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Поиск улицы..."
              />
              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto">
                  {suggestedStreets.map((s, i) => (
                    <div key={i} onClick={() => selectStreet(s)} className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0">{s. Название}</div>
                  ))}
                </div>
              )}
            </div>
            <button 
              onClick={() => setIsAddressModalOpen(true)}
              className="bg-blue-600 text-white p-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center"
              title="Создать новый адрес"
            >
              <span className="text-2xl leading-none">+</span>
            </button>
          </div>

          {resourceType === 'cold' && (
            <div className="space-y-2">
              {!selectedStreet?.Код || selectedStreet.Код === "0" ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-amber-700 text-xs font-medium mb-2">
                    ⚠️ Улица не найдена в базе Алматы Су. Введите код вручную:
                  </p>
                  <input
                    type="text"
                    value={manualStreetCode}
                    onChange={(e) => setManualStreetCode(e.target.value)}
                    className="w-full bg-white border border-amber-300 rounded-lg p-2 text-sm focus:ring-1 focus:ring-amber-500 outline-none"
                    placeholder="Код улицы (например: 144)"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-green-600 font-medium px-1">
                  <Check size={14} />
                  <span>Код улицы: {manualStreetCode || selectedStreet.Код}</span>
                </div>
              )}
            </div>
          )}

          <button onClick={handleGeolocation} disabled={loading} className="w-full flex items-center justify-center space-x-2 py-3 bg-blue-50 text-blue-700 font-medium rounded-xl border border-blue-100 hover:bg-blue-100 active:scale-95 transition-all">
            {loading ? <Loader2 className="animate-spin" /> : <MapPin size={18} />}
            <span>Определить по геолокации</span>
          </button>
        </section>

        {/* Address Creation Modal */}
        {isAddressModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-gray-900">Новый адрес</h3>
                  <button onClick={() => setIsAddressModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 uppercase">Улица <span className="text-red-500">*</span></label>
                    <input
                      value={newAddressData.street}
                      onChange={(e) => setNewAddressData({...newAddressData, street: e.target.value})}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Название улицы"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Дом <span className="text-red-500">*</span></label>
                    <input
                      value={newAddressData.house}
                      onChange={(e) => setNewAddressData({...newAddressData, house: e.target.value})}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Номер"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Район</label>
                    <input
                      value={newAddressData.district}
                      onChange={(e) => setNewAddressData({...newAddressData, district: e.target.value})}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Район"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Населенный пункт</label>
                    <input
                      value={newAddressData.locality}
                      onChange={(e) => setNewAddressData({...newAddressData, locality: e.target.value})}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Область</label>
                    <input
                      value={newAddressData.province}
                      onChange={(e) => setNewAddressData({...newAddressData, province: e.target.value})}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={handleCreateAddress}
                  disabled={loading || !newAddressData.street || !newAddressData.house}
                  className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all disabled:bg-gray-300 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <Check size={20} />}
                  Создать и привязать
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Installation Place & Object Type */}
        <div className="grid grid-cols-2 gap-4">
          <section className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Место установки <span className="text-red-500">*</span></label>
            <div className="relative">
              <select
                value={installationPlace}
                onChange={(e) => setInstallationPlace(Number(e.target.value))}
                className="w-full appearance-none bg-white border border-gray-300 text-gray-900 rounded-xl p-4 pr-10 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Выберите место...</option>
                {installationPlaces.map(ip => <option key={ip.id} value={ip.id}>{ip.name}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-4 text-gray-400 pointer-events-none" size={20} />
            </div>
          </section>

          <section className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Тип объекта <span className="text-red-500">*</span></label>
            <div className="relative">
              <select
                value={objectType}
                onChange={(e) => setObjectType(Number(e.target.value))}
                className="w-full appearance-none bg-white border border-gray-300 text-gray-900 rounded-xl p-4 pr-10 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Выберите тип...</option>
                {objectTypes.map(ot => <option key={ot.id} value={ot.id}>{ot.name}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-4 text-gray-400 pointer-events-none" size={20} />
            </div>
          </section>
        </div>

        {/* Apartment */}
        <section className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Квартира</label>
          <input
            type="text"
            value={apartment}
            onChange={(e) => setApartment(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </section>

        {/* Client Sector Selection */}
        <section className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Клиентский сектор <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'private', label: 'Частный' },
              { id: 'legal', label: 'Юр. лицо' },
              { id: 'multi_apartment', label: 'Многокв.' },
              { id: 'physical', label: 'Физ. лицо' }
            ].map((sector) => (
              <button
                key={sector.id}
                onClick={() => setClientSector(sector.id as any)}
                className={`py-3 px-2 rounded-xl text-xs font-bold border transition-all ${
                  clientSector === sector.id
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {sector.label}
              </button>
            ))}
          </div>
        </section>

        {/* IPU Class (District) for Almaty Su */}
        {resourceType === 'cold' && (
          <section className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Класс ИПУ <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 1, label: 'Класс B' },
                { id: 2, label: 'Класс C' }
              ].map((cls) => (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => setDeviceDistrict(cls.id)}
                  className={`py-3 px-2 rounded-xl text-sm font-bold border transition-all ${
                    deviceDistrict === cls.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {cls.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Consumer Info */}
        <section className="space-y-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900">Данные потребителя</h3>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">ФИО</label>
            <input
              value={consumerName}
              onChange={(e) => setConsumerName(e.target.value)}
              className="w-full p-3 border-b border-gray-200 focus:border-blue-500 outline-none"
              placeholder="Иванов Иван Иванович"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Телефон</label>
            <input
              type="tel"
              value={consumerPhone}
              onChange={handlePhoneChange}
              className="w-full p-3 border-b border-gray-200 focus:border-blue-500 outline-none"
              placeholder="+7(777) 000-00-00"
              maxLength={18}
            />
            <p className="text-xs text-gray-400 mt-1">Формат: +7(7XX) XXX-XX-XX</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Лицевой счёт</label>
            <input
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full p-3 border-b border-gray-200 focus:border-blue-500 outline-none"
              placeholder="123456789"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Примечание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 border-b border-gray-200 focus:border-blue-500 outline-none resize-none"
              placeholder="Дополнительная информация..."
              rows={2}
            />
          </div>
        </section>

        {/* Readings */}
        <section className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Показания при подключении <span className="text-red-500">*</span></label>
          <input
            type="number"
            value={joinReading}
            onChange={(e) => setJoinReading(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none text-lg font-mono"
            placeholder="0000.00"
          />
        </section>

        {/* Photos */}
        <section className="space-y-3">
          <label className="text-sm font-semibold text-gray-700">Фото подтверждение</label>
          <div className="grid grid-cols-3 gap-3">
            {photos.map((p, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                <img src={p} className="w-full h-full object-cover" alt="installation" />
              </div>
            ))}
            {photos.length < 3 && (
              <button onClick={openCamera} className="aspect-square bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:bg-gray-200 transition">
                <Camera size={24} />
                <span className="text-xs font-medium mt-1">Добавить</span>
              </button>
            )}
          </div>
          {isCameraOpen && (
            <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute bottom-10 flex space-x-6">
                <button onClick={() => setIsCameraOpen(false)} className="w-16 h-16 rounded-full bg-gray-800 text-white flex items-center justify-center">✕</button>
                <button onClick={takePhoto} className="w-20 h-20 rounded-full border-4 border-white bg-red-600 shadow-lg"></button>
              </div>
            </div>
          )}
        </section>

      </main>

      {/* Footer / Submit */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md shadow-top z-10 border-t border-gray-200 md:bottom-0 mb-16 md:mb-0">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 bg-green-600 text-white text-lg font-bold rounded-xl shadow-lg shadow-green-200 hover:transform hover:-translate-y-1 transition-all active:scale-95 disabled:bg-gray-400 disabled:shadow-none flex items-center justify-center space-x-2"
          >
            {submitting ? <Loader2 className="animate-spin" /> : <Check size={24} />}
            <span>{submitting ? 'Отправка...' : 'Создать установку'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default NewInstallation;
