export type SessionCookiePayload = {
  authMethod: "pihole-master" | "yapd-password";
  baselineInstanceId: string;
  sid?: string;
  csrf?: string;
  expiresAt: string;
  antiCsrfToken: string;
};
