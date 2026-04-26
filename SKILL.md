---
name: metrix-context
description: >
  Smart Metrix API — полная документация для Metrix Installer Pro PWA.
  Загружать при любой работе с формой NewInstallation, payload Meter, Device, Node,
  DeviceMode, справочниками, кэшированием, авторизацией, CORS.
  Источник истины: реальный Swagger JSON + захваченный production POST payload.
---

# Metrix Installer Pro — Контекст проекта

## Что за проект

PWA для монтажников IoT-Exponenta (Казахстан). Монтажники в поле регистрируют
установленные счётчики (вода/газ/тепло/электричество/датчики) в Smart Metrix
по адресу `sm.iot-exp.kz`. Своего бэкенда нет — только REST API Smart Metrix.

---

## Архитектура Smart Metrix (как устроена система)

```
Квартира → Счётчик (Meter) → Устройство СПД (Device) → Шлюз (Gateway) → Бэкенд
                                   ↓
                              DeviceModel (тип устройства, 33 шт)
                              DeviceMode  (режим порта,   36 шт)
```

**Иерархия адресов (Node-дерево):**
```
Алматы
  └─ ГКП "Алматы Су" (id=18, SupplierCompany)
      └─ ТОО "IoT-Exponenta" Алматы Су (id=20, ServiceCompany) ← ХВС счётчики
  └─ ТОО «Алматинские тепловые сети» (id=79, SupplierCompany)  ← ГВС счётчики
```

Монтажник не создаёт Node — только выбирает / получает автоматически по resource_type.

---

## Авторизация

```
POST /api-token-auth/
Body: { username, password }
Response: { token: "40-hex-chars", username, password }
Header: Authorization: Token <40-hex>
```

- Токен **не истекает** (Django opaque token)
- Logout endpoint **отсутствует** — клиент сам чистит localStorage
- Refresh endpoint **отсутствует** — не нужен
- `/me` endpoint **отсутствует** — при логине сохрани username отдельно в localStorage

---

## CORS

`sm.iot-exp.kz` закрыт для внешних origins.
- Dev: Vite proxy (`/api` → `https://sm.iot-exp.kz`)
- Prod: бэкенд должен добавить домен деплоя в whitelist

---

## Endpoints которые нужны приложению монтажника

| Метод | URL | Назначение |
|---|---|---|
| POST | `/api-token-auth/` | Логин |
| GET | `/api/v1/device/?search={EUI}` | Поиск устройства по EUI |
| GET | `/api/v1/device/{id}/` | Детали устройства |
| GET | `/api/v1/device/model/?page_size=100` | Справочник моделей устройств |
| **GET** | **`/api/v1/device/mode/?device_model={N}`** | **Режимы порта (фильтр по модели!)** |
| GET | `/api/v1/meter/model/?page_size=300` | Справочник моделей счётчиков |
| GET | `/api/v1/resource_type/?page_size=20` | Типы ресурсов |
| GET | `/api/v1/installation_place/?page_size=200` | Места установки |
| GET | `/api/v1/object_type/?page_size=300` | Типы объектов |
| GET | `/api/v1/address/{id}/` | Адрес устройства (если нужен district) |
| **POST** | **`/api/v1/meter/`** | **Создание акта установки** |

### ⚠️ Критически важно про DeviceMode endpoint

```
ПРАВИЛЬНО:  GET /api/v1/device/mode/?device_model=20
НЕВЕРНО:    GET /api/v1/port_mode/          ← 404, не существует
НЕВЕРНО:    GET /api/v1/device_mode/        ← 404, не существует
```

Параметр `device_model` фильтрует на стороне сервера — клиентская фильтрация не нужна.

---

## ⭐ Реальный POST /api/v1/meter/ payload

Захвачен из production 2026-04-23, это источник истины.

```json
{
  "serial_number": "TEST001",
  "join_date": "2026-04-23",
  "join_reading": 0.256,
  "device": 74716,
  "node": 20,
  "resource_type": 1,
  "type": 1,
  "device_mode": 33,
  "port": 2,
  "client_sector": "private",
  "installation_place": 1,
  "object_type": 10,
  "consumer": "Кириеева И.В",
  "apartment": "43",
  "phone": "+7 (771) 760-07-48",
  "account_id": "7496",
  "description": "",
  "is_active": true,
  "additional_data": {
    "almaty_su_street_id": "305",
    "district": 2
  }
}
```

