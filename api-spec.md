# Техническая спецификация API Smart Metrix для PWA "АктМонтаж"

Собрано из Swagger (OpenAPI 2.0) + живых сетевых запросов + реальных ответов API.
Источник истины для всех решений по интеграции с `sm.iot-exp.kz`.

---

## 1. Base Info

**Base URL:** `https://sm.iot-exp.kz/`
**API prefix:** `/api/v1/`
**Auth type:** Token (API Key в заголовке)
**Token format:** Opaque hex-строка 40 символов (не JWT). Пример: `fc186709d0cf8bfa4bf5d8567c2456c3178abb51`
**Хранение токена:** `localStorage.token` (под ключом `aktmontazh:token` в нашем приложении)

**Обязательные заголовки в каждом запросе:**
```
Authorization: Token <token>
Content-Type: application/json
```

**CORS:**
- `access-control-allow-origin: https://sm.iot-exp.kz` — разрешён **только same-origin**
- `access-control-allow-methods: DELETE, GET, OPTIONS, PATCH, POST, PUT`
- `access-control-allow-headers: accept, authorization, content-type, user-agent, x-csrftoken, x-requested-with`
- `access-control-max-age: 86400`
- ⚠️ **КРИТИЧНО:** CORS закрыт для внешних origin. PWA с другого домена не сможет обращаться напрямую — нужен прокси или приложение должно работать на `sm.iot-exp.kz`, либо бэкенд должен добавить наш домен в allowed origins.
- Rate limit заголовков нет (X-RateLimit-* отсутствуют).

**Формат пагинации (все list endpoints):**
```json
{
  "count": 121570,
  "next": "https://sm.iot-exp.kz/api/v1/device/?page=2",
  "previous": null,
  "results": [...]
}
```
Query params: `?page=1&page_size=10&ordering=-id&search=...`

**Формат ошибок DRF:**
```json
// 400 Bad Request — ошибки валидации по полям
{
  "field_name": ["Error message"],
  "another_field": ["Another error"]
}

// 401 Unauthorized
{ "detail": "Invalid token." }

// 404 Not Found
{ "detail": "Not found." }
```

---

## 2. Auth Endpoints

### `POST /api-token-auth/`
**Описание:** Получение токена. Обновляет `last_login`.
**Auth:** Не требуется.
**Request body:**
```json
{
  "username": "string (required, minLength: 1)",
  "password": "string (required, minLength: 1)"
}
```
**Response 201:**
```json
{
  "username": "...",
  "password": "...",
  "token": "fc186709d0cf8bfa4bf5d8567c2456c3178abb51"
}
```
**Logout:** В Swagger не найдено — нет отдельного logout endpoint. Просто очищаем localStorage клиентски.
**Refresh token:** В Swagger не найдено — токен не истекает (opaque, не JWT).
**GET /me (профиль):** Отдельного `/me` нет — используйте `/api/v1/user/` (см. Users).

---

## 3. Node Endpoints (адресная иерархия)

> В системе **node** — это иерархический справочник объектов (страна → область → город → дом → квартира → потребитель). Сам "акт установки счётчика" — это **Meter** + **MeterInstallation**, а не отдельный Node. Node — это адресная привязка (к кому/куда установлен счётчик).

### `GET /api/v1/node/`
Список узлов с пагинацией.
**Query params:** `ordering`, `search`, `page`, `page_size`
**Response 200:** `{count, next, previous, results: NodeList[]}`

### `POST /api/v1/node/`
Создать узел.
**Auth:** Token required.
**Body:** `NodeCreate` (см. структуру ниже)
**Response 201:** `NodeCreate`

### `GET /api/v1/node/{id}/`
Получить узел по id.
**Response 200:** `NodeDetail`

### `PUT /api/v1/node/{id}/`
Полное обновление узла.

### `PATCH /api/v1/node/{id}/`
Частичное обновление узла.

### `DELETE /api/v1/node/{id}/`
Удалить узел.

### `GET /api/v1/node/type/`
Список типов узлов (справочник).

### `GET /api/v1/node/type/{id}/`
Тип узла по id.

