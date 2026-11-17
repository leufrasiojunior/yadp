const TRANSLATIONS = {
  en: {
    "nav.features": "Features",
    "nav.tour": "Visual Tour",
    "nav.quickstart": "Quick Start",
    "nav.security": "Architecture & Security",
    "nav.docs": "Docs",
    "hero.badge": "Built for Pi-hole v6+ • Self-Hosted Multi-Instance Control Center",
    "hero.titleStart": "One Control Center for",
    "hero.titleHighlight": "All Your Pi-hole Instances",
    "hero.description":
      "Stop jumping between separate admin panels and risking manual configuration drift. YAPD brings your Pi-hole v6+ environments into one auditable surface: desired state management, drift detection, IPv4/IPv6 subnet policies, unified query logs, and safe synchronization.",
    "hero.ctaPrimary": "Quick Start with Docker",
    "hero.ctaSecondary": "Explore Visual Tour",
    "hero.ctaDocs": "Official Docs",
    "hero.pill1": "Desired State & Drift Detection",
    "hero.pill2": "IPv4/IPv6 Subnet Policies",
    "hero.pill3": "AES-256-GCM & Explicit TLS Trust",
    "hero.pill4": "100% Open Source (MIT)",
    "hero.frameStatus": "2 Instances Active",
    "features.eyebrow": "WHY YAPD EXISTS",
    "features.title": "Running one Pi-hole is simple. Running several requires a source of truth.",
    "features.subtitle":
      "Across home labs, VLAN setups, small offices, or family networks, managing redundant Pi-hole servers manually leads to silent drift and fragmented logs. YAPD makes multi-instance operations predictable.",
    "features.withoutBadge": "Without YAPD",
    "features.withoutTitle": "Scattered Manual Administration",
    "features.without1": "Settings, ad-lists, and domain rules quietly drift between primary and secondary nodes.",
    "features.without2":
      "DNS query investigation requires opening multiple browser tabs and correlating timestamps manually.",
    "features.without3": "Blind replication scripts overwrite local state without pre-checks or rollback visibility.",
    "features.without4": "No central audit trail of which rule changed, when, or on which Pi-hole instance.",
    "features.withBadge": "With YAPD",
    "features.withTitle": "Desired State, Drift Detection & Safe Sync",
    "features.with1": "YAPD holds the canonical desired state and highlights exact drift before you apply changes.",
    "features.with2":
      "Consolidated Dashboard and Queries Log aggregate traffic and client activity across all instances.",
    "features.with3": "Per-instance concurrency coordination prevents overwhelming remote Pi-hole v6+ APIs.",
    "features.with4": "Full audit history, operational notifications, and explicit TLS certificate validation.",
    "features.f1Title": "Multi-Instance Dashboard",
    "features.f1Desc":
      "Monitor total queries, blocked requests, block percentages, and 24-hour client activity aggregated across all your Pi-hole v6+ nodes or filtered by individual instance.",
    "features.f2Title": "Sync & Drift Detection",
    "features.f2Desc":
      "Compare live instance configurations against your central baseline. Spot out-of-sync nodes and reconcile changes safely with retries and pre-checks.",
    "features.f3Title": "IPv4 & IPv6 Subnet Policies",
    "features.f3Desc":
      "Assign whole CIDR client networks (VLANs, IoT, Guest, Kids subnets) to Pi-hole filtering groups with per-instance previews and verified replication.",
    "features.f4Title": "Unified Queries & Objects",
    "features.f4Desc":
      "Search DNS query history and centrally organize domains, groups, and ad-lists from one clean operational surface without switching tabs.",
    "features.f5Title": "Security-First by Design",
    "features.f5Desc":
      "Built for LAN/VPN deployments with AES-256-GCM encrypted credentials, HTTP-only session cookies, CSRF protection, and explicit TLS trust per instance.",
    "features.f6Title": "Audit-Focused Operations",
    "features.f6Desc":
      "Keep an explicit record of critical actions, sync jobs, configuration updates, and instance health alerts so nothing changes in the dark.",
    "tour.eyebrow": "INTERACTIVE PRODUCT WALKTHROUGH",
    "tour.title": "Explore Every Screen of YAPD",
    "tour.subtitle":
      "Click through the tabs below (or use your keyboard arrow keys) to inspect how YAPD organizes multi-node Pi-hole administration. Click any screenshot to expand it in full resolution.",
    "tour.tab0": "1. Dashboard",
    "tour.tab1": "2. Overview",
    "tour.tab2": "3. Instances",
    "tour.tab3": "4. Configuration",
    "tour.tab4": "5. Queries Log",
    "tour.tab5": "6. Domains",
    "tour.tab6": "7. Groups",
    "tour.tab7": "8. Ad Lists",
    "tour.tab8": "9. Notifications",
    "tour.zoomBtn": "Expand Screenshot",
    "tour.clickToZoom": "Click to zoom",
    "quickstart.eyebrow": "PRODUCTION DEPLOYMENT",
    "quickstart.title": "Up and Running in 3 Steps with Docker Compose",
    "quickstart.subtitle":
      "YAPD ships with a production-ready Docker Compose stack that bundles PostgreSQL 16 and the YAPD container with an internal Nginx proxy. No cloning or local compilation required.",
    "quickstart.s1Title": "Download the production compose.yml",
    "quickstart.s1Desc": "Fetch the official compose file directly from the repository into your server or homelab host.",
    "quickstart.s2Title": "Configure environment secrets & WEB_ORIGIN",
    "quickstart.s2Desc":
      "Edit compose.yml to set your database password, cryptographic keys, and exact browser origin. Both PostgreSQL password variables must match.",
    "quickstart.secretHelperNote": "Need strong keys right now? Generate random client-side secrets in your browser:",
    "quickstart.generateBtn": "Generate Random Secrets",
    "quickstart.s3Title": "Start the stack & open the dashboard",
    "quickstart.s3Desc":
      "Launch the containers in detached mode. YAPD automatically runs database migrations on startup and publishes HTTP and HTTPS endpoints.",
    "quickstart.httpsNote": "Served via internal Nginx with an auto-generated self-signed TLS certificate.",
    "quickstart.httpNote": "Ideal upstream target when terminating public TLS in Nginx, Caddy, or Nginx Proxy Manager.",
    "security.eyebrow": "ARCHITECTURE & SECURITY BOUNDARIES",
    "security.title": "Engineered for Private Networks with Real Application-Level Controls",
    "security.lead":
      "YAPD is a TypeScript monorepo separating presentation (Next.js App Router + Shadcn UI) from canonical domain logic (NestJS + Prisma + PostgreSQL). Sensitive operations never run in the browser.",
    "security.item1Title": "Zero Hardcoded Admin Credentials:",
    "security.item1Desc": "No fixed default bootstrap account; administrative setup is explicit and protected.",
    "security.item2Title": "Encrypted Pi-hole Secrets (AES-256-GCM):",
    "security.item2Desc": "Instance passwords and sensitive tokens are encrypted at rest and never exposed in read payloads.",
    "security.item3Title": "Explicit Certificate Trust:",
    "security.item3Desc":
      "HTTPS connections validate TLS strictly by default, allowing self-signed certificates only per explicitly consented instance.",
    "security.item4Title": "HTTP-Only Sessions & Anti-CSRF Guard:",
    "security.item4Desc":
      "Cookie-backed sessions with rate limiting, lockouts, and mandatory CSRF header verification on mutating routes.",
    "security.docsCardTitle": "Official Documentation & Guides",
    "security.docsCardDesc":
      "Dive deeper into deployment topologies, reverse proxy headers, subnet policies, and database backup procedures.",
    "security.doc1Title": "YAPD Official Documentation (GitBook)",
    "security.doc1Sub": "Complete administration and architecture reference",
    "security.doc2Title": "Install with Docker Compose",
    "security.doc2Sub": "Step-by-step production setup and environment variables",
    "security.doc3Title": "Reverse Proxy & HTTPS Guide",
    "security.doc3Sub": "Nginx, Caddy, Nginx Proxy Manager & WebSocket headers",
    "security.doc4Title": "Subnet Policies (IPv4 / IPv6)",
    "security.doc4Sub": "CIDR group assignment, previews, and verified sync",
    "security.doc5Title": "PostgreSQL Backup & Restore Guide",
    "security.doc5Sub": "Safeguarding your desired state and audit history",
    "footer.tagline":
      "Yet Another Pi-hole Dashboard — Open-source multi-instance control center for Pi-hole v6+ environments.",
    "footer.releases": "Releases",
    "footer.issues": "Issues & Feedback",
    "footer.docs": "Documentation",
    "footer.disclaimer":
      'YAPD is an independent third-party project. It is not affiliated with, endorsed by, or sponsored by Pi-hole, LLC; "Pi-hole" is referenced only to identify compatibility with Pi-hole installations.',
    "common.copy": "Copy",
    "common.copied": "Copied!",
  },
  "pt-BR": {
    "nav.features": "Recursos",
    "nav.tour": "Tour Visual",
    "nav.quickstart": "Instalação Rápida",
    "nav.security": "Arquitetura e Segurança",
    "nav.docs": "Docs",
    "hero.badge": "Feito para Pi-hole v6+ • Central de Controle Multi-Instância Self-Hosted",
    "hero.titleStart": "Um Único Centro de Controle para",
    "hero.titleHighlight": "Todas as Suas Instâncias Pi-hole",
    "hero.description":
      "Pare de alternar entre vários painéis isolados e correr riscos com edições manuais divergentes. O YAPD reúne seus ambientes Pi-hole v6+ em uma superfície única e auditável: estado desejado, detecção de drift, políticas de sub-rede IPv4/IPv6, consultas consolidadas e sincronização segura.",
    "hero.ctaPrimary": "Instalação Rápida (Docker)",
    "hero.ctaSecondary": "Explorar Tour Visual",
    "hero.ctaDocs": "Documentação Oficial",
    "hero.pill1": "Estado Desejado e Detecção de Drift",
    "hero.pill2": "Políticas de Sub-rede IPv4/IPv6",
    "hero.pill3": "AES-256-GCM e TLS Trust Explícito",
    "hero.pill4": "100% Open Source (MIT)",
    "hero.frameStatus": "2 Instâncias Ativas",
    "features.eyebrow": "POR QUE O YAPD EXISTE",
    "features.title": "Rodar um Pi-hole é simples. Rodar vários exige uma fonte da verdade.",
    "features.subtitle":
      "Em homelabs, redes com VLANs, pequenos escritórios ou redes familiares, gerenciar servidores Pi-hole redundantes manualmente gera divergências silenciosas e logs espalhados. O YAPD torna a operação multi-instância previsível.",
    "features.withoutBadge": "Sem o YAPD",
    "features.withoutTitle": "Administração Manual Fragmentada",
    "features.without1": "Configurações, ad-lists e regras de domínio divergem silenciosamente entre nós primário e secundário.",
    "features.without2":
      "Investigar consultas DNS exige abrir várias abas do navegador e correlacionar horários manualmente.",
    "features.without3": "Scripts de replicação cega sobrescrevem o estado local sem pré-checagem nem visibilidade de erro.",
    "features.without4": "Sem trilha central de auditoria sobre qual regra mudou, quando ou em qual instância Pi-hole.",
    "features.withBadge": "Com o YAPD",
    "features.withTitle": "Estado Desejado, Detecção de Drift e Sync Seguro",
    "features.with1": "O YAPD mantém o estado desejado canônico e destaca divergências antes de você aplicar mudanças.",
    "features.with2":
      "Dashboard e Log de Consultas consolidados agregam o tráfego e a atividade de clientes de todas as instâncias.",
    "features.with3": "Coordenação de concorrência por instância evita sobrecarregar as APIs remotas do Pi-hole v6+.",
    "features.with4": "Histórico completo de auditoria, notificações operacionais e validação explícita de certificados TLS.",
    "features.f1Title": "Dashboard Multi-Instância",
    "features.f1Desc":
      "Monitore o total de consultas, bloqueios, taxa de bloqueio e atividade de clientes nas últimas 24h agregados entre todos os nós Pi-hole v6+ ou filtrados por instância.",
    "features.f2Title": "Sincronização e Detecção de Drift",
    "features.f2Desc":
      "Compare a configuração atual das instâncias com sua linha de base central. Identifique nós fora de sincronia e reconcilie com pré-checagens e retries.",
    "features.f3Title": "Políticas de Sub-rede IPv4 e IPv6",
    "features.f3Desc":
      "Atribua redes CIDR inteiras (VLANs, IoT, Visitantes, Crianças) a grupos de filtragem do Pi-hole com preview por instância e aplicação verificada.",
    "features.f4Title": "Consultas e Objetos Unificados",
    "features.f4Desc":
      "Explore o histórico de consultas DNS e organize domínios, grupos e listas de bloqueio centralmente em uma única interface operacional.",
    "features.f5Title": "Segurança por Design (LAN/VPN)",
    "features.f5Desc":
      "Projetado para redes privadas com credenciais criptografadas em AES-256-GCM, sessões HTTP-only, proteção anti-CSRF e validação TLS explícita.",
    "features.f6Title": "Operações com Trilha de Auditoria",
    "features.f6Desc":
      "Mantenha registro visível de ações críticas, tentativas de sincronização, mudanças de configuração e alertas de saúde das instâncias.",
    "tour.eyebrow": "TOUR INTERATIVO PELO PRODUTO",
    "tour.title": "Explore Cada Tela do YAPD",
    "tour.subtitle":
      "Navegue pelas abas abaixo (ou use as setas do teclado) para conhecer como o YAPD organiza a administração multi-nó do Pi-hole. Clique em qualquer captura para ampliar em resolução máxima.",
    "tour.tab0": "1. Dashboard",
    "tour.tab1": "2. Overview",
    "tour.tab2": "3. Instâncias",
    "tour.tab3": "4. Configuração",
    "tour.tab4": "5. Consultas",
    "tour.tab5": "6. Domínios",
    "tour.tab6": "7. Grupos",
    "tour.tab7": "8. Ad Lists",
    "tour.tab8": "9. Notificações",
    "tour.zoomBtn": "Ampliar Captura",
    "tour.clickToZoom": "Clique para ampliar",
    "quickstart.eyebrow": "DEPLOY EM PRODUÇÃO",
    "quickstart.title": "Pronto para Rodar em 3 Passos com Docker Compose",
    "quickstart.subtitle":
      "O YAPD oferece uma stack Docker Compose de produção pronta para uso, integrando PostgreSQL 16 e o container do YAPD com proxy Nginx interno. Sem necessidade de clonar o repositório ou compilar código.",
    "quickstart.s1Title": "Baixe o compose.yml oficial de produção",
    "quickstart.s1Desc": "Faça o download do arquivo de configuração diretamente para o seu servidor ou host do homelab.",
    "quickstart.s2Title": "Configure os segredos de ambiente e WEB_ORIGIN",
    "quickstart.s2Desc":
      "Edite o compose.yml definindo a senha do banco, chaves criptográficas e a URL exata de acesso no navegador. As duas variáveis de senha do PostgreSQL devem ser iguais.",
    "quickstart.secretHelperNote": "Precisa de chaves fortes agora? Gere segredos aleatórios localmente no seu navegador:",
    "quickstart.generateBtn": "Gerar Segredos Aleatórios",
    "quickstart.s3Title": "Inicie a stack e acesse o dashboard",
    "quickstart.s3Desc":
      "Suba os containers em segundo plano. O YAPD executa as migrações do banco automaticamente na inicialização e publica as portas HTTP e HTTPS.",
    "quickstart.httpsNote": "Servido via Nginx interno com certificado TLS auto-assinado gerado automaticamente.",
    "quickstart.httpNote": "Alvo ideal de upstream ao terminar HTTPS público em Nginx, Caddy ou Nginx Proxy Manager.",
    "security.eyebrow": "ARQUITETURA E LIMITES DE SEGURANÇA",
    "security.title": "Projetado para Redes Privadas com Controles Reais na Aplicação",
    "security.lead":
      "O YAPD é um monorepo TypeScript que separa a apresentação (Next.js App Router + Shadcn UI) da lógica de domínio canônica (NestJS + Prisma + PostgreSQL). Nenhuma regra sensível roda no navegador.",
    "security.item1Title": "Zero Credenciais Admin Hardcoded:",
    "security.item1Desc": "Nenhuma conta padrão fixa ou senha bootstrap estática; a configuração inicial é explícita e segura.",
    "security.item2Title": "Segredos Pi-hole Criptografados (AES-256-GCM):",
    "security.item2Desc": "Senhas de instâncias e tokens são armazenados criptografados e nunca expostos em endpoints de leitura.",
    "security.item3Title": "Confiança Explícita de Certificado TLS:",
    "security.item3Desc":
      "Conexões HTTPS validam certificados no modo STRICT por padrão, permitindo auto-assinados apenas com consentimento por instância.",
    "security.item4Title": "Sessões HTTP-Only e Proteção Anti-CSRF:",
    "security.item4Desc":
      "Sessões protegidas por cookie com rate limiting, bloqueio de tentativas e verificação obrigatória de cabeçalho CSRF.",
    "security.docsCardTitle": "Documentação Oficial e Guias",
    "security.docsCardDesc":
      "Aprofunde-se nas topologias de deploy, configuração de proxy reverso, políticas de sub-rede e rotinas de backup.",
    "security.doc1Title": "Documentação Oficial do YAPD (GitBook)",
    "security.doc1Sub": "Referência completa de administração e arquitetura",
    "security.doc2Title": "Instalação com Docker Compose",
    "security.doc2Sub": "Passo a passo de produção e variáveis de ambiente",
    "security.doc3Title": "Guia de Proxy Reverso e HTTPS",
    "security.doc3Sub": "Nginx, Caddy, Nginx Proxy Manager e cabeçalhos WebSocket",
    "security.doc4Title": "Políticas de Sub-rede (IPv4 / IPv6)",
    "security.doc4Sub": "Atribuição de redes CIDR a grupos, preview e sincronização",
    "security.doc5Title": "Guia de Backup e Restauração do PostgreSQL",
    "security.doc5Sub": "Como proteger seu estado desejado e histórico de auditoria",
    "footer.tagline":
      "Yet Another Pi-hole Dashboard — Central de controle multi-instância open-source para ambientes Pi-hole v6+.",
    "footer.releases": "Releases",
    "footer.issues": "Issues e Feedback",
    "footer.docs": "Documentação",
    "footer.disclaimer":
      'O YAPD é um projeto independente de terceiros. Ele não é afiliado, endossado nem patrocinado pela Pi-hole, LLC; "Pi-hole" é mencionado apenas para identificar compatibilidade com instalações Pi-hole.',
    "common.copy": "Copiar",
    "common.copied": "Copiado!",
  },
};

