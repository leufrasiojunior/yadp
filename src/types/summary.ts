export type PiholeConfig = { url: string; password: string };

export type Summary = {
  queries: {
    total: number;
    blocked: number;
    percent_blocked: number;
    unique_domains: number;
  };
};
