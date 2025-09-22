import z from "zod";

export const recentQueryLogSchema = z.object({
  id: z.number(), // antes estava string
  time: z.number().optional(), // antes estava string
  type: z.string().optional(),
  status: z.string().optional(),
  dnssec: z.string().optional(),
  domain: z.string().optional(),
  upstream: z.string().optional(),
  reply: z.object({
    time: z.number(),
    type: z.string(),
  }),
  client: z.object({
    ip: z.string().optional(),
    name: z.string().nullable().optional(),
  }),
  list_id: z.number().optional().optional(),
  ede: z.any().optional(), // tipar se possível
  cname: z.any().optional(),
});