**Структура NodeCreate (тело POST /api/v1/node/):**
```json
{
  "name":            "string, REQUIRED, maxLength:100",
  "phone":           "string|null, maxLength:128",
  "account_id":      "string|null, maxLength:100 — лицевой счёт/№ договора",
  "description":     "string|null",
  "class_name":      "string|null, maxLength:100 — ООП класс",
  "additional_data": "object|null — произвольные доп. данные",
  "type":            "integer|null — id из /api/v1/node/type/",
  "parent":          "integer|null — id родительского node",
  "supp_companies":  "array of integer — id поставщиков"
}
```
*Readonly поля (не отправлять):* `id`, `lft`, `rght`, `tree_id`, `level`

**Структура NodeDetail (ответ GET /api/v1/node/{id}/):**
Все поля NodeCreate плюс:
```json
{
  "parent_name":       "string (readonly)",
  "additional_fields": "string (readonly)"
}
```

**Структура NodeList (ответ списка):**
```json
{
  "id":           "integer",
  "parent_name":  "string (readonly)",
  "name":         "string",
  "phone":        "string|null",
  "account_id":   "string|null",
  "description":  "string|null",
  "class_name":   "string|null",
  "additional_data": "object|null",
  "lft":          "integer",
  "rght":         "integer",
  "tree_id":      "integer",
  "level":        "integer",
  "type":         "integer|null",
  "parent":       "integer|null",
  "supp_companies": "array"
}
```

---

## 4. Upload / Files

### `PUT /api/v1/meter/avatar/{id}/`
### `PATCH /api/v1/meter/avatar/{id}/`
**Описание:** Загрузка/обновление фото счётчика (avatar).
**Path param:** `id` — integer, id счётчика (meter).
**Body definition (MeterAvatarUpdate):**
```json
{
  "avatar": "string (readonly, format: uri)"
}
```

⚠️ **Внимание:** Swagger описывает `avatar` как readOnly URI. Это значит, что загрузка скорее всего идёт через **multipart/form-data**, а не через JSON body — поле `avatar` в ответе возвращает ссылку. Реальный формат загрузки через multipart нужно уточнить у бэкенда.

**Как передаётся фото (вывод по имеющимся данным):**
- В ответе `MeterDetail` поле `avatar` имеет тип `string, format: uri, readOnly` — значит фото хранится как URL
- PUT/PATCH endpoint принимает данные для обновления
- **Предположение:** multipart/form-data с полем `avatar` (file). Нужно подтверждение.

---

## 5. Dictionaries

### `GET /api/v1/node/type/` — Типы узлов (иерархия адресов)
```
GET /api/v1/node/type/?page_size=50
Authorization: Token <token>
```
**Полный список (31 запись):**
```json
[
  {"id":2,"name":"Страна"},
  {"id":3,"name":"Область"},
  {"id":4,"name":"Областной район"},
  {"id":5,"name":"Город"},
  {"id":6,"name":"Городской район"},
  {"id":7,"name":"Микрорайон"},
  {"id":8,"name":"Улица"},
  {"id":9,"name":"Жилой комплекс"},
  {"id":10,"name":"Многоквартирный дом"},
  {"id":11,"name":"Частный дом"},
  {"id":12,"name":"Этаж"},
  {"id":13,"name":"Подъезд"},
  {"id":14,"name":"Квартира"},
  {"id":15,"name":"Потребитель"},
  {"id":16,"name":"Поставщик энергоресурсов"},
  {"id":17,"name":"Сервисная компания"},
  {"id":18,"name":"Люки"},
  {"id":19,"name":"Уличное освещение"},
  {"id":20,"name":"Датчики влажности"},
  {"id":21,"name":"Сектор"},
  {"id":22,"name":"По умолчании"},
  {"id":30,"name":"Блок"},
  {"id":33,"name":"подрядчик"},
  {"id":36,"name":"Поселок"},
  {"id":37,"name":"сельски округ"},
  {"id":38,"name":"Город"},
  {"id":39,"name":"Организация"},
  {"id":40,"name":"Микрорайон"},
  {"id":44,"name":"Строительная компания"},
  {"id":45,"name":"Әділ-1"},
  {"id":46,"name":"CEM"}
]
```

