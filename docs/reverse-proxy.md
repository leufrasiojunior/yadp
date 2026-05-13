# Reverse Proxy Configuration Guide

This document provides detailed instructions on how to configure YAPD behind a reverse proxy (such as Nginx, Caddy, Traefik, or Nginx Proxy Manager).

Using a reverse proxy is recommended for managing valid SSL certificates, enabling friendly domain names, and centralizing your network's security.

## Recommended Topology

Use the external reverse proxy as the public HTTPS entrypoint and forward traffic to YAPD over HTTP on your private network:

```text
Browser -> https://yapd.your-domain.com -> external reverse proxy -> http://YAPD_HOST:48080
```

With `compose_novo_prod.yml`, the YAPD container publishes:

- `48080` -> internal container HTTP port `80`
- `48443` -> internal container HTTPS port `443`

For most deployments, use `48080` as the upstream target. The `48443` port uses an internal self-signed certificate and is only useful if your proxy is configured to trust or ignore that backend certificate. Browser security and push notifications depend on the public certificate served by the external proxy.

## Crucial Environment Variables

When using a reverse proxy, you must adjust the following variables in your `compose.yaml` or `.env` file:

### 1. `COOKIE_SECURE`
- **`true` (Recommended)**: Use if the final user access is via **HTTPS**. The browser will require a secure connection to send the session cookie.
- **`false`**: Use if the final user access is via **HTTP**. If set to `true` and you access via HTTP, login will not work (the cookie will be discarded by the browser).

### 2. `WEB_ORIGIN`
Must contain the full URL (including protocol and port, if not default) that you use to access YAPD in the browser. Example: `https://yapd.your-domain.com`. This is essential for CSRF protection.

For reverse-proxy HTTPS deployments, keep these values aligned:

```yaml
WEB_ORIGIN: "https://yapd.your-domain.com"
COOKIE_SECURE: "true"
NEXT_PUBLIC_API_BASE_URL: /api
INTERNAL_API_BASE_URL: http://127.0.0.1:3001/api
```

---

## Requirements for Push Notifications (Service Workers)

For Push notifications to work, modern browsers require a **Secure Context**. This means:
1. Access via `localhost` or `127.0.0.1` (local testing only).
2. Access via **HTTPS with a valid SSL certificate** (trusted by the browser).

**Important Note**: If you use a self-signed certificate, the browser will block the Service Worker registration (`notifications-sw.js`), resulting in security errors in the console and preventing notifications from working. Therefore, using certificates from known authorities (like Let's Encrypt) is recommended.

If your proxy has an asset cache option, make sure `/notifications-sw.js` is not cached. Service workers should always be revalidated. Disable asset caching while testing push notifications, or add a specific no-cache rule for this path:

```nginx
location = /notifications-sw.js {
    proxy_pass http://your-server-ip:48080/notifications-sw.js;
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    add_header Service-Worker-Allowed "/" always;
}
```

---

## Configuration Examples

### Nginx

Make sure to pass proxy headers and support WebSockets.

```nginx
server {
    listen 80;
    server_name yapd.your-domain.com;

    # Redirect to HTTPS (optional but recommended)
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yapd.your-domain.com;

    ssl_certificate /path/to/your/fullchain.pem;
    ssl_certificate_key /path/to/your/privkey.pem;

    location / {
        proxy_pass http://your-server-ip:48080; # Points to the YAPD published HTTP port
        proxy_http_version 1.1;
        
        # Required Headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeout adjustment
        proxy_read_timeout 86400;
    }
}
```

### Caddy

Caddy manages SSL automatically and simplifies WebSocket configuration.

```caddy
yapd.your-domain.com {
    reverse_proxy http://your-server-ip:48080 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

### Nginx Proxy Manager (NPM)

1. Create a new **Proxy Host**.
2. **Domain Names**: `yapd.your-domain.com`.
3. **Scheme**: `http`.
4. **Forward Hostname/IP**: YAPD host IP, for example `192.168.31.17`.
5. **Forward Port**: `48080` when using `compose_novo_prod.yml`.
6. Enable **Websockets Support**.
7. In the **SSL** tab, select your certificate (or generate a new one via Let's Encrypt) and enable **Force SSL** and **HTTP/2 Support**.
8. Enable HSTS only after confirming the domain works over HTTPS. Use **HSTS Subdomains** only if every subdomain under the same parent domain is ready for enforced HTTPS.
9. Keep **Block Common Exploits** enabled.
10. Disable **Cache Assets** while testing push notifications. If you keep it enabled, add a no-cache exception for `/notifications-sw.js`.

Recommended **Advanced** headers:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_read_timeout 86400;
```

Do not use `https` + `48443` as the default upstream in NPM. That path points to YAPD's internal self-signed HTTPS endpoint; it usually adds certificate-trust problems without improving browser security. Use `http` + `48080` unless you intentionally manage backend certificate trust.

---

## Troubleshooting

### Login doesn't work (redirects back to login after success)
Check if `COOKIE_SECURE` matches your access protocol (HTTP vs HTTPS). If accessing via HTTPS through the proxy, `COOKIE_SECURE` must be `true`.

Also confirm that `WEB_ORIGIN` exactly matches the public URL, including protocol and port when the port is not `443`.

### "SSL Certificate Error" in Service Worker
Your reverse proxy needs to provide a valid certificate trusted by the browser. Check if the padlock in the browser is green and without security warnings.

If the public certificate is valid but push activation still fails, check the browser DevTools console and Network tab for:

- `GET /api/notifications/push/public-key` returning `200` and `available: true`
- `PUT /api/notifications/push/subscription` returning `200`
- `Notification.permission` becoming `granted`
- `navigator.serviceWorker.getRegistration("/notifications-sw.js")` returning an active registration

### Push button does not show the browser permission prompt
Browsers do not show the permission prompt again if the site is already blocked. Open the browser site settings for the YAPD domain, reset or allow Notifications, reload the page, and try again.

### Real-time updates not working
Check if your reverse proxy is correctly configured to support WebSockets (`Upgrade` and `Connection` headers).
