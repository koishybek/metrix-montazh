export interface User {
  username: string;
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
  apartment: string;
  consumer: string;
  phone: string;
  account_id: string;
  join_date: string;
  client_sector: string;
  object_type: number;
  additional_data: {
    almaty_su_street_id: string;
    district: number;
  };
  device?: number;
  port?: number;
}
