export interface PiholeSummary {
  queries: Queries;
  clients: Clients;
  gravity: Gravity;
  took: number;
}

export interface Clients {
  active: number;
  total: number;
}

export interface Gravity {
  domains_being_blocked: number;
  last_update: number;
}

export interface Queries {
  total: number;
  blocked: number;
  percent_blocked: number;
  unique_domains: number;
  forwarded: number;
  cached: number;
  frequency: number;
  types: { [key: string]: number };
  status: { [key: string]: number };
  replies: { [key: string]: number };
}

export interface HistoryType {
  history: History[];
  took: number;
}

export interface HistoryType {
  timestamp: number;
  total: number;
  cached: number;
  blocked: number;
}

export interface ChartHistoryType {
  date?: number;
  timestamp?: number;
  total: number;
  cached: number;
  blocked: number;
}

export interface PayloadChart {
  stroke: string;
  fill: string;
  dataKey: string;
  name: string;
  hide: boolean;
  color: string;
  payload: ChartHistoryType;
  value: number;
}
