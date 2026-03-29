import { Injectable } from "@nestjs/common";
import { Agent, fetch } from "undici";

import { DEFAULT_API_LOCALE } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
import type { PiholeConnection, PiholeDiscoveryResult, PiholeSession, PiholeVersionInfo } from "./pihole.types";

const PIHOLE_REQUEST_TIMEOUT_MS = 8000;

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
      summary: this.extractVersionSummary(payload, connection.locale),
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PIHOLE_REQUEST_TIMEOUT_MS);
    let response: Awaited<ReturnType<typeof fetch>>;

    try {
      response = await fetch(new URL(`/api${path}`, this.normalizeBaseUrl(connection.baseUrl)), {
        method: options?.method ?? "GET",
        headers,
        body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
        dispatcher: new Agent({
          connect: {
            rejectUnauthorized: !(connection.allowSelfSigned ?? false),
            ...(connection.certificatePem ? { ca: connection.certificatePem } : {}),
          },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      throw new PiholeRequestError(502, this.describeTransportError(connection.baseUrl, error, connection.locale), {
        cause: this.serializeTransportError(error),
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    let payload: unknown;

    if (text.length > 0) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = {
          raw: text,
        };
      }
    }

    if (!response.ok) {
      const errorPayload = payload as PiholeErrorPayload | undefined;
      throw new PiholeRequestError(response.status, errorPayload?.error?.message ?? response.statusText, payload);
    }

    return payload as T;
  }

  private describeTransportError(baseUrl: string, error: unknown, locale = DEFAULT_API_LOCALE) {
    const reason = this.serializeTransportError(error);

    if (reason.name === "AbortError") {
      return translateApi(locale, "pihole.timeout", { baseUrl });
    }

    if (reason.code === "ECONNREFUSED") {
      return translateApi(locale, "pihole.refused", { baseUrl });
    }

    if (reason.code === "ENOTFOUND" || reason.code === "EAI_AGAIN") {
      return translateApi(locale, "pihole.unresolved", { baseUrl });
    }

    if (reason.code === "ETIMEDOUT" || reason.code === "UND_ERR_CONNECT_TIMEOUT") {
      return translateApi(locale, "pihole.timeout", { baseUrl });
    }

    return translateApi(locale, "pihole.unreachable", { baseUrl });
  }

  private serializeTransportError(error: unknown) {
    if (error instanceof Error) {
      const maybeError = error as Error & {
        code?: string;
        cause?: {
          code?: string;
        };
      };

      return {
        name: maybeError.name,
        message: maybeError.message,
        code: maybeError.code ?? maybeError.cause?.code,
      };
    }

    return {
      name: "UnknownError",
      message: "Unknown transport error",
      code: undefined,
    };
  }

  private extractVersionSummary(payload: unknown, locale = DEFAULT_API_LOCALE) {
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

    return translateApi(locale, "pihole.reachable");
  }

  private normalizeBaseUrl(baseUrl: string) {
    return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  }
}
