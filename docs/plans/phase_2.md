# Implementation Plan - Phase 2 (Etap B/C/D)

## Objectives
Execute fixes for issues identified in Phase 1 audit and refactor for mobile-first experience.

## Groups of Changes
1. **Group 1: Mojibake Fix**
   - Fix Cyrillic encoding in `Login.tsx`, `NewInstallation.tsx`, `History.tsx`, `Layout.tsx`.
2. **Group 2: Payload Fixes**
   - Implement dynamic node mapping (GVS -> 79).
   - Add `client_sector` UI and payload logic.
   - Extract `district` from device data.
   - Separate `object_type` and `installation_place`.
3. **Group 3: Port Mode Integration**
   - Fetch and cache `port_mode` and `meter_model` data (24h TTL).
   - Implement conditional `Port` field based on selected mode.
4. **Group 4: Mobile-First Layout**
   - Implement bottom navigation for screens < 768px.
   - Refactor `Sidebar.tsx` for responsive behavior.
5. **Group 5: Cleanup**
   - Remove dead API endpoints.
   - Replace static constants with API calls.

## Constraints
- No new npm packages.
- Preserve `AuthContext` logic.
- Conventional commits.
- Pass `npm run build` (typechecks).
