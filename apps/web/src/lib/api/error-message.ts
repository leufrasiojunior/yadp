import { getRuntimeLocale } from "@/lib/i18n/config";

function normalizeErrorText(value: string) {
  return value
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function pickMessage(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = normalizeErrorText(value);
    return normalized.length > 0 ? normalized : null;
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => pickMessage(item))
      .filter((item): item is string => Boolean(item))
      .join(" ");

    return joined.length > 0 ? joined : null;
  }

  return null;
}

export async function getApiErrorMessage(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  try {
    const payload = (await response.clone().json()) as {
      message?: string;
      details?: string | string[];
      error?: string;
    };

    const message = pickMessage(payload.message);

    if (message) {
      return message;
    }

    const details = pickMessage(payload.details);

    if (details) {
      return details;
    }

    const error = pickMessage(payload.error);

    if (error) {
      return error;
    }
  } catch {
    // ignore JSON parsing errors
  }

  if (!contentType.includes("application/json")) {
    try {
      const text = normalizeErrorText(await response.clone().text());

      if (text.length > 0 && text.toLowerCase() !== response.statusText.toLowerCase()) {
        return text;
      }
    } catch {
      // ignore text parsing errors
    }
  }

  if (response.statusText) {
    return response.statusText;
  }

  return getRuntimeLocale() === "en-US" ? "Request failed." : "A requisicao falhou.";
}
