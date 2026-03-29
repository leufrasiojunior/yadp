import { getRuntimeLocale } from "@/lib/i18n/config";

type PathParamValue = string | number | boolean;

type RequestOptions = {
  body?: unknown;
  headers?: HeadersInit;
  params?: {
    path?: Record<string, PathParamValue>;
  };
};

type ClientInit = {
  credentials?: RequestCredentials;
  headers?: HeadersInit;
};

type ApiResult<T> = {
  data: T | null;
  response: Response;
};

const API_UNAVAILABLE_HEADER = "x-yapd-api-unavailable";

function createApiUnavailableResponse(baseUrl: string, error: unknown) {
  const cause = error instanceof Error ? error.message : "Unknown fetch failure";
  const locale = getRuntimeLocale();
  const message =
    locale === "en-US"
      ? `Could not connect to the YAPD backend at ${baseUrl}. Start "npm run dev:api" and try again.`
      : `Nao foi possivel conectar ao backend do YAPD em ${baseUrl}. Inicie "npm run dev:api" e tente novamente.`;

  return new Response(
    JSON.stringify({
      message,
      error: cause,
    }),
    {
      status: 503,
      statusText: "Service Unavailable",
      headers: {
        "content-type": "application/json",
        [API_UNAVAILABLE_HEADER]: "1",
      },
    },
  );
}

export function isYapdApiUnavailableResponse(response: Response) {
  return response.headers.get(API_UNAVAILABLE_HEADER) === "1";
}

function resolvePath(path: string, params?: Record<string, PathParamValue>) {
  return path.replaceAll(/\{([^}]+)\}/g, (_match, key: string) => {
    const value = params?.[key];

    if (value === undefined) {
      throw new Error(`Missing path parameter: ${key}`);
    }

    return encodeURIComponent(String(value));
  });
}

async function requestJson<T>(
  baseUrl: string,
  method: string,
  path: string,
  clientInit?: ClientInit,
  options?: RequestOptions,
): Promise<ApiResult<T>> {
  const headers = new Headers(clientInit?.headers);

  if (options?.headers) {
    new Headers(options.headers).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  if (options?.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  let response: Response;

  try {
    response = await fetch(`${baseUrl}${resolvePath(path, options?.params?.path)}`, {
      method,
      headers,
      credentials: clientInit?.credentials,
      cache: "no-store",
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    return {
      data: null,
      response: createApiUnavailableResponse(baseUrl, error),
    };
  }

  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? ((await response.clone().json()) as T) : null;

  return {
    data,
    response,
  };
}

export function createYapdHttpClient(baseUrl: string, init?: ClientInit) {
  return {
    GET<T>(path: string, options?: Omit<RequestOptions, "body">) {
      return requestJson<T>(baseUrl, "GET", path, init, options);
    },
    POST<T>(path: string, options?: RequestOptions) {
      return requestJson<T>(baseUrl, "POST", path, init, options);
    },
    PATCH<T>(path: string, options?: RequestOptions) {
      return requestJson<T>(baseUrl, "PATCH", path, init, options);
    },
    DELETE<T>(path: string, options?: Omit<RequestOptions, "body">) {
      return requestJson<T>(baseUrl, "DELETE", path, init, options);
    },
  };
}
