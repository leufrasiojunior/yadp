export type PushSupportStatus = "supported" | "insecure-context" | "unsupported-browser" | "server-unavailable";

type PushSupportWindow = {
  isSecureContext?: boolean;
  Notification?: unknown;
  PushManager?: unknown;
};

type PushSupportNavigator = {
  serviceWorker?: unknown;
};

type PushSupportInput = {
  windowObject?: PushSupportWindow;
  navigatorObject?: PushSupportNavigator;
  serverAvailable?: boolean;
};

export function getPushSupportStatus(input: PushSupportInput = {}): PushSupportStatus {
  const windowObject = input.windowObject ?? (typeof window === "undefined" ? undefined : window);
  const navigatorObject = input.navigatorObject ?? (typeof navigator === "undefined" ? undefined : navigator);

  if (!windowObject || !navigatorObject) {
    return "unsupported-browser";
  }

  if (windowObject.isSecureContext !== true) {
    return "insecure-context";
  }

  if (!("Notification" in windowObject) || !("serviceWorker" in navigatorObject) || !("PushManager" in windowObject)) {
    return "unsupported-browser";
  }

  if (input.serverAvailable === false) {
    return "server-unavailable";
  }

  return "supported";
}
