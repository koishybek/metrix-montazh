---
name: metrix-context
description: Smart Metrix API knowledge and architectural truth for Metrix Installer Pro. Auto-loads when working with installation acts, meters, devices, nodes, port modes, NewInstallation form, address search, drafts, Yandex Geocoder, sync. Use for anything related to sm.iot-exp.kz integration, payload structure, or known bugs in the codebase.
---

# Metrix Installer Pro — Project Context

## What the app is

PWA for field installers of IoT-Exponenta (Kazakhstan). Installers register newly mounted meters (water/gas/heat/electricity) directly into Smart Metrix admin at `sm.iot-exp.kz`. App is a thin frontend over an existing REST API. **No own backend.**

## Current state (known issues)

The codebase was built earlier by another AI but has **specific bugs** that need targeted fixes. UI renders, axios setup is sound, but these problems exist:

1. **Hot water node hardcoded as 21** in `NewInstallation.tsx:122` — should be **79**
2. **`client_sector: "legal"`** hardcoded in submit payload — should come from a UI radio
3. **`district = 2`** hardcoded — should come from selected device data
4. **`object_type` confused with `installation_place`** — they are 2 different fields with 2 different dictionaries
5. **`device_mode` field missing** from payload — required, blocks valid POST
6. **`device__address` field missing** from payload — should auto-fill from device
7. **`meterModels.ts` static file is stale** — IDs (4, 12, 32, 33, 37) may not match current `/api/v1/meter/model/`
8. **Mojibake in Russian strings** throughout the codebase (`РЎРµСЂРёР№РЅС‹Р№` instead of `Серийный`)
9. **`endpoints.installation = '/api/v1/installation/'` doesn't exist** — should be `/api/v1/meter/`
10. **streets.json keys use Russian** (`Название`, `Код`) which compound the mojibake problem
11. **No port_mode integration** — required dropdown filtered by device, not implemented at all

See `docs/audit/01-known-issues.md` for the full triage.

## API — base info

- **Base URL:** `https://sm.iot-exp.kz`
- **Auth:** `Authorization: Token <40-char-hex>` (Django opaque token, no expiry)
- **Login endpoint:** `POST /api-token-auth/` with body `{username, password}` → returns `{token}`
- **Content-Type:** `application/json`
- **Pagination:** `{count, next, previous, results}` with `?page=N&page_size=M&ordering=...&search=...`
- **Errors:** DRF format — `{detail: "..."}` or `{field_name: ["error msg"]}`

## CORS

`sm.iot-exp.kz` only allows same-origin requests. For dev, use Vite proxy (`/api` → `https://sm.iot-exp.kz/api`). For production:
- Either backend whitelists deploy domain
- Or app served from iot-exp.kz subdomain
- Or Capacitor wrapper (native bypass)

Decision deferred to product owner.

## Data model

In Smart Metrix, "installation act" = creating a `Meter` linked to existing `Device` and `Node`:

- **Node** — hierarchical address tree (Country → Region → City → Building → Apartment → Consumer). MPTT. Installer **does not create**.
- **Device** — IoT gateway with EUI-64. Already exists. Installer searches by EUI substring.
- **Meter** — **creating Meter = the installation act**. POST `/api/v1/meter/`.
- **PortMode** — connection mode of meter to device. Filtered per device model. Determines extra fields (port, etc.).

## ⭐ Real production POST /api/v1/meter/ payload

**This is the source of truth. Captured from working admin form on 2026-04-23.**

```json
{
  "node": 20,
  "is_active": true,
  "type": 1,
  "resource_type": 1,
  "join_date": "2026-04-23",
  "serial_number": "TEST001",
  "join_reading": 0.256,
  "installation_place": 1,
  "consumer": "Кириеева И.В",
  "client_sector": "private",
  "object_type": 10,
  "apartment": "43",
  "account_id": "7496",
  "phone": "+7 (771) 760-07-48",
  "device": 74716,
  "description": "",
  "additional_data": {
    "almaty_su_street_id": "305",
    "district": 2
  },
  "device_mode": 33,
  "device__address": 6831,
  "port": 2
}
```

