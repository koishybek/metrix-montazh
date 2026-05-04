# Smart Metrix API — Полная спецификация

> Источник: реальный Swagger JSON с sm.iot-exp.kz/swagger/?format=openapi (апрель 2026)
> Версия API: v1

## Base URL

```
https://sm.iot-exp.kz
Content-Type: application/json
Authorization: Token <40-hex>
```

---

## Pagination (все list endpoints)

```json
{
  "count": 224,
  "next": "https://sm.iot-exp.kz/api/v1/meter/model/?page=2",
  "previous": null,
  "results": [...]
}
```

Query params: `page`, `page_size`, `ordering`, `search`

---

## Auth

### POST /api-token-auth/

```
Body:     { username: string, password: string }
Response: { token: string (40 hex), username: string, password: string }
Errors:   400 { non_field_errors: ["Unable to log in..."] }
```

---

## Device

### GET /api/v1/device/

Поиск устройств по EUI.

```
Params: type, node_service_company, gateway, network_server, search, page, page_size
Response: paginated DeviceListCreate[]
```

**DeviceListCreate schema:**
```json
{
  "id": 78106,
  "eui": "0080E115067D9A14",
  "type": 20,
  "type__name": "KAZMETER Pro LRW",
  "address": 6725,
  "address_name": "ул. Кокбастау, 5",
  "lat": "43.25...",
  "lng": "76.94...",
  "gateway__eui": "A84041FFFF...",
  "meters": [
    {
      "id": 127074,
      "port": 2,
      "serial_number": "TEST001",
      "consumer": "Кириеева И.В",
      "account_id": "7496",
      "last_reading": null
    }
  ],
  "description": null,
  "date_joined": "2024-07-01T10:00:00Z",
  "sent_date": "2026-04-23T12:00:00Z",
  "timezone": 6,
  "sending_period": 60,
  "is_active": true,
  "active": true,
  "additional_data": { "district": 2 },
  "snr": -6.5,
  "rssi": -106,
  "battery_level": null,
  "network_server": 27,
  "gateway": 123,
  "node_service_company": [20]
}
```

### GET /api/v1/device/{id}/

Returns **DeviceDetail** — та же структура, без `type__name` и `gateway__eui`, с полным списком meters.

### GET /api/v1/device/model/

```
Params: search, page, page_size
Response: paginated DeviceModelList[]
```

**DeviceModelList schema:**
```json
{
  "id": 20,
  "name": "KAZMETER Pro LRW",
  "description": null,
  "class_name": "Kazmeter",
  "len_of_eui": 16,
  "num_of_ports": 1,
  "trans_tech_type": null
}
```

### GET /api/v1/device/mode/  ⭐

**Endpoint режимов порта устройства.**

```
Params: device_model (FK filter!), meters__id, search, ordering, page, page_size
Response: paginated DeviceModeList[]
```

**Правильное использование:**
```
GET /api/v1/device/mode/?device_model=20&page_size=50
```

**DeviceModeList schema:**
```json
{
  "id": 22,
  "name": "Счетчик со встроенным модемом",
  "class_name": "KazmeterPulseCounterMode",
  "device_model": 20,
  "additional_data": null
}
```

или с полями:
```json
{
  "id": 33,
  "name": "Счетчик импульсов",
  "class_name": "ExpDeviceGSMPulseCounterMode",
  "device_model": 31,
  "additional_data": {
    "fields": [
      { "name": "port", "type": "integer", "label": "Порт" }
    ]
  }
}
```

`additional_data.fields` описывает **дополнительные поля формы** для этого режима:
- `null` или пусто → поле Порт **НЕ нужно**
- `[{name: "port"}]` → поле Порт **нужно показать**
- `[{name: "min_reading"}, {name: "max_reading"}]` → датчики (MVP: пропустить)

### GET /api/v1/device/mode/{id}/

Одиночный режим.

---

## Meter

### POST /api/v1/meter/  ⭐ ГЛАВНЫЙ ENDPOINT

**Создание акта установки = создание Meter.**

**Required fields:**
```
serial_number  string (max 100)
join_date      string (YYYY-MM-DD)
join_reading   number
device         integer (FK)
```

**Optional но важные:**
```
node              integer (FK on Node)
resource_type     integer (FK on ResourceType)
type              integer (FK on MeterModel) — 224 модели счётчиков
device_mode       integer (FK on DeviceMode) — из /device/mode/?device_model=N
port              integer (0-32767) — только если режим требует
client_sector     enum: legal | private | multi_apartment | physical
installation_place integer (FK) — 111 вариантов
object_type       integer (FK) — 228 вариантов, ОТДЕЛЬНО от installation_place!
consumer          string (max 100)
apartment         string (max 100)
phone             string (max 128) — любой формат, бэк нормализует
account_id        string (max 100)
description       string — default ""
is_active         boolean — default true
additional_data   object — JSONField без схемы
check_date        date — дата поверки
address_code      string (max 100) — код адреса (не используем)
installation      integer — FK on MeterInstallation (null для нашего flow)
```

**READONLY — NOT в payload:**
```
id, node__name, type__name, resource_type__name,
device__eui, device__type__name, street, house,
reading, reading_dt, sent_date, last_reading,
upload_date, upload_status, avatar
```

**НЕ существует в схеме:**
```
device__address  ← убрать из кода, бэк игнорирует
```

**Пример успешного payload:**
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

Response 201: полный объект Meter со всеми readonly полями.

**Errors:**
```
400 { field_name: ["error"] }  — validation error
401 { detail: "..." }          — invalid token
```

### GET /api/v1/meter/

```
Filter params: resource_type, object_type, installation_place, type,
               is_active, client_sector,
               sent_date, sent_date__gte, sent_date__lte,
               sent_date__gt, sent_date__lt, sent_date__isnull,
               search, page, page_size
```