### `GET /api/v1/resource_type/` — Типы ресурсов (единицы измерения/вид ресурса)
```json
[
  {"id":1,"name":"Холодная вода","short_name":"ХВС","class_name":null},
  {"id":2,"name":"Горячая вода","short_name":"ГВС","class_name":null},
  {"id":3,"name":"Газ","short_name":"ГС","class_name":null},
  {"id":4,"name":"Электричество","short_name":"ЭС","class_name":null},
  {"id":5,"name":"Отопление","short_name":"ТС","class_name":null},
  {"id":6,"name":"Видеонаблюдение","short_name":"Видеонаблюдение","class_name":"VideoCam"},
  {"id":7,"name":"Датчик вскрытия","short_name":"Датчик вскрытия","class_name":"TemperSensor"},
  {"id":8,"name":"Датчик влажности","short_name":"Датчик влажности","class_name":"..."}
]
```

### `GET /api/v1/object_type/` — Типы объектов (228 записей)
Первые 10:
```json
[
  {"id":1,"name":"Квартира"},
  {"id":2,"name":"Коттедж"},
  {"id":3,"name":"Таун-Хаус"},
  {"id":4,"name":"Участок"},
  {"id":5,"name":"Офис"},
  {"id":6,"name":"Помещение"},
  {"id":7,"name":"Комната"},
  {"id":8,"name":"Склад"},
  {"id":9,"name":"Гараж"},
  {"id":10,"name":"Серверная"}
]
```

### `GET /api/v1/installation_place/` — Место установки (111 записей)
Первые 10:
```json
[
  {"id":1,"name":"С/У"},
  {"id":2,"name":"Колодец"},
  {"id":3,"name":"Крыша"},
  {"id":4,"name":"Подъезд"},
  {"id":5,"name":"Мачта"},
  {"id":6,"name":"Скважина"},
  {"id":7,"name":"Подвал"},
  {"id":8,"name":"Стойка"},
  {"id":9,"name":"Столб"},
  {"id":10,"name":"Почва"}
]
```

### `GET /api/v1/meter/model/` — Модели счётчиков (32 записи)
```json
[
  {"id":1,"name":"Пульс"},
  {"id":2,"name":"Бетар-Вега СХВЭ/СГВЭ"},
  {"id":3,"name":"Eco-meter"},
  {"id":4,"name":"PULSAR"},
  {"id":5,"name":"Эконом"},
  {"id":7,"name":"CASCAD"},
  {"id":8,"name":"ВВТ100"},
  {"id":12,"name":"Zenner"},
  {"id":14,"name":"ВВТ150"},
  {"id":15,"name":"Декаст"},
  {"id":17,"name":"Датчик влажности (Honde Technology Co.)"},
  {"id":18,"name":"OPTIMA"},
  {"id":19,"name":"Drop"},
  {"id":23,"name":"Бетар СХВЭ/СГВЭ (Карат)"},
  {"id":24,"name":"Zenner MNK-RP-N"},
  {"id":25,"name":"Zenner 10 л/имп"},
  {"id":26,"name":"SmartLighting NB-IoT"},
  {"id":28,"name":"ВВТ-50 10л/имп"},
  {"id":29,"name":"10 л/имп"},
  {"id":30,"name":"ВСХН"},
  {"id":31,"name":"Belka Meter"},
  {"id":32,"name":"Eco-Meter"}
]
```

### `GET /api/v1/device/model/` — Модели устройств (IoT-шлюзов)
```json
[
  {"id":24,"name":"Пульсар модель 1","class_name":"PulsarM1","num_of_ports":1},
  {"id":20,"name":"KAZMETER Pro LRW","class_name":"Kazmeter","num_of_ports":1},
  {"id":18,"name":"ExpDevice LRW","class_name":"Terminal_M_LRW","num_of_ports":10},
  {"id":31,"name":"ExpDevice GSM","class_name":"ExpDeviceGSM","num_of_ports":10},
  {"id":4,"name":"Вега СИ-11","class_name":"VegaSi11","num_of_ports":4}
]
```

### `GET /api/v1/event_type/` — Типы событий
### `GET /api/v1/reading_correction/` — Корректировки показаний

**ResourceType definition:**
```json
{
  "id": "integer",
  "name": "string, required, maxLength:100",
  "short_name": "string|null, maxLength:100",
  "class_name": "string|null"
}
```

---

## 6. Meter (Счётчик) + MeterInstallation — Главные для акта

> **В этой системе "акт установки" = создание объекта `Meter` (счётчик, привязанный к Device + Node).**
> `MeterInstallation` — это отдельная структура, описывающая физическую установку устройства.

