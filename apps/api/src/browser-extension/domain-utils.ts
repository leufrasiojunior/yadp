const MULTIPART_PUBLIC_SUFFIXES = new Set([
  "ac.uk",
  "co.jp",
  "co.uk",
  "com.ar",
  "com.au",
  "com.br",
  "com.co",
  "com.mx",
  "edu.br",
  "gov.br",
  "gov.uk",
  "inf.br",
  "jus.br",
  "mil.br",
  "ne.jp",
  "net.au",
  "net.br",
  "org.au",
  "org.br",
  "org.uk",
  "tv.br",
]);

const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;

export function getRegistrableDomainGuess(hostname: string) {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");

  if (!normalized || normalized === "localhost" || normalized.includes(":") || IPV4_PATTERN.test(normalized)) {
    return normalized;
  }

  const parts = normalized.split(".").filter(Boolean);

  if (parts.length <= 2) {
    return normalized;
  }

  const suffix = parts.slice(-2).join(".");

  if (MULTIPART_PUBLIC_SUFFIXES.has(suffix) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }

  return parts.slice(-2).join(".");
}