const TOUR_SCREENS = [
  {
    file: "dashboard.png",
    url: "https://yapd.lan:48443/dashboard",
    en: {
      title: "Consolidated Multi-Instance Dashboard",
      desc: "See your entire DNS environment at a glance. Track total queries, blocked requests, blocking ratio, and hourly client activity combined across all registered Pi-hole instances.",
      bullets: [
        "Aggregated 24-hour query and client activity timelines across instances",
        "Instant instance selector in the top bar (All instances or single node)",
        "Quick blocking toggle with timed presets (10s, 30s, 5m, or custom)",
      ],
    },
    "pt-BR": {
      title: "Dashboard Multi-Instância Consolidado",
      desc: "Visualize todo o seu ambiente DNS de uma só vez. Acompanhe o total de consultas, requisições bloqueadas, percentual de bloqueio e atividade de clientes por hora somados entre todas as instâncias Pi-hole.",
      bullets: [
        "Gráficos agregados de 24 horas de consultas e atividade por cliente",
        "Seletor rápido de escopo no topo (Todas as instâncias ou nó específico)",
        "Controle rápido de bloqueio no menu lateral (Indefinido, 10s, 30s, 5m ou presets)",
      ],
    },
  },
  {
    file: "Overview.png",
    url: "https://yapd.lan:48443/overview",
    en: {
      title: "Operational Overview & Sync Jobs",
      desc: "Follow real-time operational health, recent synchronization jobs, instance connectivity, and traffic summaries from a dedicated command screen.",
      bullets: [
        "Live status of background reconciliation and sync executions",
        "Quick inspection of instance reachability and baseline alignment",
        "Immediate visibility into recent operational events",
      ],
    },
    "pt-BR": {
      title: "Visão Operacional (Overview) e Jobs",
      desc: "Acompanhe a saúde operacional em tempo real, execuções recentes de sincronização, conectividade dos nós e resumos de tráfego em uma tela de comando dedicada.",
      bullets: [
        "Status ao vivo dos jobs de sincronização e reconciliação",
        "Inspeção rápida de alcançabilidade e alinhamento com a baseline",
        "Visibilidade imediata dos últimos eventos operacionais",
      ],
    },
  },
  {
    file: "Instances.png",
    url: "https://yapd.lan:48443/instances",
    en: {
      title: "Registered Pi-hole Instances Management",
      desc: "Manage your Master/Primary and Slave/Secondary Pi-hole v6+ nodes, validate active sessions, configure explicit TLS trust policies, and trigger health checks.",
      bullets: [
        "Explicit TLS certificate mode per instance (STRICT or ALLOW_SELF_SIGNED)",
        "Session validity tracking and one-click connection testing",
        "Clear Master/Primary designation and per-node sync status badges",
      ],
    },
    "pt-BR": {
      title: "Gerenciamento de Instâncias Registradas",
      desc: "Administre seus nós Pi-hole v6+ (Master/Primário e Slave/Secundário), valide sessões ativas, defina políticas explícitas de certificado TLS e execute testes de conexão.",
      bullets: [
        "Modo de confiança TLS explícito por instância (STRICT ou ALLOW_SELF_SIGNED)",
        "Monitoramento de expiração de sessão e validação com um clique",
        "Identificação clara do nó primário e status de sincronia ativo",
      ],
    },
  },
  {
    file: "Configuration.png",
    url: "https://yapd.lan:48443/configuration",
    en: {
      title: "Central Configuration & Drift Detection",
      desc: "Keep your intended Pi-hole configuration in YAPD as the single source of truth. Compare instances before applying updates and detect unexpected drift.",
      bullets: [
        "Side-by-side awareness of desired state versus live instance state",
        "Safe synchronization workflows with pre-checks and retries",
        "Eliminates risky manual edits across separate Pi-hole admin interfaces",
      ],
    },
    "pt-BR": {
      title: "Configuração Central e Detecção de Drift",
      desc: "Mantenha a configuração desejada no YAPD como fonte única da verdade. Compare instâncias antes de aplicar mudanças e detecte divergências inesperadas.",
      bullets: [
        "Comparação clara entre o estado esperado e o estado real de cada instância",
        "Fluxos de sincronização seguros com pré-checagens e retentativas",
        "Elimina edições manuais arriscadas em múltiplos painéis separados",
      ],
    },
  },
  {
    file: "queries.png",
    url: "https://yapd.lan:48443/queries",
    en: {
      title: "Unified DNS Queries Explorer",
      desc: "Investigate DNS queries, client requests, upstream responses, and blocked domains across your network without switching between individual Pi-hole dashboards.",
      bullets: [
        "Filter by domain, client IP/hostname, query type, or blocking status",
        "Correlate DNS activity across primary and secondary servers seamlessly",
        "Fast troubleshooting for false positives or chatty IoT devices",
      ],
    },
    "pt-BR": {
      title: "Explorador Unificado de Consultas DNS",
      desc: "Investigue consultas DNS, clientes, respostas de upstream e domínios bloqueados em toda a rede sem precisar alternar entre painéis Pi-hole individuais.",
      bullets: [
        "Filtros rápidos por domínio, cliente, tipo de registro ou status de bloqueio",
        "Correlação ágil de tráfego entre servidores DNS primário e secundário",
        "Diagnóstico rápido de falsos positivos ou dispositivos IoT ruidosos",
      ],
    },
  },
  {
    file: "domains.png",
    url: "https://yapd.lan:48443/domains",
      en: {
      title: "Centralized Domains (Allow & Deny Rules)",
      desc: "Create, review, and synchronize exact or regex domain rules across all your Pi-hole instances from one organized catalog.",
      bullets: [
        "Manage exact allowlists, denylists, and regular expression filters",
        "Associate domain rules with specific filtering groups",
        "Default multi-instance scope keeps all nodes consistent automatically",
      ],
    },
    "pt-BR": {
      title: "Gestão Centralizada de Domínios (Allow & Deny)",
      desc: "Crie, revise e sincronize regras de domínios exatos ou expressões regulares (regex) em todas as suas instâncias Pi-hole a partir de um único catálogo.",
      bullets: [
        "Gerencie listas de permissão (allow), bloqueio (deny) e filtros regex",
        "Associe regras de domínio a grupos específicos de filtragem",
        "Escopo multi-instância padrão mantém todos os nós sempre consistentes",
      ],
    },
  },
  {
    file: "groups.png",
    url: "https://yapd.lan:48443/groups",
    en: {
      title: "Filtering Groups & Subnet Policies",
      desc: "Organize filtering groups and assign IPv4/IPv6 client subnets so different network segments (Kids, IoT, Guest, Lab) receive tailored DNS policies.",
      bullets: [
        "Create and toggle filtering groups with instant replication",
        "Pair groups with CIDR subnet policies for VLAN-aware DNS filtering",
        "Per-instance preview and verified application across nodes",
      ],
    },
    "pt-BR": {
      title: "Grupos de Filtragem e Políticas de Sub-rede",
      desc: "Organize grupos de filtragem e atribua sub-redes IPv4/IPv6 para aplicar políticas DNS sob medida em cada segmento de rede (IoT, Visitantes, Família, Lab).",
      bullets: [
        "Crie, edite e ative/desative grupos com replicação imediata",
        "Combine grupos com políticas CIDR para filtragem DNS por VLAN",
        "Preview por instância e aplicação verificada em todos os nós",
      ],
    },
  },
  {
    file: "ad-lists.png",
    url: "https://yapd.lan:48443/ad-lists",
    en: {
      title: "Synchronized Ad Lists Management",
      desc: "Maintain blocklist subscriptions centrally. Add, enable, or assign ad-lists to groups once and keep every Pi-hole instance aligned.",
      bullets: [
        "Central inventory of active and disabled blocklists",
        "Group assignment support for granular blocking profiles",
        "Prevents blocklist drift between redundant DNS servers",
      ],
    },
    "pt-BR": {
      title: "Gerenciamento Sincronizado de Ad Lists",
      desc: "Mantenha suas listas de bloqueio centralizadas. Adicione, ative ou vincule ad-lists a grupos uma única vez e mantenha todos os Pi-holes alinhados.",
      bullets: [
        "Inventário centralizado de listas de bloqueio ativas e inativas",
        "Suporte a vínculo por grupos para perfis granulares de bloqueio",
        "Evita divergência de listas entre servidores DNS redundantes",
      ],
    },
  },
  {
    file: "notifications.png",
    url: "https://yapd.lan:48443/notifications",
    en: {
      title: "Operational Notifications & Event Trail",
      desc: "Stay informed about sync anomalies, unreachable instances, certificate warnings, and administrative events through YAPD's built-in notification center.",
      bullets: [
        "Actionable alerts for instance health and synchronization outcomes",
        "Web Push notification support for HTTPS deployments",
        "Clear historical visibility for day-to-day network operations",
      ],
    },
    "pt-BR": {
      title: "Notificações Operacionais e Trilha de Eventos",
      desc: "Acompanhe anomalias de sincronização, instâncias inacessíveis, avisos de certificado e eventos administrativos pela central de notificações integrada.",
      bullets: [
        "Alertas acionáveis sobre saúde das instâncias e resultados de sync",
        "Suporte a notificações Web Push em ambientes HTTPS confiáveis",
        "Visibilidade histórica clara para a operação diária da rede",
      ],
    },
  },
];