### Field reference

| Field | Type | Required | Source | Notes |
|-------|------|----------|--------|-------|
| `serial_number` | string ≤100 | ✅ | manual | meter S/N |
| `join_date` | YYYY-MM-DD | ✅ | manual / today | install date |
| `join_reading` | float | ✅ | manual | initial reading |
| `device` | int | ✅ | EUI search → device.id | gateway |
| `node` | int | ✅ | **AUTO from resource_type** | water=20/79, see below |
| `type` | int | ✅ | meter model select | from `/api/v1/meter/model/` |
| `resource_type` | int | ✅ | radio (cold/hot) | from `/api/v1/resource_type/` |
| `installation_place` | int | ✅ | select | from `/api/v1/installation_place/` |
| `object_type` | int | ✅ | select (separate field!) | from `/api/v1/object_type/` |
| `client_sector` | enum | ✅ | radio | `private`/`legal`/`multi_apartment`/`physical` |
| `device_mode` | int | ✅ | filtered select | PortMode.id, **filtered by device.type** |
| `port` | int 1-10 | conditional | auto/manual | required when port_mode requires it |
| `device__address` | int | optional | **AUTO from device** | Address.id taken from device.address |
| `is_active` | bool | optional | always true | default true |
| `description` | string | optional | manual | default `""` |
| `consumer` | string | optional | manual | name |
| `apartment` | string | optional | manual | apt |
| `account_id` | string | optional | manual | personal account |
| `phone` | string | optional | manual | any format, backend normalizes |
| `additional_data.almaty_su_street_id` | string | conditional | manual | **ONLY for ХВС** (resource_type=1), the street code |
| `additional_data.district` | int | optional | **AUTO from device** | district number |

### Readonly fields (DO NOT send)

These come back from server in response, never include in POST:
`id`, `reading`, `reading_dt`, `sent_date`, `last_reading`, `upload_date`, `upload_status`, `avatar`, `address_code`, `check_date`, `installation`

## ⭐ Auto-node mapping (CRITICAL business logic)

```ts
const AUTO_NODE_BY_RESOURCE: Record<number, number> = {
  1: 20,   // Холодная вода (ХВС) → ТОО "IoT-Exponenta" Алматы Су
  2: 79,   // Горячая вода (ГВС) → ТОО «Алматинские тепловые сети»
  // 3 (Газ), 4 (Электричество), 5 (Отопление) — not auto, future enhancement
};

const NODE_LABELS: Record<number, string> = {
  20: 'ГКП "Алматы Су" → ТОО "IoT-Exponenta" Алматы Су',
  79: 'ТОО «Алматинские тепловые сети»',
};
```

**Bug to fix:** current code has `setNode(21)` for hot water — that's wrong, should be 79.

## ⭐ Port Mode endpoint

**Endpoint found:** `GET /api/v1/port_mode/?page_size=100` returns 36 modes.

