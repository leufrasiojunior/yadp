# YAPD v1 Plan: Frontend Next.js + Backend NestJS/Prisma com Segurança de Base

## Resumo
- Estruturar o YAPD como monorepo com `apps/web` em `Next.js` e `apps/api` em `NestJS + Prisma + PostgreSQL`, mantendo o dashboard atual como base visual e movendo toda lógica crítica para o backend.
- O produto será um painel central para múltiplas instâncias `Pi-hole v6+`, com `PT-BR + EN`, deploy via `Docker Compose`, onboarding por descoberta assistida + cadastro manual e import inicial de uma instância baseline.
- O estado canônico passa a morar no YAPD; toda operação de sync é auditável, com pré-checagem, retries e reconciliação explícita.
- Segurança entra como requisito de arquitetura: acesso pensado para `LAN/VPN`, TLS por padrão, segredos criptografados, trilha de auditoria completa, proteção extra para ações críticas e defaults seguros para bootstrap/admin.

## Arquitetura
- Monorepo com `npm workspaces`:
  - `apps/web`: frontend `Next.js`, i18n, shell do dashboard, WebSocket client e consumo da API.
  - `apps/api`: backend `NestJS`, auth, integração Pi-hole, sync, notificações, auditoria e realtime.
  - `packages/api-client`: client gerado a partir do OpenAPI do Nest.
- O `web` consome `REST + OpenAPI` e não guarda regras de negócio sensíveis.
- O `api` concentra:
  - autenticação e sessão
  - conector Pi-hole
  - sync engine
  - drift detection
  - políticas parentais
  - notificações
  - auditoria
  - WebSocket para eventos operacionais
- Banco padrão: `PostgreSQL`.
- Deploy inicial por `Docker Compose` com `web`, `api` e `postgres`.

## Backend e Modelo de Domínio
- Módulos do Nest:
  - `auth`
  - `instances`
  - `pihole`
  - `sync`
  - `clients`
  - `policies`
  - `parental`
  - `alerts`
  - `notifications`
  - `audit`
  - `realtime`
- Entidades principais:
  - `User`
  - `RefreshSession`
  - `Instance`
  - `InstanceSecret`
  - `InstanceCertificateTrust`
  - `InstanceSnapshot`
  - `CanonicalConfig`
  - `SyncJob`
  - `SyncAttempt`
  - `DriftEvent`
  - `ClientDevice`
  - `PolicyProfile`
  - `ScheduleWindow`
  - `AlertEvent`
  - `NotifierConfig`
  - `AuditLog`
- Conector Pi-hole com contratos fixos:
  - `authenticate`
  - `healthCheck`
  - `fetchSnapshot`
  - `discoverClients`
  - `applyCanonicalConfig`
  - `readCapabilities`
- Endpoints principais:
  - `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`
  - `/auth/setup` para bootstrap inicial controlado
  - `/instances`, `/instances/discover`, `/instances/:id/test`, `/instances/:id/maintenance`
  - `/sync/jobs`, `/sync/reconcile`
  - `/clients`
  - `/policies`, `/policies/:id/assignments`, `/policies/:id/schedules`
  - `/parental/overview`
  - `/alerts`, `/alerts/:id/ack`
  - `/settings/notifiers`
  - `/health`
- Canais realtime:
  - `sync.jobs`
  - `alerts.events`
  - `instances.health`

## Produto e Fluxos
- Onboarding:
  - descoberta assistida best-effort
  - cadastro manual garantido
  - teste de conexão/autenticação
  - escolha de instância baseline
  - import do baseline para `CanonicalConfig`
- Após bootstrap, o YAPD vira a fonte de verdade.
- Mudanças diretas em um Pi-hole viram `drift`; não sobrescrevem automaticamente o estado central.
- Sync global:
  - cria `SyncJob`
  - roda pré-checagem em todos os alvos
  - se qualquer alvo falhar, não aplica em nenhum
  - reexecuta até 3 vezes
  - se falhar ao final, abre alerta por instância
  - permite reconciliação manual a partir do estado canônico
- Controle parental MVP:
  - perfis por `IP/MAC`
  - associação de clientes descobertos do Pi-hole com ajuste manual
  - bloqueio por período
  - enable/disable programado de listas, domínios e grupos
  - dashboard parental dedicado

## Segurança
- Superfície de exposição:
  - v1 pensado para `LAN/VPN`, não para exposição pública direta.
  - Se houver reverse proxy, ele entra como camada adicional, não como substituto dos controles do app.
- Sessão do admin:
  - `JWT` em cookie `httpOnly`, `secure`, `sameSite` estrito por padrão quando viável.
  - `access token` curto + `refresh token` rotativo com revogação persistida em `RefreshSession`.
- Login do admin:
  - apesar da escolha por “senha apenas”, o v1 deve compensar com `Argon2id`, política de senha forte, rate limit, lockout progressivo e logging de tentativas.
  - manter 2FA fora do escopo inicial, mas deixar o módulo de auth preparado para expansão.
