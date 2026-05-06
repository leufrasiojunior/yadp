self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

async function notifyClients() {
  const clientList = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  clientList.forEach((client) => {
    client.postMessage({ type: "notifications-updated" });
  });
}

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "YAPD";
  const data = payload.data || { url: "/notifications" };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: payload.body || "",
        data,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
      }),
      notifyClients(),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/notifications";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existingClient = clientList[0];

      if (existingClient) {
        await existingClient.navigate(targetUrl);
        return existingClient.focus();
      }

      return self.clients.openWindow(targetUrl);
    })(),
  );
});