let currentLang = "en";
let currentTourIndex = 0;
let mediaPrefix = "media/";

function detectMediaPrefix() {
  const probe = new Image();
  probe.onload = () => {
    mediaPrefix = "media/";
  };
  probe.onerror = () => {
    mediaPrefix = "../media/";
    updateAllMediaPaths();
  };
  probe.src = "media/dashboard.png";
}

function updateAllMediaPaths() {
  const heroImg = document.querySelector(".hero-img");
  if (heroImg) {
    heroImg.src = `${mediaPrefix}dashboard.png`;
    heroImg.setAttribute("data-lightbox-src", `${mediaPrefix}dashboard.png`);
  }
  renderTourStep(currentTourIndex);
}

function applyLanguage(lang) {
  currentLang = TRANSLATIONS[lang] ? lang : "en";
  document.documentElement.lang = currentLang;

  try {
    localStorage.setItem("yapd_lp_lang", currentLang);
  } catch {
    // Ignore storage errors in restricted modes
  }

  const dict = TRANSLATIONS[currentLang];
  const elements = document.querySelectorAll("[data-i18n]");
  for (const el of elements) {
    const key = el.getAttribute("data-i18n");
    if (key && dict[key]) {
      el.textContent = dict[key];
    }
  }

  const langBtns = document.querySelectorAll("[data-lang-btn]");
  for (const btn of langBtns) {
    const isMatch = btn.getAttribute("data-lang-btn") === currentLang;
    btn.classList.toggle("active", isMatch);
    btn.setAttribute("aria-pressed", String(isMatch));
  }

  renderTourStep(currentTourIndex);
}