### `GET /api/v1/meter/` — Список счётчиков
**Query filters:**
- `sent_date__gte`, `sent_date__lte`, `sent_date__gt`, `sent_date__lt`, `sent_date__isnull`
- `resource_type`, `object_type`, `installation_place`, `type` (integer id)
- `search`, `page`, `page_size`, `ordering`

### `POST /api/v1/meter/` — Создать счётчик (акт установки) ⭐ ГЛАВНЫЙ ENDPOINT
**Структура MeterListCreate (body):**

| Поле | Тип | Обяз | Описание |
|------|-----|------|----------|
| `serial_number` | string, maxLength:100 | ✅ | Серийный номер счётчика |
| `join_date` | string, format:date | ✅ | Дата подключения (YYYY-MM-DD) |
| `join_reading` | number | ✅ | Показание при подключении |
| `device` | integer | ✅ | id IoT-устройства (device) |
| `description` | string\|null | ❌ | Описание |
| `port` | integer\|null, 0–32767 | ❌ | Порт устройства |
| `check_date` | string\|null, format:date | ❌ | Дата поверки |
| `is_active` | boolean | ❌ | Вкл/Выкл (default: true) |
| `client_sector` | enum\|null | ❌ | `"legal"`,`"private"`,`"multi_apartment"`,`"physical"` |
| `avatar` | file\|null | ❌ | Фото счётчика |
| `address_code` | string\|null, maxLength:100 | ❌ | Код адреса |
| `additional_data` | object\|null | ❌ | Доп. данные |
| `consumer` | string\|null, maxLength:100 | ❌ | Потребитель |
| `apartment` | string\|null, maxLength:100 | ❌ | Квартира |
| `phone` | string\|null, maxLength:128 | ❌ | Тел. номер |
| `account_id` | string\|null, maxLength:100 | ❌ | Лицевой счёт |
| `type` | integer\|null | ❌ | Тип счётчика (id из meter/model?) |
| `object_type` | integer\|null | ❌ | id из /api/v1/object_type/ |
| `installation_place` | integer\|null | ❌ | id из /api/v1/installation_place/ |
| `resource_type` | integer\|null | ❌ | id из /api/v1/resource_type/ |
| `node` | integer\|null | ❌ | id из /api/v1/node/ |
| `installation` | integer\|null | ❌ | id MeterInstallation |

**Readonly поля (в ответе, не отправлять):** `id`, `node__name`, `type__name`, `resource_type__name`, `device__eui`, `device__type__name`, `street`, `house`, `reading`, `reading_dt`

### `GET /api/v1/meter/{id}/` — Получить счётчик
**MeterDetail** — те же поля + `device__address` (required), `device_model`, `device_mode__name`, `object_type__name`, `installation_place__name`

### `PUT /api/v1/meter/{id}/` — Обновить счётчик (полный)
### `PATCH /api/v1/meter/{id}/` — Частичное обновление
### `DELETE /api/v1/meter/{id}/` — Удалить
### `GET /api/v1/meter/{id}/commands/` — Команды для счётчика
### `PUT /api/v1/meter/avatar/{id}/` — Загрузить фото

---

### MeterInstallation — Физическая установка устройства

### `GET /api/v1/meter_installation/`
**Query filters:** `meters__isnull`, `device__node_service_company`, `resource_type`, `type`

### `POST /api/v1/meter_installation/`
**MeterInstallationListCreate body:**

| Поле | Тип | Обяз | Описание |
|------|-----|------|----------|
| `serial_number` | string, maxLength:100 | ✅ | Серийный номер |
| `join_reading` | number | ✅ | Начальное показание |
| `device` | integer | ✅ | id IoT-устройства |
| `port` | integer\|null, 0–32767 | ❌ | Порт |
| `consumer` | string\|null, maxLength:100 | ❌ | Потребитель |
| `apartment` | string\|null, maxLength:100 | ❌ | Квартира |
| `phone` | string\|null, maxLength:128 | ❌ | Тел. номер |
| `description` | string\|null | ❌ | Описание |
| `additional_data` | object\|null | ❌ | Доп. данные |

---

### Device (IoT-устройство) — нужен для создания Meter