---

## Полная спецификация полей MeterListCreate

### REQUIRED (без них — 400 Bad Request)
```
serial_number  string ≤100    серийный номер счётчика
join_date      YYYY-MM-DD     дата подключения (default today)
join_reading   number         показание при подключении
device         integer        FK на Device (из поиска по EUI)
```

### Optional (но нужны для правильной работы)
```
node             integer   FK на Node. AUTO по resource_type (ХВС=20, ГВС=79)
resource_type    integer   FK. 1=ХВС, 2=ГВС, 3=Газ, 4=Электр, 5=Отопление
type             integer   FK на MeterModel (224 модели)
device_mode      integer   FK на DeviceMode. ФИЛЬТР: /device/mode/?device_model=N
port             integer   0-32767. Показывать только если DeviceMode требует!
client_sector    enum      'private'|'legal'|'multi_apartment'|'physical'
installation_place integer FK (111 вариантов: С/У, Колодец, Подвал...)
object_type      integer   FK (228 вариантов: Квартира, Коттедж...) ≠ installation_place!
consumer         string ≤100
apartment        string ≤100
phone            string ≤128  любой формат, бэк нормализует
account_id       string ≤100
description      string    default ""
is_active        boolean   default true
additional_data  object    JSONField без схемы (см. ниже)
check_date       date      optional, дата поверки
```

### additional_data — JSONField без схемы

Бэк не валидирует содержимое. Это extension для интеграторов.

**Для Алматы Су (ХВС, resource_type=1):**
```json
{
  "almaty_su_street_id": "305",   // string, ID улицы в БД Алматы Су
  "district": 2                    // integer, код района Алматы (НЕ строка!)
}
```

**Для ГВС (Алматинские тепловые сети):** поля НЕИЗВЕСТНЫ. Захватить реальный POST для ГВС.

**Для остальных ресурсов:** скорее всего `{}` или null.

### READONLY — НЕ слать в payload
```
id, node__name, type__name, resource_type__name,
device__eui, device__type__name, street, house,
reading, reading_dt, sent_date, last_reading,
upload_date, upload_status, avatar
```

### НЕ существует в Swagger
```
device__address  ← нет в MeterListCreate схеме. Убрать из payload.
```

---

## DeviceMode — структура

```json
{
  "id": 22,
  "name": "Счетчик со встроенным модемом",
  "class_name": "KazmeterPulseCounterMode",
  "device_model": 20,
  "additional_data": null
}
```

или

```json
{
  "id": 33,
  "name": "Счетчик импульсов",
  "class_name": "ExpDeviceGSMPulseCounterMode",
  "device_model": 31,
  "additional_data": {
    "fields": [
      {"name": "port", "type": "integer", "label": "Порт"}
    ]
  }
}
```

### Логика поля "Порт"

```ts
const selectedMode = modes.find(m => m.id === deviceModeId);
const needsPort = selectedMode?.additional_data?.fields?.some(f => f.name === 'port') ?? false;
```

- `additional_data === null` → порт НЕ нужен (встроенный модем)
- `additional_data.fields` содержит `{name: "port"}` → показывать input Порт
- `additional_data.fields` содержит `min_reading/max_reading` → датчики, для MVP пропустить

### Автоматика выбора режима

```ts
const availableModes = response.results; // API уже отфильтровал по device_model

if (availableModes.length === 0) {
  // "Для этого устройства нет режимов — обратитесь к администратору"
} else if (availableModes.length === 1) {
  setDeviceModeId(availableModes[0].id); // auto-select
} else {
  // показать dropdown
}
```

---

## Device — структура (из DeviceListCreate)

```ts
interface Device {
  id: number;
  eui: string;               // EUI-64, 16 символов
  type: number;              // FK на DeviceModel → используется для фильтра device/mode/
  type__name: string;        // readonly "KAZMETER Pro LRW"
  address: number | null;    // FK на Address
  address_name: string;      // readonly, computed "ул. Кокбастау, 5"
  additional_data: {
    district?: number;       // код района — брать отсюда для Meter.additional_data.district
    [key: string]: any;
  } | null;
  gateway: number | null;
  network_server: number | null;
  is_active: boolean;
  lat: string; lng: string;
  snr: number | null;
  rssi: number | null;
  battery_level: number | null;
  meters: MeterListInDevice[]; // счётчики уже навешанные на порты
}
```

