export async function getApiErrorMessage(response: Response) {
  try {
    const payload = (await response.clone().json()) as {
      message?: string;
      error?: string;
    };

    if (typeof payload.message === "string") {
      return payload.message;
    }

    if (typeof payload.error === "string") {
      return payload.error;
    }
  } catch {
    // ignore JSON parsing errors
  }

  return response.statusText || "Request failed.";
}