### `GET /api/v1/device/` — Список устройств
**Реальный ответ:**
```json
{
  "id": 38967,
  "eui": "0054766853343EB8",
  "address_name": "Астана, ул. Ш.Калдаякова, 25A",
  "lat": 51.11383797506794,
  "lng": 71.49296694445793,
  "gateway__eui": "AC1F09FFFE14258D",
  "type__name": "Пульсар модель 1",
  "meters": [{"id":56193,"port":1,"serial_number":"24_12720117","consumer":"...","last_reading":51.687}],
  "description": "2024-09-03, s/n: 12720117",
  "sent_date": "2026-04-22T18:34:46.381456+05:00",
  "is_active": true,
  "type": 24,
  "network_server": 27,
  "address": 5079,
  "snr": -6.5,
  "rssi": -106
}
```

**Поиск по EUI (для монтажника):**
```
GET /api/v1/device/?search={eui}&page_size=5
```

---

## 7. Остальные группы

### Address — Адреса
- `GET /api/v1/address/` — список
- `POST /api/v1/address/` — создать
- `GET/PUT/PATCH /api/v1/address/{id}/`

**AddressCreate fields:**
```json
{
  "province": "string|null, maxLength:100 — Регион",
  "locality": "string|null, maxLength:100 — Город",
  "area": "string|null, maxLength:100 — Областной район",
  "district": "string|null, maxLength:100 — Городской район",
  "street": "string|null, maxLength:100",
  "house": "string|null, maxLength:100",
  "lng": "number|null — Долгота",
  "lat": "number|null — Широта",
  "node": "integer|null — привязка к Node"
}
```
**Координаты:** два отдельных числа `lat` + `lng` (не GeoJSON, не объект).

### Gateway — Шлюзы
- `GET /api/v1/gateway/` — список шлюзов
- `GET/PUT/PATCH /api/v1/gateway/{id}/`

**Реальный пример gateway:**
```json
{
  "id": 896,
  "eui": "AC1F09FFFE2651D1",
  "sent_date": "2026-04-22T16:47:14.640000+05:00",
  "description": "+7759903102, KCELL, дефолтный пароль",
  "is_active": true,
  "lng": 0,
  "lat": 0,
  "additional_data": null,
  "network_server": 27
}
```

### Location — Оптимизированный список местоположений
- `GET /api/v1/location/` — для отображения счётчиков на карте

### Data Store — Телеметрия/показания
- `GET /api/v1/data_store/` — список записей телеметрии
- `GET /api/v1/data_store/{id}/`

**DataStoreDetail fields:**
```json
{
  "gateway_eui": "string (readonly)",
  "gateway__description": "string (readonly)",
  "dt": "string, format:date-time — Дата",
  "data": "object — Данные",
  "type_of_data": "string|null, maxLength:50",
  "snr": "number|null",
  "rssi": "number|null",
  "battery_level": "number|null",
  "device": "integer|null",
  "meter": "integer|null",
  "node": "integer|null",
  "gateway": "integer|null"
}
```

### Downloads — Асинхронные задачи
- `GET /api/v1/downloads/{task_id}` — статус задачи (экспорт и т.д.)

### Events — События
- `GET /api/v1/event/`
- `GET /api/v1/event_type/`

### Network Servers
- `GET /api/v1/network_server/`
- `GET /api/v1/network_server/{id}/`

### Service Companies / Suppliers
- `GET /api/v1/service_company/` (через node, поле supp_companies)

**ServiceCompanyListCreate:**
```json
{
  "name": "string, required, maxLength:100",
  "phone": "string|null",
  "account_id": "string|null",
  "description": "string|null",
  "class_name": "string|null",
  "additional_data": "object|null",
  "type": "integer|null",
  "parent": "integer|null"
}
```

### Users
- `GET /api/v1/user/` — список пользователей
- `GET /api/v1/user/{id}/`

**UserProfile:**
```json
{
  "id": "integer",
  "username": "string",
  "email": "string",
  "first_name": "string",
  "last_name": "string"
}
```

### Reading Correction
- `GET /api/v1/reading_correction/` — корректировки показаний
- `POST /api/v1/reading_correction/`
- `GET/PUT/PATCH /api/v1/reading_correction/{id}/`

