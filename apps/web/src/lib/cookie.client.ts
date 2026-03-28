// Client-side cookie utilities.
// These functions manage cookies in the browser only.
// Server actions handle cookie updates on the server side.

type BrowserCookieStore = {
  set(options: { name: string; value: string; expires?: Date; path?: string }): Promise<void>;
  delete(options: { name: string; path?: string }): Promise<void>;
};

function getBrowserCookieStore() {
  return (window as Window & { cookieStore?: BrowserCookieStore }).cookieStore ?? null;
}

export function setClientCookie(key: string, value: string, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  const cookieStore = getBrowserCookieStore();

  if (cookieStore) {
    void cookieStore.set({
      name: key,
      value,
      expires: new Date(expires),
      path: "/",
    });
    return;
  }

  /* biome-ignore lint/suspicious/noDocumentCookie: fallback for browsers without Cookie Store API support */
  document.cookie = `${key}=${value}; expires=${expires}; path=/`;
}

export function getClientCookie(key: string) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${key}=`))
    ?.split("=")[1];
}

export function deleteClientCookie(key: string) {
  const cookieStore = getBrowserCookieStore();

  if (cookieStore) {
    void cookieStore.delete({
      name: key,
      path: "/",
    });
    return;
  }

  /* biome-ignore lint/suspicious/noDocumentCookie: fallback for browsers without Cookie Store API support */
  document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
}
