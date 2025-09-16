import z from "zod";

export const recentQueryLogSchema = z.object({
  id: z.string(),
  time: z.date(),
  type: z.string(),
  status: z.string(),
  domain: z.string(),
  reply: z.object({
    type: z.string(),
    time: z.date(),
  }),
  client: z.object({
    ip: z.string(),
    name: z.string().nullable(),
  }),
});
