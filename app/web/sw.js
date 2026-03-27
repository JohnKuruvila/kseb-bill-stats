self.addEventListener("push", (event) => {
  let payload = { title: "KSEB Bill Stats", body: "A new update is available." };
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { ...payload, body: event.data.text() || payload.body };
    }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
