# Guia de Configuração de Proxy Reverso

Este documento fornece instruções detalhadas sobre como configurar o YAPD atrás de um proxy reverso (como Nginx, Caddy, Traefik ou Nginx Proxy Manager).

O uso de um proxy reverso é recomendado para gerenciar certificados SSL válidos, permitir acesso via nomes de domínio amigáveis e centralizar a segurança da sua rede.

## Topologia Recomendada

Use o proxy reverso externo como entrada HTTPS pública e encaminhe o tráfego para o YAPD via HTTP na sua rede privada:

```text
Navegador -> https://yapd.seu-dominio.com -> proxy reverso externo -> http://HOST_YAPD:48080
```

Com `compose.yml`, o container YAPD publica:

- `48080` -> porta HTTP interna `80` do container
- `48443` -> porta HTTPS interna `443` do container

Na maioria dos deploys, use `48080` como destino upstream. A porta `48443` usa um certificado interno autoassinado e só deve ser usada se o seu proxy estiver configurado para confiar ou ignorar esse certificado de backend. A segurança do navegador e as notificações push dependem do certificado público servido pelo proxy externo.

## Variáveis de Ambiente Cruciais

Ao usar um proxy reverso, você deve ajustar as seguintes variáveis no seu `compose.yml` ou arquivo `.env`:

### 1. `COOKIE_SECURE`
- **`true` (Recomendado)**: Use se o acesso final do usuário for via **HTTPS**. O navegador exigirá uma conexão segura para enviar o cookie de sessão.
- **`false`**: Use se o acesso final do usuário for via **HTTP**. Se estiver como `true` e você acessar via HTTP, o login não funcionará (o cookie será descartado pelo navegador).

### 2. `WEB_ORIGIN`
Deve conter a URL completa (incluindo protocolo e porta, se não for padrão) que você usa para acessar o YAPD no navegador. Exemplo: `https://yapd.seu-dominio.com`. Isso é essencial para a proteção contra CSRF.

Para deploys HTTPS com proxy reverso, mantenha estes valores alinhados:

```yaml
WEB_ORIGIN: "https://yapd.seu-dominio.com"
COOKIE_SECURE: "true"
NEXT_PUBLIC_API_BASE_URL: /api
INTERNAL_API_BASE_URL: http://127.0.0.1:3001/api
```

---

## Requisitos para Notificações Push (Service Workers)

Para que as notificações Push funcionem, os navegadores modernos exigem um **Contexto Seguro**. Isso significa:
1. Acesso via `localhost` ou `127.0.0.1` (apenas para testes locais).
2. Acesso via **HTTPS com um certificado SSL válido** (confiado pelo navegador).

**Nota importante**: Se você usar um certificado auto-assinado (self-signed), o navegador bloqueará o registro do Service Worker (`notifications-sw.js`), resultando em erros de segurança no console e impedindo o funcionamento das notificações. Por isso, recomenda-se o uso de certificados de autoridades conhecidas (como Let's Encrypt).

Se o seu proxy tiver opção de cache de assets, garanta que `/notifications-sw.js` não fique cacheado. Service workers devem ser sempre revalidados. Desative o cache de assets enquanto testa as notificações push, ou adicione uma regra específica de no-cache para esse caminho:

```nginx
location = /notifications-sw.js {
    proxy_pass http://ip-do-seu-servidor:48080/notifications-sw.js;
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    add_header Service-Worker-Allowed "/" always;
}
```

---

## Exemplos de Configuração

### Nginx

Certifique-se de passar os headers de proxy e suportar WebSockets.

```nginx
server {
    listen 80;
    server_name yapd.seu-dominio.com;

    # Redirecionar para HTTPS (opcional, mas recomendado)
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yapd.seu-dominio.com;

    ssl_certificate /caminho/para/seu/fullchain.pem;
    ssl_certificate_key /caminho/para/seu/privkey.pem;

    location / {
        proxy_pass http://ip-do-seu-servidor:48080; # Aponta para a porta HTTP publicada do YAPD
        proxy_http_version 1.1;
        
        # Headers Necessários
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Ajuste de timeouts para WebSockets
        proxy_read_timeout 86400;
    }
}
```

### Caddy

O Caddy gerencia o SSL automaticamente e simplifica a configuração de WebSockets.

```caddy
yapd.seu-dominio.com {
    reverse_proxy http://ip-do-seu-servidor:48080 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

### Nginx Proxy Manager (NPM)

1. Crie um novo **Proxy Host**.
2. **Domain Names**: `yapd.seu-dominio.com`.
3. **Scheme**: `http`.
4. **Forward Hostname/IP**: IP do host YAPD, por exemplo `192.168.31.17`.
5. **Forward Port**: `48080` ao usar `compose.yml`.
6. Ative **Websockets Support**.
7. Na aba **SSL**, selecione seu certificado (ou gere um novo via Let's Encrypt) e ative **Force SSL** e **HTTP/2 Support**.
8. Ative HSTS apenas depois de confirmar que o domínio funciona em HTTPS. Use **HSTS Subdomains** somente se todos os subdomínios do mesmo domínio pai estiverem prontos para HTTPS forçado.
9. Mantenha **Block Common Exploits** ativo.
10. Desative **Cache Assets** enquanto testa notificações push. Se mantiver ativo, crie uma exceção sem cache para `/notifications-sw.js`.

Headers recomendados em **Advanced**:

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

Não use `https` + `48443` como upstream padrão no NPM. Esse caminho aponta para o endpoint HTTPS interno autoassinado do YAPD; em geral ele adiciona problemas de confiança de certificado sem melhorar a segurança no navegador. Use `http` + `48080`, a menos que você gerencie intencionalmente a confiança do certificado do backend.

---

## Troubleshooting

### Login não funciona (redireciona para login após sucesso)
Verifique se `COOKIE_SECURE` está condizente com o protocolo de acesso (HTTP vs HTTPS). Se estiver acessando via HTTPS através do proxy, `COOKIE_SECURE` deve ser `true`.

Confirme também que `WEB_ORIGIN` corresponde exatamente à URL pública, incluindo protocolo e porta quando a porta não for `443`.

### Erro de "SSL Certificate Error" no Service Worker
O seu proxy reverso precisa fornecer um certificado válido e confiado pelo navegador. Verifique se o cadeado no navegador está verde e sem avisos de segurança.

Se o certificado público estiver válido, mas a ativação do push ainda falhar, verifique no DevTools do navegador, nas abas Console e Network:

- `GET /api/notifications/push/public-key` retornando `200` e `available: true`
- `PUT /api/notifications/push/subscription` retornando `200`
- `Notification.permission` mudando para `granted`
- `navigator.serviceWorker.getRegistration("/notifications-sw.js")` retornando um registro ativo

### Botão de push não mostra a solicitação do navegador
Os navegadores não mostram a solicitação novamente se o site já estiver bloqueado. Abra as configurações do site para o domínio do YAPD, redefina ou permita Notificações, recarregue a página e tente de novo.

### Atualizações em tempo real não funcionam
Verifique se o seu proxy reverso está configurado corretamente para suportar WebSockets (headers `Upgrade` e `Connection`).
