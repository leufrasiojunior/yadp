export interface QueryTableResponse {
  queries: Query[]; // sua lista de queries
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

export interface Query {
  id: number;
  time: number;
  type: string;
  status: string;
  dnssec: string;
  domain: string;
  upstream?: string;
  reply: Reply;
  client: Client;
  list_id?: number;
  ede: Ede;
  cname: any;
}
