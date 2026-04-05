import { getRuntimeLocale } from "@/lib/i18n/config";

type PathParamValue = string | number | boolean;
type QueryParamScalarValue = string | number | boolean;
type QueryParamValue = QueryParamScalarValue | QueryParamScalarValue[] | readonly QueryParamScalarValue[];

type RequestOptions = {
  body?: unknown;
  headers?: HeadersInit;
  params?: {
    path?: Record<string, PathParamValue>;
    query?: Record<string, QueryParamValue | null | undefined>;
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

function resolveUrl(
  path: string,
  params?: {
    path?: Record<string, PathParamValue>;
    query?: Record<string, QueryParamValue | null | undefined>;
  },
) {
  const resolvedPath = path.replaceAll(/\{([^}]+)\}/g, (_match, key: string) => {
    const value = params?.path?.[key];

    if (value === undefined) {
      throw new Error(`Missing path parameter: ${key}`);
    }

    return encodeURIComponent(String(value));
  });

  if (!params?.query) {
    return resolvedPath;
  }

  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params.query)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        searchParams.append(key, String(item));
      });
      continue;
    }

    searchParams.set(key, String(value));
  }

  const queryString = searchParams.toString();
  return queryString.length > 0 ? `${resolvedPath}?${queryString}` : resolvedPath;
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
    response = await fetch(`${baseUrl}${resolveUrl(path, options?.params)}`, {
      // Keep dashboard and instances views fully dynamic.
      method,
      headers,
      credentials: clientInit?.credentials,
      cache: "no-store",
      next: {
        revalidate: 0,
      },
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
    PUT<T>(path: string, options?: RequestOptions) {
      return requestJson<T>(baseUrl, "PUT", path, init, options);
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