**NOT** `/api/v1/device_mode/` (that's 404).

### Response shape

```json
{
  "count": 36,
  "results": [
    {
      "id": 33,
      "name": "Счетчик импульсов",
      "class_name": "ExpDeviceGSMPulseCounterMode",
      "additional_data": {
        "fields": [
          {"name": "port", "type": "integer", "label": "Порт"}
        ]
      },
      "device_model": 31
    }
  ]
}
```

### Critical filtering logic

Each `port_mode` has `device_model` FK. When user selects a device, **only show modes matching device.type**:

```ts
const availableModes = allModes.filter(m => m.device_model === selectedDevice?.type);
```

- 0 results → "Для этого устройства нет доступных режимов"
- 1 result → auto-select, show as readonly
- multiple → dropdown

### Conditional `port` field

`port_mode.additional_data.fields` describes extra fields:
- `null` or missing → no extra fields, `port` is NOT needed in payload
- `[{name: "port", type: "integer"}]` → show Port number input (1-10)
- `[{name: "min_reading"}, {name: "max_reading"}]` → sensor mode, log+skip for MVP

```tsx
const selectedMode = portModes.find(m => m.id === watch('device_mode'));
const needsPort = selectedMode?.additional_data?.fields?.some(f => f.name === 'port') ?? false;

{needsPort && <PortInput />}
```

## Dictionaries (cache 24h in localStorage or in-memory)

| Endpoint | Count | What for |
|----------|-------|----------|
| `/api/v1/resource_type/` | 9+ | ХВС, ГВС, Газ, Электричество, Отопление |
| `/api/v1/meter/model/` | 32 | Pulse, Betar, Zenner, etc. |
| `/api/v1/installation_place/` | 111 | С/У, Колодец, Подвал, etc. |
| `/api/v1/object_type/` | 228 | Квартира, Коттедж, Офис, etc. |
| `/api/v1/port_mode/` | 36 | Port modes (filter by device_model) |
| `/api/v1/node/type/` | 31 | Node hierarchy types (informational) |

**Important:** the static `assets/meterModels.ts` file is STALE. Replace usage with API calls to `/api/v1/meter/model/` and cache, OR update the static file to match (worse, will go stale again).

## Phone format

Frontend accepts `+7 (771) 760-07-48` style input.
Backend normalizes to `+77717600748`.
Sending either format is OK — backend handles both. **Don't over-engineer normalization.**

## Mojibake fix

Many Russian strings in `*.tsx` and `streets.json` are corrupted UTF-8 (saved as Windows-1251 / Latin-1, then re-read as UTF-8). They look like `РЎРµСЂРёР№РЅС‹Р№` instead of `Серийный`.

Fix strategy:
- Replace strings file-by-file with proper Cyrillic
- For `streets.json` (which uses Russian as KEY NAMES) — keys `Название`/`Код` are inconvenient. Consider migrating to English keys (`name`, `code`) but that requires updating every consumer of streets data. For MVP, keep keys but ensure file saved as UTF-8 BOM.
- After each file, verify in browser the rendered text is Cyrillic, not garbage.

## Product decisions (LOCKED)

- **No photos in POST payload.** Photo capture UI may stay as installer's offline memo / future enhancement. NOT included in `/api/v1/meter/` body.
- **Auth screen stays.** Don't remove login. Don't replace with env token.
- **Single-page form**, no wizard.
- **Auto-node for water resources** (resource_type=1 → 20, resource_type=2 → 79).
- **Drafts via localStorage** stay.
- **QR scanner stays.**
- **Yandex Geocoder stays** (with mojibake fix).

## Open questions (in `docs/questions-for-backend.md`)

1. Confirm `device_mode` field name — should be `device_mode` or `port_mode_id`?
2. `additional_data.district` — does backend expect integer or string?
3. CORS whitelist for our deploy domain?
4. Backend recovery: if POST `/api/v1/meter/` succeeds but UI dies before reading response — is there idempotency on serial_number+device combo?
5. Phone format: bare digits `+77001234567` vs masked `+7 (700) 123-45-67` — does backend prefer one?

## Repo layout (current)

```
metrix-installer/
├── src/
│   ├── api/
│   │   └── index.ts              # axios + endpoints
│   ├── assets/
│   │   ├── meterModels.ts        # STALE static — replace with API
│   │   └── streets.json          # Almaty Su streets (mojibake keys)
│   ├── components/
│   │   ├── Layout.tsx
│   │   └── ProtectedRoute.tsx
│   ├── context/
│   │   └── AuthContext.tsx       # token persistence
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── NewInstallation.tsx   # ⭐ THE form, has all bugs
│   │   ├── History.tsx           # drafts + history list
│   │   └── Profile.tsx (?)
│   ├── types/
│   │   └── index.ts              # InstallationData interface
│   ├── App.tsx                   # routing
│   ├── main.tsx
│   └── index.css
├── package.json
└── vite.config.ts
```
