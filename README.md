## YAPD - Yet Another Pi-hole Dashboard

### Time zone

When running YAPD in Docker, set `TZ` on the application containers, for example `TZ=America/Sao_Paulo`.

The web app prefers the browser time zone for rendering dates and falls back to `TZ` during server-side rendering or container-based execution.