**ReadingCorrectionListCreate fields:**
```json
{
  "serial_number": "string, required",
  "join_reading": "number, required",
  "device": "integer, required",
  "port": "integer|null",
  "consumer": "string|null",
  "apartment": "string|null",
  "phone": "string|null",
  "description": "string|null",
  "additional_data": "object|null"
}
```

---

## 8. Real Request Examples

### Авторизация:
```bash
curl -X POST https://sm.iot-exp.kz/api-token-auth/ \
  -H "Content-Type: application/json" \
  -d '{"username": "montazher1", "password": "secret"}'
# Response 201: {"username":"...","password":"...","token":"abc123..."}
```

### Получение списка устройств (как делает фронт):
```bash
curl -X GET "https://sm.iot-exp.kz/api/v1/device/?ordering=-sent_date&page=1&page_size=10" \
  -H "Authorization: Token fc186709d0cf8bfa4bf5d8567c2456c3178abb51"
```

### Получение списка узлов:
```bash
curl -X GET "https://sm.iot-exp.kz/api/v1/node/?page=1&page_size=10" \
  -H "Authorization: Token fc186709d0cf8bfa4bf5d8567c2456c3178abb51"
```

### Создание узла (Node):
```bash
curl -X POST https://sm.iot-exp.kz/api/v1/node/ \
  -H "Authorization: Token fc186709d0cf8bfa4bf5d8567c2456c3178abb51" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "кв. 42",
    "type": 14,
    "parent": 12345,
    "account_id": "12345678",
    "phone": "+77001234567",
    "description": "ЖК Домбыра, подъезд 3"
  }'
```

### Создание счётчика (Meter — акт установки):
```bash
curl -X POST https://sm.iot-exp.kz/api/v1/meter/ \
  -H "Authorization: Token fc186709d0cf8bfa4bf5d8567c2456c3178abb51" \
  -H "Content-Type: application/json" \
  -d '{
    "serial_number": "24_12720117",
    "join_date": "2026-04-22",
    "join_reading": 0.000,
    "device": 38967,
    "port": 1,
    "resource_type": 1,
    "object_type": 1,
    "installation_place": 1,
    "node": 99999,
    "consumer": "Иванов Иван",
    "apartment": "42",
    "phone": "+77001234567",
    "account_id": "12345678",
    "is_active": true,
    "client_sector": "private"
  }'
```

### Реальный запрос фронта (из DevTools):
```
GET https://sm.iot-exp.kz/api/v1/device/?ordering=-sent_date&page=1&page_size=10
GET https://sm.iot-exp.kz/api/v1/gateway/?ordering=-id&page=1&page_size=1
```
Оба запроса идут без явного Authorization заголовка в network tab — значит токен был установлен ещё при загрузке и браузер кэширует его из localStorage, React Admin проставляет в каждый запрос автоматически.

---

## 9. TypeScript Types (draft)