function renderTourStep(index) {
  const total = TOUR_SCREENS.length;
  currentTourIndex = (index + total) % total;
  const item = TOUR_SCREENS[currentTourIndex];
  const copy = item[currentLang] || item.en;

  const counterEl = document.getElementById("tour-counter");
  const titleEl = document.getElementById("tour-title");
  const descEl = document.getElementById("tour-desc");
  const bulletsEl = document.getElementById("tour-bullets");
  const urlEl = document.getElementById("tour-url");
  const imgEl = document.getElementById("tour-image");

  if (counterEl) {
    counterEl.textContent = `0${currentTourIndex + 1} / 0${total}`;
  }
  if (titleEl) {
    titleEl.textContent = copy.title;
  }
  if (descEl) {
    descEl.textContent = copy.desc;
  }
  if (urlEl) {
    urlEl.textContent = item.url;
  }
  if (imgEl) {
    imgEl.src = `${mediaPrefix}${item.file}`;
    imgEl.alt = copy.title;
  }
  if (bulletsEl) {
    bulletsEl.innerHTML = "";
    for (const bullet of copy.bullets) {
      const li = document.createElement("li");
      li.textContent = bullet;
      bulletsEl.appendChild(li);
    }
  }

  const tabs = document.querySelectorAll(".tour-tab");
  for (const tab of tabs) {
    const tabIdx = Number(tab.getAttribute("data-tour-index"));
    const isActive = tabIdx === currentTourIndex;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  }
}

