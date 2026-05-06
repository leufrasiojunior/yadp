export function decodePushPublicKey(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function isCurrentPushSubscriptionServerKey(
  applicationServerKey: ArrayBuffer | null | undefined,
  currentPublicKey: string,
) {
  if (!applicationServerKey) {
    return false;
  }

  return encodeBase64Url(new Uint8Array(applicationServerKey)) === currentPublicKey;
}