- Bootstrap inicial:
  - “seed automático” será implementado como criação de um admin bootstrap aleatório, de uso único, com `mustChangePassword=true`.
  - a credencial/token inicial deve ser exibida uma única vez em startup controlado ou arquivo bootstrap montado, e invalidada após o setup.
  - nunca usar credenciais padrão fixas.
- Ações críticas:
  - sync global, disable blocking, alteração de políticas parentais, mudança de notifiers e gestão de credenciais exigem confirmação explícita + reautenticação recente por senha.
- Segredos:
  - credenciais/application passwords das instâncias Pi-hole ficam criptografadas no banco com chave de aplicação.
  - nunca retornam em respostas da API.
  - toda leitura/escrita de segredo gera evento de auditoria.
- TLS entre YAPD e Pi-hole:
  - validação de certificado por padrão.
  - self-signed só com exceção explícita por instância, armazenando confiança/fingerprint/cert importado em `InstanceCertificateTrust`.
  - não habilitar modo inseguro global.
- API e app:
  - validação de entrada com DTOs/schema em todos endpoints.
  - rate limiting em auth e endpoints sensíveis.
  - CORS restrito.
  - proteção CSRF para rotas mutáveis baseadas em cookie.
  - OpenAPI/Swagger só em ambiente de dev ou protegido por auth admin.
  - headers de segurança no frontend e backend.
- Realtime:
  - WebSocket autenticado com sessão válida.
  - autorização por canal.
  - origem restrita ao frontend do YAPD.
- Auditoria:
  - trilha completa para login, falhas, mudanças de configuração, syncs, alerts, acessos a segredos, mudanças de instâncias e ações parentais.
  - registrar ator, IP de origem, alvo afetado, resultado e timestamp.
- Operação:
  - secrets fora do git.
  - imagens e dependências com controle de versão explícito.
  - backups do banco com restauração testada e proteção do material sensível.

## Fases de Entrega
1. Fundação segura
- Criar monorepo, `apps/web`, `apps/api`, Prisma, Postgres, OpenAPI, i18n e auth.
- Implementar bootstrap inicial seguro, sessão por cookie e base de auditoria.

2. Integração Pi-hole
- Conector v6+, gestão de SID, trust TLS por instância, teste de conexão e import baseline.

3. Estado central e sync
- `CanonicalConfig`, snapshots, drift, jobs, retries, maintenance mode, reconciliação e eventos realtime.

4. Produto operacional
- Overview real, instâncias, sync, clientes, alertas, settings, notificações e auditoria visível no produto.

5. Controle parental MVP
- Perfis por `IP/MAC`, agendas, associação cliente-perfil, execução programada e dashboard dedicado.

6. Pós-v1
- 2FA
- RBAC além do admin único
- analytics históricos
- agente opcional para Unbound/host actions
- hardening adicional para exposição externa, se desejado

## Testes e Critérios de Aceite
- Auth:
  - login/logout/refresh
  - cookies seguros
  - lockout e rate limit
  - bootstrap one-time com troca obrigatória de senha
- Security:
  - segredos criptografados no banco
  - CSRF/CORS corretos
  - Swagger protegido
  - reauth para ações críticas
  - trust TLS explícito para self-signed
- Onboarding:
  - descoberta assistida
  - cadastro manual
  - teste de conexão
  - import baseline
- Sync:
  - pré-checagem bloqueia mutação parcial
  - retries até 3 vezes
  - alerta final por instância
  - reconciliação manual
- Drift:
  - detectar alteração externa
  - exibir divergência
  - sobrescrever a partir do estado central
- Parental:
  - associação por `IP/MAC`
  - agendamento
  - conflitos previsíveis
- Audit:
  - eventos críticos persistidos e consultáveis
- Realtime:
  - jobs, alertas e saúde de instâncias por WebSocket autenticado
- i18n:
  - `PT-BR` e `EN` em UI, erros e notificações

## Assumptions e Defaults
- `Pi-hole v6+` apenas no v1.
- `PostgreSQL` como banco principal.
- `LAN/VPN` como modelo de exposição esperado.
- `Senha apenas` no v1, mas com compensações fortes de hardening.
- `Seed automático` significa bootstrap aleatório de uso único, nunca credencial padrão estática.
- `Self-signed` é suportado apenas com trust explícito por instância.
- Referências para orientar a trilha de segurança e integração: [Pi-hole API](https://docs.pi-hole.net/api/), [Pi-hole auth](https://docs.pi-hole.net/api/auth/), [Pi-hole group management](https://docs.pi-hole.net/group_management/), [NestJS security](https://docs.nestjs.com/security/authorization), [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [Next.js i18n](https://nextjs.org/docs/app/guides/internationalization), [next-intl](https://next-intl.dev/), [Prisma docs](https://www.prisma.io/docs).
