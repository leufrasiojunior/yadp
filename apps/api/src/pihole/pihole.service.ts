import { Injectable } from "@nestjs/common";
import { Agent, fetch } from "undici";

import type { PiholeConnection, PiholeDiscoveryResult, PiholeSession, PiholeVersionInfo } from "./pihole.types";

type PiholeErrorPayload = {
  error?: {
    message?: string;
    key?: string;
  };
};

export class PiholeRequestError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly payload?: unknown,
  ) {
    super(message);
  }
}

@Injectable()
export class PiholeService {
  async checkAuthenticationRequired(connection: PiholeConnection): Promise<PiholeDiscoveryResult> {
    const payload = await this.request<unknown>(connection, "/auth");
    const authRequired =
      typeof payload === "object" &&
      payload !== null &&
      "session" in payload &&
      typeof payload.session === "object" &&
      payload.session !== null &&
      "valid" in payload.session
        ? !(payload.session as { valid?: boolean }).valid
        : true;

    return {
      baseUrl: connection.baseUrl,
      authRequired,
      raw: payload,
    };
  }

  async authenticate(connection: PiholeConnection, password: string, totp?: string): Promise<PiholeSession> {
    const payload = await this.request<{ session: PiholeSession }>(connection, "/auth", {
      method: "POST",
      body: {
        password,
        ...(totp ? { totp } : {}),
      },
    });

    return payload.session;
  }

  async logout(connection: PiholeConnection, sid: string) {
    await this.request<void>(connection, "/auth", {
      method: "DELETE",
      sid,
    });
  }

  async healthCheck(connection: PiholeConnection, session?: Pick<PiholeSession, "sid" | "csrf">) {
    const version = await this.readCapabilities(connection, session);

    return {
      ok: true,
      version: version.summary,
    };
  }

  async readCapabilities(
    connection: PiholeConnection,
    session?: Pick<PiholeSession, "sid" | "csrf">,
  ): Promise<PiholeVersionInfo> {
    const payload = await this.request<unknown>(connection, "/info/version", {
      sid: session?.sid,
      csrf: session?.csrf,
    });

    return {
      summary: this.extractVersionSummary(payload),
      raw: payload,
    };
  }

  async discoverClients(connection: PiholeConnection, session: Pick<PiholeSession, "sid" | "csrf">) {
    return this.request<unknown>(connection, "/network/devices", {
      sid: session.sid,
      csrf: session.csrf,
    });
  }

  async fetchSnapshot(connection: PiholeConnection, session: Pick<PiholeSession, "sid" | "csrf">) {
    const [blocking, groups] = await Promise.all([
      this.request<unknown>(connection, "/dns/blocking", {
        sid: session.sid,
        csrf: session.csrf,
      }),
      this.request<unknown>(connection, "/groups", {
        sid: session.sid,
        csrf: session.csrf,
      }),
    ]);

    return {
      blocking,
      groups,
    };
  }

  async applyCanonicalConfig() {
    throw new Error("Canonical config sync is not implemented in slice 1");
  }

  private async request<T>(
    connection: PiholeConnection,
    path: string,
    options?: {
      method?: string;
      body?: unknown;
      sid?: string;
      csrf?: string;
    },
  ): Promise<T> {
    const headers = new Headers({
      Accept: "application/json",
    });

    if (options?.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    if (options?.sid) {
      headers.set("X-FTL-SID", options.sid);
    }

    if (options?.csrf) {
      headers.set("X-FTL-CSRF", options.csrf);
    }

    const response = await fetch(new URL(`/api${path}`, this.normalizeBaseUrl(connection.baseUrl)), {
      method: options?.method ?? "GET",
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
      dispatcher: new Agent({
        connect: {
          rejectUnauthorized: !(connection.allowSelfSigned ?? false),
          ...(connection.certificatePem ? { ca: connection.certificatePem } : {}),
        },
      }),
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    const payload = text.length > 0 ? (JSON.parse(text) as unknown) : undefined;

    if (!response.ok) {
      const errorPayload = payload as PiholeErrorPayload | undefined;
      throw new PiholeRequestError(response.status, errorPayload?.error?.message ?? response.statusText, payload);
    }

    return payload as T;
  }

  private extractVersionSummary(payload: unknown) {
    if (typeof payload === "object" && payload !== null) {
      const maybeVersion = payload as Record<string, unknown>;

      if (typeof maybeVersion.version === "string") {
        return maybeVersion.version;
      }

      if (typeof maybeVersion.ftl === "string") {
        return maybeVersion.ftl;
      }

      if (typeof maybeVersion.core === "string" && typeof maybeVersion.web === "string") {
        return `${maybeVersion.core} / ${maybeVersion.web}`;
      }
    }

    return "Pi-hole reachable";
  }

  private normalizeBaseUrl(baseUrl: string) {
    return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  }
}
