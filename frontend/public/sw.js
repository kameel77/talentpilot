self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open("talentpilot-v1").then((cache) =>
            cache.addAll([
                "/",
                "/manifest.json",
                "/icon-192.png",
                "/icon-512.png",
            ])
        )
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== "talentpilot-v1")
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") {
        return;
    }
    const url = new URL(request.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        return;
    }
    const hasAuthHeader = request.headers.get("Authorization");
    if (hasAuthHeader) {
        return;
    }
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) {
                return cached;
            }
            return fetch(request)
                .then((response) => {
                    if (!response || response.status !== 200) {
                        return response;
                    }
                    const responseClone = response.clone();
                    caches.open("talentpilot-v1").then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => cached);
        })
    );
});
