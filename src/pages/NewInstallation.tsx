import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QrCode, Check, ChevronDown, Loader2, Search, FileText } from 'lucide-react';
import { YMaps, Map, Placemark } from '@pbe/react-yandex-maps';
import api, { endpoints, getPortModes, getMeterModels, getInstallationPlaces, getObjectTypes, getServiceNodes, getNodeDetail } from '../api';
import streetsData from '../assets/streets.json';
import type { Street, PortMode, MeterModel, ServiceNode, NodeAdditionalField } from '../types';

interface DictionaryItem {
  id: number;
  name: string;
}

const NewInstallation: React.FC = () => {
  const location = useLocation();

  // -- State --
  const [submitting, setSubmitting] = useState(false);
  const [, setError] = useState<string | null>(null);

  // 1. Resource Type & Hidden Fields
  const [resourceType, setResourceType] = useState<'cold' | 'hot' | null>(null);
  const [node, setNode] = useState<number>(20);
  // Region / organization (IoT-Exponenta service company). Picking it sets `node`
  // and, via the node detail, the region-specific extra fields. This replaces the
  // old Almaty-only auto-node (cold->20 / hot->256).
  const [serviceNodes, setServiceNodes] = useState<ServiceNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<ServiceNode | null>(null);
  const [nodeFields, setNodeFields] = useState<NodeAdditionalField[]>([]); // selected node's additional_fields
  const [dynamicData, setDynamicData] = useState<Record<string, string>>({}); // values for generic per-utility fields
  // Almaty Su (node 20) keeps its bespoke street-autocomplete + IPU class UI;
  // every other utility is driven generically from nodeFields.
  const isAlmatySu = selectedNode?.id === 20 || nodeFields.some(f => (f.name || '').includes('almaty_su_street_id'));
  // City used to scope the Yandex geocoder/address search. Falls back to Almaty
  // (the original behaviour) until a region is picked.
  const geoCity = selectedNode?.city || 'Алматы';
  const [clientSector, setClientSector] = useState<'private' | 'legal' | 'multi_apartment' | 'physical'>('legal');
  const [description, setDescription] = useState('');
  const [joinDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // 2. Modem Serial / Device
  const [modemSerial, setModemSerial] = useState('');
  const [deviceId, setDeviceId] = useState<number | null>(null); // Store selected device ID
  const [, setDeviceAddress] = useState<number | null>(null); // Store device address FK (required by backend)
  const [deviceType, setDeviceType] = useState<number | null>(null); // Store device model ID (18, 20, 31, etc.)
  const [deviceTypeName, setDeviceTypeName] = useState<string>(''); // For display
  const [deviceDistrict, setDeviceDistrict] = useState<number>(2); // Default to C (2) for Almaty Su
  const [isScanning, setIsScanning] = useState(false);
  const [suggestedDevices, setSuggestedDevices] = useState<any[]>([]);
  const [showDeviceSuggestions, setShowDeviceSuggestions] = useState(false);
  const [searchingDevices, setSearchingDevices] = useState(false);
  const [deviceSearchDone, setDeviceSearchDone] = useState(false); // true once a search has returned, for "not found" feedback
  const deviceSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deviceSearchSeq = useRef(0); // guards against out-of-order responses

  // Port Logic State
  const [port, setPort] = useState<number>(2); // Default to 2
  const [isPortLocked, setIsPortLocked] = useState(false); // If true, user can't change port (e.g. Kazmeter)
  const [portModes, setPortModes] = useState<PortMode[]>([]);
  const [portModeId, setPortModeId] = useState<number | null>(null);
  const [loadingModes, setLoadingModes] = useState(false);

  // 3. Meter Selection
  const [meterModels, setMeterModels] = useState<MeterModel[]>([]);
  const [selectedMeterModelId, setSelectedMeterModelId] = useState<string>('');
  const [meterSearchTerm, setMeterSearchTerm] = useState('');
  const [showMeterSuggestions, setShowMeterSuggestions] = useState(false);

  // 4. Meter Number
  const [meterNumber, setMeterNumber] = useState('');

  // 5. Address
  const [address, setAddress] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [suggestedStreets, setSuggestedStreets] = useState<Street[]>([]);
  const [selectedStreet, setSelectedStreet] = useState<Street | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [manualStreetCode, setManualStreetCode] = useState<string>('');
  const [currentCoords, setCurrentCoords] = useState<{lat: number, lng: number}>({ lat: 43.238949, lng: 76.889709 });
  const [mapState, setMapState] = useState({ center: [43.238949, 76.889709], zoom: 12 });

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

  // 12. Photos (Removed)
  // const [photos, setPhotos] = useState<string[]>([]);
  const [, setPhotos] = useState<string[]>([]); // Keep setter for reset logic without error
  // const videoRef = useRef<HTMLVideoElement>(null);
  // const [isCameraOpen, setIsCameraOpen] = useState(false);

  // -- Effects --

  // Load Draft if passed via navigation
  useEffect(() => {
    if (location.state && location.state.draft) {
      const draft = location.state.draft;
      setResourceType(draft.resourceType || null);
      if (draft.serviceNode) selectRegion(draft.serviceNode);
      if (draft.dynamicData) setDynamicData(draft.dynamicData);
      setModemSerial(draft.modemSerial || '');
      setMeterNumber(draft.meterNumber || '');
      setAddress(draft.address || '');
      setHouseNumber(draft.houseNumber || '');
      setConsumerName(draft.consumerName || '');
      setConsumerPhone(draft.consumerPhone || '+7(7');
      setAccountId(draft.accountId || '');
      setJoinReading(draft.joinReading || '');
      setDescription(draft.description || '');
      setPort(draft.port || 1);
      setPortModeId(draft.device_mode || null);
      setSelectedMeterModelId(draft.type?.toString() || '');
      setInstallationPlace(draft.installation_place?.toString() || '');
      setObjectType(draft.object_type?.toString() || '');
      setApartment(draft.apartment || '');
      setClientSector(draft.client_sector || 'legal');
      setManualStreetCode(draft.manualStreetCode || '');
      if (draft.selectedStreet) setSelectedStreet(draft.selectedStreet);
      if (draft.currentCoords) setCurrentCoords(draft.currentCoords);
      if (draft.deviceDistrict) setDeviceDistrict(draft.deviceDistrict);
      
      if (draft.modemSerial) {
        setModemSerial(draft.modemSerial);
        // Automatically try to select the device if we have enough info
        if (draft.device) {
          // If the draft has a device object or ID, we can pre-select it
          // Let's trigger a search and auto-select the first exact match
          api.get(`/api/v1/device/?search=${draft.modemSerial}`)
            .then(res => {
              if (res.data?.results?.length > 0) {
                const exactMatch = res.data.results.find((d: any) => 
                  (d.eui === draft.modemSerial || d.serial_number === draft.modemSerial) &&
                  (draft.device === d.id)
                );
                if (exactMatch) {
                  selectDevice(exactMatch);
                } else if (res.data.results.length === 1) {
                  selectDevice(res.data.results[0]);
                }
              }
            })
            .catch(err => console.error('Auto-select device failed', err));
        }
      }
    }
  }, [location]);

  // Restore the last picked region/organization — installers usually work one
  // region for a long stretch, so this saves them re-selecting every act.
  // Skipped when continuing a draft (the draft carries its own region).
  useEffect(() => {
    if (location.state && (location.state as any).draft) return;
    const saved = localStorage.getItem('last_service_node');
    if (saved) {
      try {
        selectRegion(JSON.parse(saved) as ServiceNode);
      } catch { /* ignore corrupt cache */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update map when house number changes
  useEffect(() => {
    if (address && houseNumber && houseNumber.length > 0) {
      const timeoutId = setTimeout(() => {
        const apiKey = 'e0dcd455-3aae-4fe4-abc2-2a258e341c0b';
        fetch(`https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${encodeURIComponent(`${geoCity}, ${address}, ${houseNumber}`)}&format=json`)
          .then(res => res.json())
          .then(data => {
            const geoObject = data.response.GeoObjectCollection.featureMember[0]?.GeoObject;
            if (geoObject) {
              const pos = geoObject.Point.pos.split(' ');
              const lng = parseFloat(pos[0]);
              const lat = parseFloat(pos[1]);
              setCurrentCoords({ lat, lng });
              setMapState(prev => ({ ...prev, center: [lat, lng], zoom: 18 }));
            }
          })
          .catch(err => console.error('House geocode error', err));
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [address, houseNumber, geoCity]);

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
    loadCachedOrFetch('service_nodes_cache', 'service_nodes_ts', setServiceNodes, getServiceNodes);
  }, []);

  // -- Handlers --

  // Pick a region/organization: set meter.node, remember it, and load the
  // node's additional_fields (the per-utility extra-field schema).
  const selectRegion = async (sn: ServiceNode | null) => {
    setSelectedNode(sn);
    setNodeFields([]);
    setDynamicData({});
    if (!sn) return;
    setNode(sn.id);
    localStorage.setItem('last_service_node', JSON.stringify(sn));
    try {
      const detail = await getNodeDetail(sn.id);
      setNodeFields(Array.isArray(detail?.additional_fields) ? detail.additional_fields : []);
    } catch (err) {
      console.error('Failed to load node detail', err);
    }
  };

  const saveDraft = () => {
    const draft = {
      timestamp: new Date().toISOString(),
      resourceType,
      modemSerial,
      meterNumber,
      address,
      houseNumber,
      consumerName,
      consumerPhone,
      accountId,
      joinReading,
      apartment,
      description,
      port,
      device_mode: portModeId,
      type: selectedMeterModelId,
      installation_place: installationPlace,
      object_type: objectType,
      device: deviceId,
      client_sector: clientSector,
      manualStreetCode,
      selectedStreet,
      currentCoords,
      deviceDistrict,
      serviceNode: selectedNode,
      dynamicData
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
        // Almaty gets a tighter bbox to focus results; other cities search broadly.
        const bbox = geoCity === 'Алматы' ? '&bbox=76.7,43.1,77.1,43.4' : '';
        const geo = encodeURIComponent(`${geoCity}, ${value}`);
        fetch(`https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${geo}${bbox}&format=json`)
          .then(res => res.json())
          .then(data => {
            const featureMember = data.response.GeoObjectCollection.featureMember;
            const suggestions: Street[] = featureMember.map((item: any) => {
              const pos = item.GeoObject.Point.pos.split(' ');
              const fullText = item.GeoObject.metaDataProperty.GeocoderMetaData.text || '';
              return {
                Название: fullText.replace(`Казахстан, ${geoCity}, `, '').replace(`Казахстан, город ${geoCity}, `, ''),
                Код: "0",
                lng: parseFloat(pos[0]),
                lat: parseFloat(pos[1])
              };
            });

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

  const selectStreet = (street: Street & {lat?: number, lng?: number}) => {
    setAddress(street.Название);
    setSelectedStreet(street);
    setManualStreetCode(street.Код && street.Код !== "0" ? street.Код : '');
    setShowSuggestions(false);
    
    if (street.lat && street.lng) {
      setCurrentCoords({ lat: street.lat, lng: street.lng });
      setMapState({ center: [street.lat, street.lng], zoom: 17 });
    }
  };

  const geocodeByCoords = async (lat: number, lng: number) => {
    try {
      const apiKey = 'e0dcd455-3aae-4fe4-abc2-2a258e341c0b';
      const response = await fetch(`https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&format=json&geocode=${lng},${lat}&lang=ru_RU&results=1`);
      const data = await response.json();
      const geoObject = data.response.GeoObjectCollection.featureMember[0]?.GeoObject;
      
      if (geoObject) {
        const meta = geoObject.metaDataProperty.GeocoderMetaData;
        const components = meta.Address.Components;
        
        // Find street and house
        const streetComp = components.find((c: any) => c.kind === 'street');
        const houseComp = components.find((c: any) => c.kind === 'house');
        
        if (streetComp) {
          const sName = streetComp.name;
          setAddress(sName);
          
          // Match with local streets.json for code
          const localMatch = (streetsData as Street[]).find(local =>
            local.Название.toLowerCase().includes(sName.toLowerCase()) ||
            sName.toLowerCase().includes(local.Название.toLowerCase())
          );
          if (localMatch) {
            setManualStreetCode(localMatch.Код);
            setSelectedStreet(localMatch);
          }
        }
        
        if (houseComp) {
          setHouseNumber(houseComp.name);
        }
      }
    } catch (err) {
      console.error('Reverse Geocode Error', err);
    }
  };

  const onMapClick = (e: any) => {
    const coords = e.get('coords');
    const [lat, lng] = coords;
    setCurrentCoords({ lat, lng });
    setMapState(prev => ({ ...prev, center: [lat, lng] }));
    geocodeByCoords(lat, lng);
  };

  // Runs the actual device lookup. NO auto-select — the installer always picks
  // from the list. Server-side `search` already matches EUI, description (where
  // the printed serial number lives) and address, so we rely on it directly
  // instead of re-filtering client-side on EUI only.
  const runDeviceSearch = async (value: string) => {
    const term = value.trim();
    if (term.length < 3) {
      setSuggestedDevices([]);
      setShowDeviceSuggestions(false);
      setDeviceSearchDone(false);
      return;
    }
    const seq = ++deviceSearchSeq.current;
    setSearchingDevices(true);
    setShowDeviceSuggestions(true);
    try {
      const res = await api.get('/api/v1/device/', {
        params: { search: term, ordering: '-sent_date', page_size: 20 },
      });
      if (seq !== deviceSearchSeq.current) return; // a newer search superseded this one
      const results = Array.isArray(res.data?.results) ? res.data.results : [];
      setSuggestedDevices(results);
      setDeviceSearchDone(true);
    } catch (err) {
      if (seq !== deviceSearchSeq.current) return;
      console.error('Device search failed', err);
      setSuggestedDevices([]);
      setDeviceSearchDone(true);
    } finally {
      if (seq === deviceSearchSeq.current) setSearchingDevices(false);
    }
  };

  const handleModemSerialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setModemSerial(value);
    // Any edit invalidates the previously chosen device.
    setDeviceId(null);
    setDeviceAddress(null);
    setDeviceType(null);
    setDeviceTypeName('');
    setIsPortLocked(false);

    // Real debounce: cancel the pending lookup on every keystroke (the old code
    // returned a cleanup fn from an onChange handler, which React never calls).
    if (deviceSearchTimer.current) clearTimeout(deviceSearchTimer.current);
    if (value.trim().length < 3) {
      setSuggestedDevices([]);
      setShowDeviceSuggestions(false);
      setDeviceSearchDone(false);
      return;
    }
    deviceSearchTimer.current = setTimeout(() => runDeviceSearch(value), 350);
  };

  const selectDevice = async (device: any) => {
    setModemSerial(device.eui || device.serial_number);
    setDeviceId(device.id);
    setDeviceAddress(null); // Ignore existing device address, user must enter/search for it
    
    if (device.additional_data?.district) {
      setDeviceDistrict(Number(device.additional_data.district));
    }

    // Store device type info. NOTE: the list endpoint returns `type__name`
    // (double underscore), not `type_name` — the old code read the wrong key
    // and always showed "Type 20" instead of the real model name.
    const dType = device.type || device.device_model;
    setDeviceType(dType);
    setDeviceTypeName(device.type__name || device.type_name || `Тип ${dType}`);
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
        scanner.clear();
        setIsScanning(false);
        // Put the scanned value in the field and search immediately — but the
        // installer still confirms the right device from the list (no auto-select).
        setModemSerial(decodedText);
        setDeviceId(null);
        setDeviceAddress(null);
        setDeviceType(null);
        setDeviceTypeName('');
        setIsPortLocked(false);
        runDeviceSearch(decodedText);
      }, () => {
        // ignore scan errors
      });
    }, 100);
  };

  /*
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
  */

  // Clear device/meter/consumer fields after a successful submit so nothing
  // stale carries into the next act. Region (selectedNode) and resource type are
  // intentionally kept — installers usually do many acts in the same area.
  const resetForm = () => {
    setModemSerial('');
    setDeviceId(null);
    setDeviceAddress(null);
    setDeviceType(null);
    setDeviceTypeName('');
    setSuggestedDevices([]);
    setShowDeviceSuggestions(false);
    setDeviceSearchDone(false);
    setPortModeId(null);
    setPortModes([]);
    setIsPortLocked(false);
    setSelectedMeterModelId('');
    setMeterSearchTerm('');
    setMeterNumber('');
    setAddress('');
    setHouseNumber('');
    setApartment('');
    setSelectedStreet(null);
    setConsumerName('');
    setConsumerPhone('+7(7');
    setAccountId('');
    setJoinReading('');
    setPhotos([]);
    setManualStreetCode('');
    setDynamicData({});
  };

  const handleSubmit = async () => {
    setError(null);
    if (!resourceType) { alert('Выберите тип ресурса'); return; }
    if (!selectedNode) { alert('Выберите регион / организацию'); return; }
    if (!modemSerial) { alert('Введите серийный номер модема'); return; }
    if (!deviceId) { alert('Сначала выберите устройство из списка поиска'); return; } 
    if (portModeId === null) { alert('Выберите режим работы устройства'); return; }
    if (!selectedMeterModelId) { alert('Выберите тип счётчика'); return; }
    if (!meterNumber) { alert('Введите номер счётчика'); return; }
    if (!address) { alert('Выберите улицу'); return; }
    if (!houseNumber) { alert('Введите номер дома'); return; }
    if (!joinReading) { alert('Введите показания'); return; }

    if (isAlmatySu && (!selectedStreet?.Код || selectedStreet.Код === "0")) {
      const confirmed = window.confirm(
        'Улица не выбрана из справочника. Акт будет создан без кода улицы Алматы Су. Продолжить?'
      );
      if (!confirmed) return;
    }

    // Prepare Payload
    const selectedMode = portModes.find(m => m.id === portModeId);
    const needsPort = selectedMode?.additional_data?.fields?.some(f => f.name === 'port') ?? false;
    const streetName = selectedStreet?.Название || address;
    const lat = currentCoords.lat;
    const lng = currentCoords.lng;

    // Region-specific extra fields from the selected node's schema. Almaty Su
    // keeps its bespoke street/IPU handling below; every other utility's fields
    // (e.g. Karaganda: check_date, address_code, район) are collected generically
    // from dynamicData and routed top-level or into additional_data by `name`.
    const extraTopLevel: any = {};
    const extraAdditional: any = {};
    const AD_PREFIX = 'additional_data.';
    for (const f of nodeFields) {
      if (f.name === 'additional_data.almaty_su_street_id' || f.name === 'additional_data.district') continue;
      const raw = dynamicData[f.name];
      if (raw == null || raw === '') continue;
      const value = f.type === 'select' ? Number(raw) : raw;
      if (f.name.startsWith(AD_PREFIX)) extraAdditional[f.name.slice(AD_PREFIX.length)] = value;
      else extraTopLevel[f.name] = value;
    }
    if (isAlmatySu) {
      const sc = manualStreetCode || selectedStreet?.Код;
      if (sc && sc !== "0") extraTopLevel.address_code = sc;
    }

    const meterPayload: any = {
      serial_number: meterNumber || "",
      description: description || "",
      ...(needsPort ? { port: Number(port) } : {}),
      join_date: joinDate,
      join_reading: Number(joinReading),
      is_active: true,
      client_sector: clientSector,
      street: streetName,
      house: houseNumber,
      ...extraTopLevel,
      additional_data: (() => {
        const data: any = { ...extraAdditional };
        if (isAlmatySu) {
          const streetId = manualStreetCode || selectedStreet?.Код;
          if (streetId && streetId !== "0") data.almaty_su_street_id = streetId;
          data.district = deviceDistrict || 2;
        }
        data.lat = lat;
        data.lng = lng;
        return data;
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
      resource_type: resourceType === 'cold' ? 1 : 2,
      node: node,
    };

    const addressPayload = {
      province: geoCity,
      locality: geoCity,
      area: '',
      district: geoCity,
      street: streetName,
      house: houseNumber,
      lng: lng,
      lat: lat,
      coordinates: `SRID=4326;POINT (${lng} ${lat})`
    };

    setSubmitting(true);

    // Offline Sync Logic
    if (!navigator.onLine) {
      const outboxItem = {
        ...meterPayload,
        _offlineAddressData: addressPayload,
        _outboxId: Date.now(),
        // Extra info for history
        modemSerial,
        address
      };

      const outbox = JSON.parse(localStorage.getItem('installation_outbox') || '[]');
      outbox.push(outboxItem);
      localStorage.setItem('installation_outbox', JSON.stringify(outbox));

      alert('Оффлайн: Установка сохранена в очередь. Она будет отправлена автоматически при появлении интернета.');
      resetForm();
      setSubmitting(false);
      return;
    }

    try {
      // Create Address
      let addressId = null;
      try {
        const newAddressRes = await api.post(endpoints.address, addressPayload);
        addressId = newAddressRes.data.id;
        setDeviceAddress(addressId);
      } catch (err) {
        console.error('Address creation failed:', err);
      }

      const finalPayload = { ...meterPayload };
      if (addressId) {
        finalPayload.device__address = addressId;
      }

      console.log('Sending payload:', JSON.stringify(finalPayload, null, 2));

      // Create Meter
      await api.post(endpoints.meter, finalPayload);

      // Save to History
      const historyItem = {
        timestamp: new Date().toISOString(),
        address,
        houseNumber,
        meterNumber,
        modemSerial,
        status: 'success',
        ...finalPayload,
        consumerName,
        consumerPhone,
        accountId,
        joinReading,
        description,
        port,
        apartment
      };
      const existingHistory = JSON.parse(localStorage.getItem('installation_history') || '[]');
      existingHistory.unshift(historyItem);
      localStorage.setItem('installation_history', JSON.stringify(existingHistory));

      resetForm();
      alert('Установка успешно создана!');
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

        {/* Region / Organization (sets meter.node) */}
        <section className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Регион / организация <span className="text-red-500">*</span></label>
          <div className="relative">
            <select
              value={selectedNode?.id ?? ''}
              onChange={(e) => {
                const id = Number(e.target.value);
                selectRegion(serviceNodes.find(n => n.id === id) || null);
              }}
              className="w-full appearance-none bg-white border border-gray-300 text-gray-900 rounded-xl p-4 pr-10 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Выберите регион...</option>
              {serviceNodes.map(n => (
                <option key={n.id} value={n.id}>
                  {n.city ? `${n.city} — ` : ''}{n.supplier || n.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-4 text-gray-400 pointer-events-none" size={20} />
          </div>
          {selectedNode && (
            <p className="text-[11px] text-gray-500 mt-1">Узел: {selectedNode.name} (ID {selectedNode.id})</p>
          )}
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
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-80 overflow-y-auto">
              {searchingDevices && (
                <div className="flex items-center gap-2 p-4 text-sm text-gray-500">
                  <Loader2 className="animate-spin text-blue-600" size={18} />
                  Поиск модема...
                </div>
              )}

              {!searchingDevices && deviceSearchDone && suggestedDevices.length === 0 && (
                <div className="p-4 text-sm text-gray-500 text-center">
                  Модем не найден. Проверьте серийный номер, EUI или адрес.
                </div>
              )}

              {!searchingDevices && suggestedDevices.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Найдено: {suggestedDevices.length}{suggestedDevices.length >= 20 ? '+ (уточните запрос)' : ''} — выберите ваш модем
                  </div>
                  {suggestedDevices.map((d) => (
                    <button
                      type="button"
                      key={d.id}
                      onClick={() => selectDevice(d)}
                      className="w-full text-left p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-gray-900 text-sm">
                          {d.type__name || d.type_name || `Тип ${d.type}`}
                        </span>
                        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {d.is_active ? 'активен' : 'неактивен'}
                        </span>
                      </div>
                      {d.description && (
                        <div className="text-sm text-gray-700 mt-0.5 break-words">{d.description}</div>
                      )}
                      {d.address_name && (
                        <div className="text-xs text-gray-500 mt-0.5">Адрес: {d.address_name}</div>
                      )}
                      <div className="text-[11px] text-gray-400 font-mono mt-1 break-all">
                        EUI: {d.eui || d.serial_number || '—'} · ID {d.id}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
          {isScanning && (
            <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
              <div id="reader" className="w-full max-w-sm bg-white rounded-xl overflow-hidden"></div>
              <button 
                onClick={() => setIsScanning(false)} 
                className="mt-6 px-6 py-3 bg-white text-red-600 rounded-full font-bold"
              >
                Закрыть
              </button>
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

        {/* Meter Model Selection (Searchable) */}
        <section className="space-y-2 relative">
          <label className="text-sm font-semibold text-gray-700">Тип счётчика <span className="text-red-500">*</span></label>
          <div className="relative">
            <input
              type="text"
              value={meterSearchTerm}
              onChange={(e) => {
                setMeterSearchTerm(e.target.value);
                setShowMeterSuggestions(true);
              }}
              onFocus={() => setShowMeterSuggestions(true)}
              placeholder="Поиск типа счётчика (напр. СХВ-15)..."
              className="w-full bg-white border border-gray-300 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none pr-10"
            />
            <Search className="absolute right-4 top-4 text-gray-400 pointer-events-none" size={20} />
            
            {showMeterSuggestions && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto">
                {meterModels
                  .filter(m => m.name.toLowerCase().includes(meterSearchTerm.toLowerCase()))
                  .map(m => (
                    <div
                      key={m.id}
                      onClick={() => {
                        setSelectedMeterModelId(m.id.toString());
                        setMeterSearchTerm(m.name);
                        setShowMeterSuggestions(false);
                      }}
                      className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0"
                    >
                      {m.name}
                    </div>
                  ))
                }
                {meterModels.filter(m => m.name.toLowerCase().includes(meterSearchTerm.toLowerCase())).length === 0 && (
                  <div className="p-3 text-gray-500 text-center">Ничего не найдено</div>
                )}
              </div>
            )}
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

        {/* Address Selection (Searchable) */}
        <section className="space-y-2 relative">
          <label className="text-sm font-semibold text-gray-700">Улица <span className="text-red-500">*</span></label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={address}
                onChange={handleAddressChange}
                placeholder="Начните вводить название улицы..."
                className="w-full bg-white border border-gray-300 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none pr-10"
              />
              <Search className="absolute right-4 top-4 text-gray-400" size={20} />
              <p className="text-[10px] text-gray-400 mt-1 ml-1">Поиск по Яндекс Картам ({geoCity})</p>
              {showSuggestions && suggestedStreets.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto">
                  {suggestedStreets.map((s, idx) => (
                    <div
                      key={idx}
                      onClick={() => selectStreet(s)}
                      className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0 flex flex-col"
                    >
                      <span className="font-medium">{s.Название}</span>
                      {s.Код !== "0" && <span className="text-xs text-blue-600">Код: {s.Код}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Manual Street Code — only when the selected node (Almaty Su) requires it */}
        {isAlmatySu && (
          <section className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Код улицы в базе Алматы Су</label>
            <input
              type="text"
              value={manualStreetCode}
              onChange={(e) => setManualStreetCode(e.target.value)}
              placeholder="Код улицы (автоматически или вручную)"
              className="w-full bg-white border border-gray-300 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className="text-[10px] text-gray-400 mt-1 ml-1">Если код не найден автоматически, введите его вручную</p>
          </section>
        )}

        {/* Generic per-utility extra fields from node.additional_fields
            (e.g. Karaganda: дата поверки, код адреса, район). Almaty Su's street
            code is handled above and its IPU class below; everything else here. */}
        {nodeFields
          .filter(f => f.name !== 'additional_data.almaty_su_street_id' && f.name !== 'additional_data.district')
          .map(f => (
            <section key={f.name} className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">{f.label}</label>
              {f.type === 'select' && Array.isArray(f.choices) ? (
                <div className="relative">
                  <select
                    value={dynamicData[f.name] ?? ''}
                    onChange={(e) => setDynamicData(prev => ({ ...prev, [f.name]: e.target.value }))}
                    className="w-full appearance-none bg-white border border-gray-300 text-gray-900 rounded-xl p-4 pr-10 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Выберите...</option>
                    {f.choices.map(c => <option key={String(c.id)} value={String(c.id)}>{c.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-4 text-gray-400 pointer-events-none" size={20} />
                </div>
              ) : (
                <input
                  type={f.type === 'date' ? 'date' : 'text'}
                  value={dynamicData[f.name] ?? ''}
                  onChange={(e) => setDynamicData(prev => ({ ...prev, [f.name]: e.target.value }))}
                  className="w-full bg-white border border-gray-300 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              )}
            </section>
          ))
        }

        {/* House and Flat */}
        <div className="grid grid-cols-2 gap-4">
          <section className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Дом <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
              placeholder="Дом"
              className="w-full bg-white border border-gray-300 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </section>
          <section className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Квартира</label>
            <input
              type="text"
              value={apartment}
              onChange={(e) => setApartment(e.target.value)}
              placeholder="Кв."
              className="w-full bg-white border border-gray-300 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </section>
        </div>

        {/* Map Selection */}
        <section className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Расположение на карте <span className="text-gray-400 text-xs font-normal">(можно кликнуть для выбора)</span></label>
          <div className="rounded-xl overflow-hidden border border-gray-300 h-64 relative">
            <YMaps query={{ apikey: 'e0dcd455-3aae-4fe4-abc2-2a258e341c0b', lang: 'ru_RU' }}>
              <Map 
                state={mapState} 
                width="100%" 
                height="100%" 
                onClick={onMapClick}
                onBoundsChange={(e: any) => {
                  // Optional: update zoom if user scrolls
                  const newZoom = e.get('target').getZoom();
                  if (newZoom !== mapState.zoom) {
                    setMapState(prev => ({ ...prev, zoom: newZoom }));
                  }
                }}
              >
                <Placemark 
                  geometry={[currentCoords.lat, currentCoords.lng]} 
                  options={{ draggable: true }}
                  onDragEnd={(e: any) => {
                    const coords = e.get('target').geometry.getCoordinates();
                    const [lat, lng] = coords;
                    setCurrentCoords({ lat, lng });
                    geocodeByCoords(lat, lng);
                  }}
                />
              </Map>
            </YMaps>
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 px-1">
            <span>Широта: {currentCoords.lat.toFixed(6)}</span>
            <span>Долгота: {currentCoords.lng.toFixed(6)}</span>
          </div>
        </section>

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

        {/* Client Sector removed as it is now default legal and hidden */}

        {/* IPU Class (District) — Almaty Su only */}
        {isAlmatySu && (
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

      {/* Photos (Removed per user request) */}
      {/* <section className="space-y-3"> ... </section> */}

      </main>

      {/* Footer / Submit */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md shadow-top z-10 border-t border-gray-200 md:bottom-0 mb-16 md:mb-0">
        <div className="max-w-lg mx-auto flex gap-3">
          <button
            onClick={saveDraft}
            className="flex-1 py-4 bg-white border-2 border-blue-600 text-blue-600 text-lg font-bold rounded-xl hover:bg-blue-50 transition-all active:scale-95 flex items-center justify-center space-x-2"
          >
            <FileText size={24} />
            <span>В черновик</span>
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-[2] py-4 bg-green-600 text-white text-lg font-bold rounded-xl shadow-lg shadow-green-200 hover:transform hover:-translate-y-1 transition-all active:scale-95 disabled:bg-gray-400 disabled:shadow-none flex items-center justify-center space-x-2"
          >
            {submitting ? <Loader2 className="animate-spin" /> : <Check size={24} />}
            <span>{submitting ? 'Отправка...' : 'Создать'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default NewInstallation;
