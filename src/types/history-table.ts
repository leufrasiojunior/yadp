export interface QueryTableResponse {
  queries: QueryTableResponse[];
  cursor: number;
  recordsTotal: number;
  recordsFiltered: number;
  draw: number;
  took: number;
}

export interface Reply {
  type: string;
  time: number;
}

export interface Client {
  ip: string;
  name?: string;
}

export interface Ede {
  code: number;
  text: any;
}