**При выборе Device автоматически заполнить:**
```ts
setDeviceId(device.id);
setDeviceType(device.type);                         // для фильтра device/mode/
setDeviceAddress(device.address);                   // (не слать в payload!)
setDisplayAddress(device.address_name);
setDistrict(device.additional_data?.district ?? null); // → Meter.additional_data.district
```

---

## Address — структура

```ts
interface Address {
  id: number;
  name: string;            // readonly computed
  province: string | null; // "Алматинская область"
  locality: string | null; // "Алматы"
  area: string | null;     // "Бостандыкский район" (областной район)
  district: string | null; // "Алмалинский" (городской район) — STRING!
  street: string | null;
  house: string | null;
  lng: number | null;
  lat: number | null;
}
```

⚠️ **`Address.district` это STRING** ("Алмалинский"), а **`Meter.additional_data.district` это INTEGER** (2).
Это разные сущности — не путать!

---

## ⭐ Auto-node mapping

```ts
export const AUTO_NODE_BY_RESOURCE: Record<number, number> = {
  1: 20,   // Холодная вода → ТОО "IoT-Exponenta" Алматы Су
  2: 79,   // Горячая вода → ТОО «Алматинские тепловые сети»
};

export const NODE_LABELS: Record<number, string> = {
  20: 'ТОО "IoT-Exponenta" Алматы Су',
  79: 'ТОО «Алматинские тепловые сети»',
};
```

---

## Resource Types — все 9

```
id=1   ХВС   Холодная вода
id=2   ГВС   Горячая вода
id=3   ГС    Газ
id=4   ЭС    Электричество
id=5   ТС    Отопление
id=6         Видеонаблюдение
id=7         Датчик вскрытия
id=8         Датчик влажности
id=10        Датчик давления    ← id=10 (не 9!)
```

---

## Device Models — все 33 (для DeviceMode фильтрации)

```
id=1   ORIONMETER ORN-TWM       class=OrionMeter_ORN_TWM    ports=1
id=2   ORIONMETER LA-IP          class=OrionMeter_LA_IP      ports=3
id=3   Бетар-Вега СХВЭ/СГВЭ     class=VegaBetar             ports=1
id=4   Вега СИ-11                class=VegaSi11              ports=4
id=5   ТЕРМИНАЛ-М-LRW            class=Terminal_M_LRW        ports=4
id=6   Smart-2 Pro NB-IOT        class=Smart2ProNBIoT        ports=4
id=7   ORIONMETER LA-IP-RSP      class=OrionMeter_LA_IP_RSP  ports=3
id=8   Бетар СХВЭ/СГВЭ Карат    class=KaratBetar            ports=1
id=9   SmartLighting NB-IoT      class=SmartLightingNBIoT    ports=1
id=10  ТРИТОН-10                 class=Triton10              ports=10
id=11  Smart Aqua 1.0            class=SmartAqua1            ports=1
id=12  TELEOFIS RTU102           class=TeleofisRTU102        ports=6
id=13  ДЕКАСТ ВСКМ iWAN          class=DecastVSKM            ports=1
id=14  ДЕКАСТ СТК МАРС «NEO»    class=DecastSTKMarsNEO      ports=1
id=15  ExpDevice WF              class=ExpDeviceWF           ports=2
id=18  ExpDevice LRW             class=Terminal_M_LRW        ports=10
id=19  ExpDevice LRW 6-й/8-й    class=Terminal_M_LRW_6_8    ports=8
id=20  KAZMETER Pro LRW          class=Kazmeter              ports=1   ← mode id=22
id=21  SmartPress NB-IoT         class=SmartPressNBIoT       ports=1
id=22  ExpDevice Eth             class=ExpDeviceEth          ports=2
id=23  Smart-10 Pro NB-IOT       class=Smart10ProNBIoT       ports=10
id=24  Пульсар модель 1          class=PulsarM1              ports=1   ← mode id=28
id=25  МУР1001.9                 class=MUR1001_9GSM          ports=2
id=26  Пульсар Lite              class=PulsarLite            ports=1
id=27  ВВТ NB-IoT                class=VVTNBIoT              ports=1
id=28  SmartOn EE 1              class=SmartOnEE1            ports=1
id=29  Qalcosonic W1             class=QalcosonicW1          ports=1
id=30  RAK Field Tester          class=RAKFieldTester        ports=1
id=31  ExpDevice GSM             class=ExpDeviceGSM          ports=10  ← mode id=33 (port req.)
id=32  ExpDevice NB-IoT          class=ExpDeviceNBIoT        ports=2
id=33  Kazmeter NB-IoT           class=KazmeterNBIoT         ports=1
id=34  Goldcard LXDG-15          class=GoldcardLXDG15        ports=1
id=35  Goldcard LXC-15FC         class=GoldcardLXC15FC       ports=1
```

