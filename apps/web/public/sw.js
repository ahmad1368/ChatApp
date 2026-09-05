self.addEventListener("push", (event) => {
  let payload = { title: "ChatApp", body: "You have a new message" };
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload.body = event.data.text();
    }
  }
  event.waitUntil(self.registration.showNotification(payload.title, { body: payload.body }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => "focus" in c);
      if (existing) return existing.focus();
      return self.clients.openWindow("/");
    })
  );
});