### GET/PUT/PATCH/DELETE /api/v1/meter/{id}/

**MeterDetail** — та же схема + readonly поля.

### PUT/PATCH /api/v1/meter/avatar/{id}/

Загрузка фото (отдельный запрос после создания Meter).
```
Body: { avatar: file }
Response: { avatar: "https://...uri" }
```

### GET/POST /api/v1/meter/model/

Справочник моделей счётчиков (224 записи).

```json
{
  "id": 1,
  "name": "Пульс",
  "description": null,
  "class_name": null,
  "proportionality_factor": 0.01,
  "unit_of_measurement": "м3",
  "lifetime_years": 10,
  "warranty_years": 1
}
```

⚠️ Поле `resource_type` у MeterModel **отсутствует** — модели счётчиков не привязаны к типу ресурса.

---

## Node (адресное дерево)

### GET /api/v1/node/

```
Params: search, ordering, page, page_size
```

**NodeList schema:**
```json
{
  "id": 20,
  "name": "ТОО \"IoT-Exponenta\" Алматы Су",
  "level": 2,
  "parent": 18,
  "parent_name": "ГКП \"Алматы Су\"",
  "type": 17,
  "lft": 1, "rght": 100, "tree_id": 1
}
```

### GET/PUT/PATCH/DELETE /api/v1/node/{id}/

NodeDetail — те же поля + `description`, `phone`, `account_id`, `additional_data`, `class_name`, `supp_companies`.

### GET /api/v1/node/type/

NodeType list (31 тип: Страна, Регион, Город, Дом, Квартира, ServiceCompany, SupplierCompany...).

### GET /api/v1/node/dashboard/active_meters/

Агрегированная статистика (для дашборда главной страницы).

---

## Address

### GET /api/v1/address/{id}/

```json
{
  "id": 6725,
  "name": "г. Алматы, ул. Кокбастау, д. 5",
  "province": "Алматинская область",
  "locality": "Алматы",
  "area": "Бостандыкский район",
  "district": "Алмалинский",
  "street": "ул. Кокбастау",
  "house": "5",
  "lng": 76.94,
  "lat": 43.25,
  "coordinates": "POINT (76.94 43.25)"
}
```

⚠️ `district` здесь — **STRING** ("Алмалинский"). 
`Meter.additional_data.district` — **INTEGER** (2). Это разные поля.

---

## Справочники

### GET /api/v1/resource_type/

```json
{"id": 1, "name": "Холодная вода", "short_name": "ХВС", "class_name": ""}
```

Все 9: ХВС(1), ГВС(2), Газ(3), Электричество(4), Отопление(5), Видеонаблюдение(6), Датчик вскрытия(7), Датчик влажности(8), Датчик давления(10)

### GET /api/v1/installation_place/

```json
{"id": 1, "name": "С/У"}
```

111 записей (С/У, Колодец, Подвал, Лестничная клетка, Индивидуальный тепловой пункт...)

### GET /api/v1/object_type/

```json
{"id": 10, "name": "Серверная"}
```

228 записей (Квартира=1, Коттедж=2, Таунхаус=3, Офис=5, Склад=8, Гараж=9, Серверная=10...)

---

## MeterInstallation (для справки — НЕ используем)

`/api/v1/meter_installation/` — сущность "Монтаж измерителей". Более тяжёлый flow.
Мы создаём Meter **напрямую** через `POST /api/v1/meter/` — это правильно.

---

## Телеметрия (для будущих версий)

### GET /api/v1/data_store/

Обработанные данные.
```
Required params: diff_reading_period (hourly|dayly|monthly)
Filter: meter_id, dt__gte, dt__lte
```

### GET /api/v1/data_store_default/

Сырые пакеты с устройств.
```
Filter: device, meter, gateway, node, dt__date__gte, dt__date__lte...
```

### GET /api/v1/event/

События (потеря связи, разряд батареи, вскрытие).
```
Filter: type, relevant, search, ordering
```

### GET /api/v1/reading_correction/

Ручные корректировки показаний.
```
Filter: dt__gte, dt__lte, meter
```

### GET /api/v1/location/

Оптимизированное представление для карты счётчиков.

---

## Прочее

### GET /api/v1/gateway/{id}/

Шлюз LoRaWAN/NB-IoT.
```json
{"id": 1, "eui": "A84041FFFF123456", "description": "...", "is_active": true, "lat": 43.25, "lng": 76.94}
```

### GET /api/v1/network_server/

Сетевые серверы (LoRaWAN NS, NB-IoT...).
```
Filter: type__trans_tech_type
```

### GET /api/v1/service_company/

Сервисные компании (обслуживающие организации).

### GET /api/v1/supp_company/

Поставщики ресурсов (Алматы Су, Тепловые сети...).

### GET /api/v1/user/

Пользователи системы. `POST` — создание.
```
Filter: search
```

⚠️ Нет `/me` endpoint — после логина сохрани username в localStorage отдельно.

### GET /api/v1/downloads/{task_id}

Статус async-задач (экспорты Excel, PDF отчёты).

### GET+POST /api/v1/meter/{id}/commands/

Команды устройству (вкл/выкл, синхронизация настроек).

---

## Endpoints которых НЕТ (часто ищут по ошибке)

```
/api/v1/port_mode/          → 404 (правильно: /api/v1/device/mode/)
/api/v1/device_mode/        → 404 (правильно: /api/v1/device/mode/)
/api/v1/installation/       → 404 (удалить из endpoints.installation)
/api/v1/logout/             → нет, клиент сам чистит localStorage
/api/v1/me/                 → нет, username сохранять при логине
/api/v1/token/refresh/      → нет, токен бессрочный
/api/v1/                    → 404 (browsable API отключен)
```