---

## Кэширование справочников

Все списки кэшировать в localStorage, TTL 24h.

```ts
async function loadCached<T>(key: string, fetcher: () => Promise<T[]>): Promise<T[]> {
  const cached = localStorage.getItem(key + '_data');
  const ts = localStorage.getItem(key + '_ts');
  if (cached && ts && Date.now() - Number(ts) < 86_400_000) {
    return JSON.parse(cached);
  }
  const data = await fetcher();
  localStorage.setItem(key + '_data', JSON.stringify(data));
  localStorage.setItem(key + '_ts', String(Date.now()));
  return data;
}
```

**DeviceMode** — НЕ кэшировать глобально. Загружать **по требованию** при выборе устройства
(`/device/mode/?device_model={N}`) и кэшировать отдельно по ключу `dm_modes_{deviceModelId}`.

---

## Известные баги в текущем коде (статус April 2026)

1. ❌ ГВС → node **21** (должно быть **79**)
2. ❌ `client_sector: "legal"` хардкод → нужен UI radio
3. ❌ `district: 2` хардкод → брать из `device.additional_data.district`
4. ❌ `object_type = installation_place` → разные поля, разные справочники
5. ❌ Нет `device_mode` в payload → добавить через `/api/v1/device/mode/?device_model=N`
6. ❌ `device__address` шлётся в payload → убрать (нет в Swagger)
7. ❌ `meterModels.ts` static (32) → заменить на `GET /api/v1/meter/model/?page_size=300`
8. ❌ Mojibake в строках (`РЎРµСЂРёР№РЅС‹Р№` вместо `Серийный`)
9. ❌ `endpoints.installation = '/api/v1/installation/'` → удалить (404)
10. ❌ port_mode endpoint `/port_mode/` → исправить на `/device/mode/?device_model=N`
11. ❌ Поле "Порт" всегда видно → скрывать если DeviceMode не требует

---

## Locked product decisions

- **Login screen — оставить** (существующий AuthContext + localStorage)
- **NO фото в payload Meter** (avatar через отдельный endpoint, для MVP не нужно)
- **Single-page form** для NewInstallation (без wizard)
- **Auto-node для воды** по таблице выше
- **Drafts через localStorage** — сохранить
- **QR scanner** — сохранить
- **Yandex Geocoder** — сохранить (починить encoding)
- **Capacitor / Android** — НЕ нужен, веб PWA на мобильных браузерах

---

## TypeScript types (финальные)

```ts
export type ClientSector = 'private' | 'legal' | 'multi_apartment' | 'physical';

export interface MeterAdditionalData {
  almaty_su_street_id?: string;
  district?: number;
  [key: string]: unknown;
}

export interface MeterCreatePayload {
  // Required
  serial_number: string;
  join_date: string;
  join_reading: number;
  device: number;
  // Strongly recommended
  node?: number;
  resource_type?: number;
  type?: number;             // MeterModel.id (224 шт)
  device_mode?: number;     // DeviceMode.id (из /device/mode/?device_model=N)
  port?: number;            // только если DeviceMode.additional_data.fields содержит port
  client_sector?: ClientSector;
  installation_place?: number;
  object_type?: number;     // ОТДЕЛЬНО от installation_place!
  // Consumer
  consumer?: string;
  apartment?: string;
  phone?: string;
  account_id?: string;
  description?: string;
  is_active?: boolean;
  // Extension
  additional_data?: MeterAdditionalData;
}

export interface PortMode {
  id: number;
  name: string;
  class_name: string | null;
  device_model: number;
  additional_data: {
    fields?: Array<{ name: string; type: string; label: string }>;
  } | null;
}

export interface DeviceModel {
  id: number;
  name: string;
  class_name: string;
  num_of_ports: number;
  len_of_eui: number;
  trans_tech_type?: number | null;
}

export interface Street {
  Название: string;   // mojibake key — оставить как есть, не переименовывать
  Код: string;
}
```