export interface User {
  username: string;
  role?: string; // from POST /api-token-auth/ response, e.g. "admin"
}

export interface MeterModel {
  id: number;
  name: string;
  manufacturer?: string;
}

export interface Street {
  Название: string;
  Код: string;
}

export interface InstallationData { 
  node: number; 
  resource_type: number; 
  type: number; 
  serial_number: string; 
  join_reading: number; 
  installation_place: number; 
  object_type: number;          // обязательное, не из installation_place 
  apartment?: string; 
  consumer?: string; 
  phone?: string; 
  account_id?: string; 
  join_date: string; 
  client_sector: 'private' | 'legal' | 'multi_apartment' | 'physical'; 
  description?: string; 
  is_active?: boolean; 
  additional_data?: { 
    almaty_su_street_id?: string; 
    district?: number; 
  }; 
  device: number; 
  device__address?: number; 
  device_mode: number; 
  port?: number; 
} 

// One IoT-Exponenta service company in the Smart Metrix node tree. Picking it
// sets meter.node and (via its detail) drives the region-specific extra fields.
export interface ServiceNode {
  id: number;
  name: string;     // e.g. "ТОО \"IoT-Exponenta\" Алматы Су"
  supplier: string; // nearest supplier ancestor, e.g. "ГКП \"Алматы Су\""
  city: string;     // nearest city/region ancestor, e.g. "Алматы"
}

// A node.additional_fields entry — the backend declares per-utility which extra
// inputs an act needs (Almaty Su: street code + IPU class; Karaganda: check
// date + address code + district; most utilities: none).
export interface NodeAdditionalField {
  name: string;   // "additional_data.almaty_su_street_id" | "check_date" | "address_code" | ...
  type: string;   // "string" | "select" | "date"
  label: string;
  choices?: Array<{ id: number | string; name: string }>;
}

export interface PortMode {
  id: number; 
  name: string; 
  class_name: string; 
  device_model: number; 
  additional_data: { 
    fields?: Array<{ name: string; type: string; label: string }>; 
  } | null; 
}