```typescript
// ========== AUTH ==========
interface LoginRequest {
  username: string;
  password: string;
}
interface LoginResponse {
  username: string;
  password: string;
  token: string; // opaque hex, 40 chars
}

// ========== NODE ==========
interface Node {
  id?: number;                    // readonly
  parent_name?: string;           // readonly
  additional_fields?: string;     // readonly (NodeDetail only)
  name: string;                   // REQUIRED, maxLength: 100
  phone?: string | null;          // maxLength: 128
  account_id?: string | null;     // maxLength: 100
  description?: string | null;
  class_name?: string | null;     // maxLength: 100
  additional_data?: Record<string, unknown> | null;
  lft?: number;                   // readonly (MPTT tree)
  rght?: number;                  // readonly
  tree_id?: number;               // readonly
  level?: number;                 // readonly
  type?: number | null;           // FK → NodeType.id
  parent?: number | null;         // FK → Node.id
  supp_companies?: number[];      // FK array → ServiceCompany
}

interface NodeType {
  id: number;
  name: string;
}

// ========== METER (акт установки) ==========
enum ClientSector {
  Legal = "legal",
  Private = "private",
  MultiApartment = "multi_apartment",
  Physical = "physical"
}

interface Meter {
  id?: number;
  // readonly computed fields:
  node__name?: string;
  type__name?: string;
  resource_type__name?: string;
  device__eui?: string;
  device__type__name?: string;
  street?: string;
  house?: string;
  reading?: string;
  reading_dt?: string;
  avatar?: string | null;
  // writable fields:
  serial_number: string;          // REQUIRED, maxLength: 100
  join_date: string;              // REQUIRED, format: "YYYY-MM-DD"
  join_reading: number;           // REQUIRED
  device: number;                 // REQUIRED, FK → Device.id
  description?: string | null;
  port?: number | null;
  check_date?: string | null;
  is_active?: boolean;
  client_sector?: ClientSector | null;
  address_code?: string | null;
  additional_data?: Record<string, unknown> | null;
  consumer?: string | null;
  apartment?: string | null;
  phone?: string | null;
  account_id?: string | null;
  type?: number | null;
  object_type?: number | null;
  installation_place?: number | null;
  resource_type?: number | null;
  node?: number | null;
  installation?: number | null;
}

// ========== METER INSTALLATION ==========
interface MeterInstallation {
  id?: number;
  device__eui?: string;
  type__name?: string;
  meter_exist?: string;
  meters__isnull?: string;
  serial_number: string;
  join_reading: number;
  device: number;
  port?: number | null;
  consumer?: string | null;
  apartment?: string | null;
  phone?: string | null;
  description?: string | null;
  additional_data?: Record<string, unknown> | null;
}

// ========== DEVICE (IoT-устройство) ==========
interface Device {
  id: number;
  eui: string;
  address_name?: string;
  lat?: number | null;
  lng?: number | null;
  gateway__eui?: string;
  type__name?: string;
  meters?: MeterShort[];
  description?: string;
  sent_date?: string | null;
  is_active: boolean;
  additional_data?: Record<string, unknown> | null;
  snr?: number | null;
  rssi?: number | null;
  battery_level?: number | null;
  type?: number | null;
  network_server?: number | null;
  address?: number | null;
  gateway?: number | null;
}

interface MeterShort {
  id: number;
  port: number;
  serial_number: string;
  consumer?: string;
  account_id?: string | null;
  last_reading?: number;
}

// ========== ADDRESS ==========
interface Address {
  id?: number;
  name?: string;
  province?: string | null;
  locality?: string | null;
  area?: string | null;
  district?: string | null;
  street?: string | null;
  house?: string | null;
  lng?: number | null;
  lat?: number | null;
  node?: number | null;
}

// ========== DICTIONARIES ==========
interface ResourceType {
  id: number;
  name: string;
  short_name?: string | null;
  class_name?: string | null;
}

interface ObjectType {
  id: number;
  name: string;
}

interface InstallationPlace {
  id: number;
  name: string;
}

interface MeterModel {
  id: number;
  name: string;
  class_name?: string | null;
}

interface DeviceModel {
  id: number;
  name: string;
  class_name?: string | null;
  num_of_ports?: number;
  trans_tech_type?: number;
}

// ========== PAGINATION ==========
interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ========== UPLOAD ==========
interface UploadResponse {
  avatar: string;
}

// ========== DATA STORE (показания) ==========
interface DataStore {
  id: number;
  gateway_eui?: string;
  gateway__description?: string;
  dt: string;
  data: Record<string, unknown>;
  type_of_data?: string | null;
  snr?: number | null;
  rssi?: number | null;
  battery_level?: number | null;
  device?: number | null;
  meter?: number | null;
  node?: number | null;
  gateway?: number | null;
}
```

---

## 10. Ключевой поток создания акта (для агента)

```
1. Монтажник вводит EUI устройства (или сканирует QR опционально)
   → GET /api/v1/device/?search={eui} → находит Device.id и address_name
   → Если не нашёл — статус "Устройство не найдено в системе"

2. Опционально: создать или выбрать Node (адрес установки)
   → GET /api/v1/node/?search=... или POST /api/v1/node/
   → Получаем Node.id

3. Заполняет форму Meter:
   serial_number, join_date, join_reading, device (id),
   resource_type, object_type, installation_place,
   client_sector, consumer, apartment, account_id, phone, port

4. POST /api/v1/meter/ → получаем Meter.id (это и есть успешное создание акта)

5. Если есть фото счётчика:
   PUT /api/v1/meter/avatar/{id}/ с multipart/form-data {avatar: <file>}
   → Если упало — Meter всё равно создан, фото можно перезалить позже

6. Локальный статус акта меняется на "Отправлен"
```
