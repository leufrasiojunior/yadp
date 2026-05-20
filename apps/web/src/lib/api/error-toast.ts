"use client";

import { toast } from "sonner";

import { getApiErrorMessage } from "./error-message";

export async function showApiErrorToast(response: Response, fallback: string) {
  const message = await getApiErrorMessage(response);
  const statusText = response.statusText.trim().toLowerCase();
  const normalizedMessage = message.trim();
  const genericMessage = normalizedMessage.toLowerCase();
  const shouldUseFallback =
    normalizedMessage.length === 0 ||
    normalizedMessage.toLowerCase() === statusText ||
    genericMessage === "request failed." ||
    genericMessage === "a requisicao falhou.";
  const resolvedMessage = fallback.trim().length > 0 && shouldUseFallback ? fallback : normalizedMessage || fallback;

  toast.error(resolvedMessage);
  return resolvedMessage;
}