function generateRandomHex(byteLength) {
  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function handleGenerateSecrets() {
  const dbPass = generateRandomHex(16);
  const sessionSecret = generateRandomHex(32);
  const encryptionKey = generateRandomHex(32);

  const codeBlock = document.getElementById("cmd-step-2");
  if (!codeBlock) {
    return;
  }

  codeBlock.textContent = `# In services.postgres.environment:
- POSTGRES_PASSWORD=${dbPass}

# In services.yapd.environment:
- WEB_ORIGIN=https://yapd.example.com
- YAPD_POSTGRES_PASSWORD=${dbPass}
- SESSION_SECRET=${sessionSecret}
- APP_ENCRYPTION_KEY=${encryptionKey}`;
}

function setupCopyButtons() {
  const copyBtns = document.querySelectorAll(".copy-btn");
  for (const btn of copyBtns) {
    btn.addEventListener("click", async () => {
      const targetId = btn.getAttribute("data-copy-target");
      const targetEl = targetId ? document.getElementById(targetId) : null;
      if (!targetEl) {
        return;
      }

      const text = targetEl.textContent || "";
      try {
        await navigator.clipboard.writeText(text);
        const label = btn.querySelector(".copy-label");
        const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
        btn.classList.add("copied");
        if (label) {
          label.textContent = dict["common.copied"];
        }
        setTimeout(() => {
          btn.classList.remove("copied");
          if (label) {
            label.textContent = (TRANSLATIONS[currentLang] || TRANSLATIONS.en)["common.copy"];
          }
        }, 1800);
      } catch {
        // Clipboard API fallback ignored
      }
    });
  }
}

function setupLightbox() {
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxCaption = document.getElementById("lightbox-caption");
  const closeBtn = document.getElementById("lightbox-close");
  const backdrop = document.getElementById("lightbox-backdrop");

  function openLightbox(src, caption) {
    if (!lightbox || !lightboxImg) {
      return;
    }
    lightboxImg.src = src;
    if (lightboxCaption) {
      lightboxCaption.textContent = caption || "YAPD";
    }
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
  }

  function closeLightbox() {
    if (!lightbox) {
      return;
    }
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
  }

  const heroImg = document.querySelector(".hero-img");
  if (heroImg) {
    heroImg.addEventListener("click", () => {
      openLightbox(heroImg.src, "YAPD — Multi-Instance Dashboard");
    });
  }

  const tourFrame = document.getElementById("tour-frame-clickable");
  const tourZoomBtn = document.getElementById("tour-zoom-trigger");

  const openCurrentTourLightbox = () => {
    const item = TOUR_SCREENS[currentTourIndex];
    const copy = item[currentLang] || item.en;
    openLightbox(`${mediaPrefix}${item.file}`, copy.title);
  };

  if (tourFrame) {
    tourFrame.addEventListener("click", openCurrentTourLightbox);
    tourFrame.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openCurrentTourLightbox();
      }
    });
  }

  if (tourZoomBtn) {
    tourZoomBtn.addEventListener("click", openCurrentTourLightbox);
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeLightbox);
  }
  if (backdrop) {
    backdrop.addEventListener("click", closeLightbox);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox && lightbox.classList.contains("open")) {
      closeLightbox();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  detectMediaPrefix();

  // Initialize language from localStorage or browser preference
  let initialLang = "en";
  try {
    const saved = localStorage.getItem("yapd_lp_lang");
    if (saved && TRANSLATIONS[saved]) {
      initialLang = saved;
    } else if (navigator.language && navigator.language.toLowerCase().startsWith("pt")) {
      initialLang = "pt-BR";
    }
  } catch {
    initialLang = "en";
  }

  applyLanguage(initialLang);

  // Language switcher buttons
  const langBtns = document.querySelectorAll("[data-lang-btn]");
  for (const btn of langBtns) {
    btn.addEventListener("click", () => {
      const selected = btn.getAttribute("data-lang-btn");
      if (selected) {
        applyLanguage(selected);
      }
    });
  }

  // Tour tab buttons
  const tabs = document.querySelectorAll(".tour-tab");
  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      const idx = Number(tab.getAttribute("data-tour-index"));
      renderTourStep(idx);
    });
    tab.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        renderTourStep(currentTourIndex + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        renderTourStep(currentTourIndex - 1);
      }
    });
  }

  const prevBtn = document.getElementById("tour-prev");
  const nextBtn = document.getElementById("tour-next");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => renderTourStep(currentTourIndex - 1));
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => renderTourStep(currentTourIndex + 1));
  }

  const genSecretsBtn = document.getElementById("btn-generate-secrets");
  if (genSecretsBtn) {
    genSecretsBtn.addEventListener("click", handleGenerateSecrets);
  }

  setupCopyButtons();
  setupLightbox();
});
