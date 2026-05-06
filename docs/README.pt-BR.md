![Logotipo do YAPD](../media/logo.png)

# YAPD

**Yet Another Pi-hole Dashboard** é uma central auto-hospedada para quem usa mais de uma instância do Pi-hole e quer uma forma mais clara e segura de acompanhar a rede.

O YAPD foi pensado para reunir ambientes Pi-hole v6+ em um único lugar: painéis, saúde das instâncias, consultas DNS, gerenciamento de configuração, sincronização, detecção de divergências, histórico de auditoria e futuros controles parentais. Em vez de abrir cada Pi-hole separadamente, o YAPD busca ser a superfície operacional confiável para todo o seu ambiente de filtragem DNS.

## Por Que O YAPD Existe

Rodar um único Pi-hole é simples. Rodar várias instâncias em um homelab, escritório pequeno, rede com VLANs ou ambiente familiar exige mais cuidado:

- configurações podem ficar diferentes entre instâncias;
- mudanças importantes podem passar despercebidas;
- a atividade DNS fica espalhada em dashboards diferentes;
- sincronizações manuais podem ser arriscadas;
- ações críticas precisam de histórico visível.

O YAPD parte de uma ideia simples: **o dashboard deve conhecer o estado desejado, mostrar quando a realidade está diferente e tornar mudanças explícitas, auditáveis e recuperáveis**.

## Destaques

- **Dashboard multi-instância**: gerencie e monitore várias instâncias Pi-hole v6+ em uma única interface.
- **Configuração central como fonte da verdade**: mantenha o estado esperado no YAPD em vez de depender de ajustes manuais espalhados.
- **Sincronização e detecção de drift**: identifique quando uma instância diverge do estado esperado antes de aplicar mudanças.
- **Visibilidade de consultas e atividade**: acompanhe atividade DNS, clientes, domínios e histórico pela tela de Overview.
- **Saúde das instâncias e alertas**: veja status operacional, notificações e pontos que precisam de atenção.
- **Operações com auditoria**: registre ações críticas, mudanças de configuração, tentativas de sync e eventos sensíveis.
- **Direção security-first**: projetado para LAN/VPN, segredos criptografados, sessões seguras, trust explícito para certificados self-signed e sem credencial padrão fixa.
- **Internacionalização**: o projeto é pensado para usuários em português do Brasil e inglês.

## Prints

### Dashboard

![Print do dashboard do YAPD](../media/dashboard.png)

### Overview

![Print da tela Overview do YAPD](../media/Overview.png)

### Instâncias

![Print da tela de instâncias do YAPD](../media/Instances.png)

### Configuração

![Print da tela de configuração do YAPD](../media/Configuration.png)

### Consultas

![Print da tela de consultas do YAPD](../media/queries.png)

### Domínios

![Print da tela de domínios do YAPD](../media/domains.png)

### Grupos

![Print da tela de grupos do YAPD](../media/groups.png)

### Listas De Bloqueio

![Print da tela de listas de bloqueio do YAPD](../media/ad-lists.png)

### Notificações

![Print da tela de notificações do YAPD](../media/notifications.png)

## Arquitetura Em Linguagem Simples

O YAPD é um monorepo TypeScript com uma aplicação web, uma API e um cliente de API gerado.

- **Frontend**: Next.js App Router, Tailwind CSS, Shadcn UI, Zustand e `next-intl`.
- **Backend**: API NestJS com Prisma e PostgreSQL.
- **Cliente de API**: cliente TypeScript gerado e usado pelo frontend.
- **Realtime**: direção para eventos via WebSocket, como jobs de sincronização, alertas e saúde de instâncias.

O frontend não deve ser o lugar das regras sensíveis. O backend concentra autenticação, integração com Pi-hole, sincronização, detecção de drift, auditoria, notificações e ações críticas.

## Segurança E Deploy

O YAPD foi projetado primeiro para redes privadas confiáveis, como ambientes **LAN ou VPN**. Um proxy reverso pode ser usado, mas não deve substituir os controles da própria aplicação.

A direção da v1 inclui:

- sessões administrativas seguras com cookies HTTP-only;
- hashing forte de senha;
- rate limit e lockout para fluxos sensíveis;
- credenciais Pi-hole e segredos da aplicação criptografados;
- trust explícito para certificados self-signed de instâncias Pi-hole;
- auditoria para operações críticas;
- reautenticação para ações perigosas;
- nenhum admin padrão estático ou senha bootstrap hardcoded.

## Início Rápido Para Desenvolvimento

```bash
npm install
npm run db:up
npm run prisma:generate
npm run generate:api-client
npm run dev
```

Comandos úteis de validação:

```bash
npm run check
npm run lint
npm run build
```

Para mudanças no schema do banco, use migrações Prisma em `apps/api/prisma/migrations`:

```bash
npm run db:migrate:dev -- --name your_change_name
```

Evite `prisma db push` para mudanças de schema da aplicação. As migrações são a fonte da verdade para evoluções seguras em desenvolvimento e produção.

## Status Do Projeto

O YAPD está em desenvolvimento ativo rumo ao plano v1 descrito em [Plano.md](../Plano.md). O objetivo é entregar um dashboard prático, auto-hospedado e consciente de segurança para operar instalações Pi-hole com mais confiança e menos trabalho manual repetitivo.
