import { type AppLocale, DEFAULT_LOCALE } from "./config";

type WebMessages = {
  common: {
    language: string;
    languagePlaceholder: string;
    retry: string;
    baseline: string;
    total: string;
    versionUnavailable: string;
    notConfigured: string;
  };
  apiUnavailable: {
    badge: string;
    title: string;
    description: string;
    helpTitle: string;
    helpDescription: (apiBaseUrl: string) => string;
    retry: string;
  };
  apiError: {
    badge: string;
    title: string;
    helpTitle: string;
    helpDescription: (apiBaseUrl: string, status?: number) => string;
  };
  external: {
    setup: {
      badge: string;
      title: string;
      description: string;
      technicalSecret: string;
      interactiveLogin: string;
      formTitle: string;
      formDescription: string;
      unavailableTitle: string;
      unavailableDescription: string;
    };
    login: {
      badge: string;
      title: string;
      description: string;
      ephemeralPassword: string;
      serviceSecrets: string;
      unavailableTitle: string;
      unavailableDescription: string;
    };
  };
  forms: {
    setup: {
      validation: {
        name: string;
        baseUrl: string;
        password: string;
      };
      defaults: {
        name: string;
        baseUrl: string;
      };
      toasts: {
        success: string;
      };
      fields: {
        name: string;
        baseUrl: string;
        baseUrlDescription: string;
        password: string;
        passwordDescription: string;
        totp: string;
        allowSelfSigned: string;
        allowSelfSignedDescription: string;
        certificate: string;
      };
      errors: {
        title: string;
      };
      submit: {
        idle: string;
        loading: string;
      };
    };
    login: {
      validation: {
        password: string;
      };
      toasts: {
        success: (baselineName: string) => string;
      };
      fields: {
        password: string;
        passwordDescription: string;
        totp: string;
      };
      submit: {
        idle: string;
        loading: string;
      };
    };
    instances: {
      validation: {
        name: string;
        baseUrl: string;
        password: string;
      };
      toasts: {
        refreshFailed: string;
        createSuccess: string;
        discoverSuccess: string;
        testSuccess: string;
        reauthenticateSuccess: string;
      };
      create: {
        title: string;
        description: string;
        name: string;
        baseUrl: string;
        password: string;
        passwordDescription: string;
        allowSelfSigned: string;
        certificate: string;
        validationFailedTitle: string;
        submitIdle: string;
        submitLoading: string;
      };
      discovery: {
        title: string;
        description: string;
        candidates: string;
        candidatesDescription: string;
        empty: string;
        reachable: string;
        unreachable: string;
        submitIdle: string;
        submitLoading: string;
      };
      table: {
        title: string;
        description: string;
        name: string;
        baseUrl: string;
        trust: string;
        version: string;
        lastValidation: string;
        session: string;
        validUntil: string;
        lastError: string;
        actions: string;
        baseline: string;
        managed: string;
        humanMaster: string;
        storedSecret: string;
        testIdle: string;
        testLoading: string;
        reauthenticateIdle: string;
        reauthenticateLoading: string;
        statusActive: string;
        statusExpired: string;
        statusMissing: string;
        statusError: string;
      };
      page: {
        eyebrow: string;
        title: string;
        totalDescription: (count: number) => string;
        totalCaption: string;
      };
    };
  };
  layout: {
    overviewButton: string;
    instancesButton: string;
    unavailableTitle: string;
    unavailableDescription: string;
  };
  sidebar: {
    groups: {
      overview: string;
      operations: string;
      status: string;
    };
    items: {
      dashboard: string;
      instances: string;
      baselineLogin: string;
      setupBaseline: string;
      apiHealth: string;
    };
    search: {
      button: string;
      placeholder: string;
      empty: string;
      group: string;
    };
    user: {
      logoutError: string;
      role: string;
      proxy: string;
      authority: string;
      logout: string;
    };
    statusCard: {
      title: string;
      description: string;
    };
    controls: {
      title: string;
      description: string;
      language: string;
      themePreset: string;
      font: string;
      fontPlaceholder: string;
      themeMode: string;
      light: string;
      dark: string;
      system: string;
      pageLayout: string;
      centered: string;
      fullWidth: string;
      navbarBehavior: string;
      sticky: string;
      scroll: string;
      sidebarStyle: string;
      inset: string;
      sidebar: string;
      floating: string;
      sidebarCollapseMode: string;
      icon: string;
      offcanvas: string;
      restore: string;
    };
  };
  dashboard: {
    eyebrow: string;
    title: string;
    scope: {
      label: string;
      allInstances: string;
      placeholder: string;
    };
    cards: {
      totalQueries: string;
      queriesBlocked: string;
      percentageBlocked: string;
      domainsOnList: string;
    };
    charts: {
      totalQueriesTitle: string;
      totalQueriesDescription: (count: number) => string;
      clientActivityTitle: string;
      clientActivityDescription: (count: number) => string;
      noData: string;
    };
    partial: {
      title: string;
      description: (failedCount: number, totalCount: number) => string;
    };
    toasts: {
      instanceFailure: (instanceName: string, message: string) => string;
      genericInstanceFailure: (instanceName: string) => string;
    };
  };
};

const messages: Record<AppLocale, WebMessages> = {
  "pt-BR": {
    common: {
      language: "Idioma",
      languagePlaceholder: "Selecione o idioma",
      retry: "Tentar novamente",
      baseline: "Baseline",
      total: "Total",
      versionUnavailable: "-",
      notConfigured: "Não configurada",
    },
    apiUnavailable: {
      badge: "YAPD API",
      title: "Backend indisponível",
      description: "O frontend iniciou, mas não conseguiu falar com o backend do YAPD.",
      helpTitle: "Como liberar o frontend",
      helpDescription: (apiBaseUrl) =>
        `Inicie o backend com npm run dev:api e confirme que ele está respondendo em ${apiBaseUrl}.`,
      retry: "Tentar novamente",
    },
    apiError: {
      badge: "YAPD API",
      title: "O backend respondeu com erro",
      helpTitle: "O que verificar",
      helpDescription: (apiBaseUrl, status) =>
        `Confira os logs da API, o schema do banco e tente novamente.${status ? ` Status HTTP: ${status}.` : ""} Backend: ${apiBaseUrl}.`,
    },
    external: {
      setup: {
        badge: "Setup inicial",
        title: "Defina a baseline do YAPD",
        description:
          "Esse primeiro passo registra a instância Pi-hole que vai autenticar a interface e servir como autoridade principal do produto.",
        technicalSecret:
          "O backend valida a conectividade e guarda apenas a credencial técnica da baseline de forma criptografada.",
        interactiveLogin:
          "O login humano do painel vai usar o fluxo oficial do Pi-hole v6 para gerar o SID da sessão proxy.",
        formTitle: "Configurar baseline",
        formDescription: "Preencha a instância principal do ambiente para liberar o login do produto.",
        unavailableTitle: "Não foi possível abrir o setup",
        unavailableDescription:
          "O setup depende do backend para validar a baseline, criptografar o segredo técnico e salvar a configuração inicial.",
      },
      login: {
        badge: "Login da baseline",
        title: "Entre usando o Pi-hole principal",
        description:
          "O YAPD usa o endpoint oficial de login do Pi-hole v6 para obter um SID e criar a sessão segura do painel.",
        ephemeralPassword: "Senha e TOTP são enviados apenas para a baseline e não ficam gravados no banco do YAPD.",
        serviceSecrets:
          "As outras instâncias seguem com segredos técnicos próprios para testes, import e operações futuras.",
        unavailableTitle: "Não foi possível abrir o login",
        unavailableDescription:
          "O login depende do backend para consultar a baseline, abrir a sessão proxy e gravar o cookie seguro do YAPD.",
      },
    },
    forms: {
      setup: {
        validation: {
          name: "Informe um nome para a baseline.",
          baseUrl: "Use uma URL completa, como https://pi.hole.",
          password: "Informe a senha ou application password do Pi-hole.",
        },
        defaults: {
          name: "Pi-hole Principal",
          baseUrl: "https://pi.hole",
        },
        toasts: {
          success: "Baseline configurada com sucesso.",
        },
        fields: {
          name: "Nome da baseline",
          baseUrl: "Base URL",
          baseUrlDescription: "Use o host principal que será a autoridade de login do produto.",
          password: "Senha/Application password",
          passwordDescription: "Essa credencial será guardada criptografada para operações técnicas do backend.",
          totp: "TOTP opcional",
          allowSelfSigned: "Permitir certificado self-signed explicitamente",
          allowSelfSignedDescription: "Use apenas quando o Pi-hole tiver um certificado local que você confia.",
          certificate: "CA personalizada opcional",
        },
        errors: {
          title: "Falha ao validar a baseline",
        },
        submit: {
          idle: "Salvar baseline",
          loading: "Validando baseline...",
        },
      },
      login: {
        validation: {
          password: "Informe a senha do Pi-hole.",
        },
        toasts: {
          success: (baselineName) => `Sessão criada via ${baselineName}.`,
        },
        fields: {
          password: "Senha do Pi-hole",
          passwordDescription: "O backend não persiste essa senha. Ela só serve para obter o SID atual da interface.",
          totp: "Código TOTP opcional",
        },
        submit: {
          idle: "Entrar no YAPD",
          loading: "Abrindo sessão...",
        },
      },
      instances: {
        validation: {
          name: "Informe um nome.",
          baseUrl: "Use uma URL completa.",
          password: "Informe a senha ou application password.",
        },
        toasts: {
          refreshFailed: "Não foi possível atualizar a lista de instâncias.",
          createSuccess: "Instância cadastrada com sucesso.",
          discoverSuccess: "Descoberta executada.",
          testSuccess: "Conexão validada com sucesso.",
          reauthenticateSuccess: "Sessão da instância renovada com sucesso.",
        },
        create: {
          title: "Cadastrar instância",
          description: "Salve uma credencial técnica para o backend operar sobre outro Pi-hole.",
          name: "Nome",
          baseUrl: "Base URL",
          password: "Senha/Application password",
          passwordDescription: "O backend vai testar a autenticação antes de salvar a instância.",
          allowSelfSigned: "Permitir self-signed explicitamente",
          certificate: "CA personalizada opcional",
          validationFailedTitle: "Falha ao validar a instância",
          submitIdle: "Salvar instância",
          submitLoading: "Validando...",
        },
        discovery: {
          title: "Descoberta assistida",
          description: "Informe candidatos para o backend verificar se respondem como Pi-hole.",
          candidates: "Candidatos",
          candidatesDescription: "Use uma URL por linha ou separadas por vírgula.",
          empty: "Nenhum resultado ainda. Rode a descoberta para testar candidatos.",
          reachable: "Pi-hole respondeu ao endpoint /auth.",
          unreachable: "Não foi possível conectar.",
          submitIdle: "Executar descoberta",
          submitLoading: "Buscando...",
        },
        table: {
          title: "Instâncias cadastradas",
          description: "Teste as conexões salvas e acompanhe a baseline atual.",
          name: "Nome",
          baseUrl: "Base URL",
          trust: "Trust",
          version: "Versão",
          lastValidation: "Última validação",
          session: "Sessão",
          validUntil: "Válida até",
          lastError: "Último erro",
          actions: "Ações",
          baseline: "Baseline",
          managed: "Instância gerenciada",
          humanMaster: "Login humano master",
          storedSecret: "Segredo salvo",
          testIdle: "Testar",
          testLoading: "Testando...",
          reauthenticateIdle: "Reautenticar",
          reauthenticateLoading: "Reautenticando...",
          statusActive: "Ativa",
          statusExpired: "Expirada",
          statusMissing: "Sem SID",
          statusError: "Com erro",
        },
        page: {
          eyebrow: "Infraestrutura gerenciada",
          title: "Instâncias",
          totalDescription: (count) => `${count} instâncias`,
          totalCaption: "Incluindo a baseline principal.",
        },
      },
    },
    layout: {
      overviewButton: "Visão geral",
      instancesButton: "Instâncias",
      unavailableTitle: "O painel não conseguiu falar com o backend",
      unavailableDescription:
        "A área autenticada precisa do backend para validar a baseline, ler a sessão atual e responder as rotas de gerenciamento.",
    },
    sidebar: {
      groups: {
        overview: "Visão geral",
        operations: "Operações",
        status: "Status",
      },
      items: {
        dashboard: "Dashboard",
        instances: "Instâncias",
        baselineLogin: "Login da baseline",
        setupBaseline: "Setup da baseline",
        apiHealth: "Saúde da API",
      },
      search: {
        button: "Acesso rápido",
        placeholder: "Encontre rotas e ações…",
        empty: "Nenhum resultado encontrado.",
        group: "Workspace",
      },
      user: {
        logoutError: "Não foi possível encerrar a sessão.",
        role: "Operador da baseline",
        proxy: "Sessão proxy",
        authority: "Autoridade Pi-hole",
        logout: "Sair",
      },
      statusCard: {
        title: "Status do slice 1",
        description: "Setup, login e gerenciamento de instâncias já estão conectados para a primeira entrega do YAPD.",
      },
      controls: {
        title: "Preferências",
        description: "Personalize o idioma e o layout do seu painel.",
        language: "Idioma",
        themePreset: "Preset do tema",
        font: "Fonte",
        fontPlaceholder: "Selecione a fonte",
        themeMode: "Modo do tema",
        light: "Claro",
        dark: "Escuro",
        system: "Sistema",
        pageLayout: "Layout da página",
        centered: "Centralizado",
        fullWidth: "Largura total",
        navbarBehavior: "Comportamento da barra",
        sticky: "Fixa",
        scroll: "Rolagem",
        sidebarStyle: "Estilo da sidebar",
        inset: "Inset",
        sidebar: "Sidebar",
        floating: "Flutuante",
        sidebarCollapseMode: "Modo de recolhimento",
        icon: "Ícone",
        offcanvas: "Offcanvas",
        restore: "Restaurar padrões",
      },
    },
    dashboard: {
      eyebrow: "Visão consolidada das instâncias Pi-hole",
      title: "Dashboard",
      scope: {
        label: "Escopo do dashboard",
        allInstances: "Todas as instâncias",
        placeholder: "Selecione uma instância",
      },
      cards: {
        totalQueries: "Total Queries",
        queriesBlocked: "Queries Blocked",
        percentageBlocked: "Percentage Blocked",
        domainsOnList: "Domains on list",
      },
      charts: {
        totalQueriesTitle: "Total Queries",
        totalQueriesDescription: (count) =>
          count === 1
            ? "Últimas 24 horas da instância selecionada, em janelas de 1 hora."
            : `Últimas 24 horas agregadas entre ${count} instâncias, em janelas de 1 hora.`,
        clientActivityTitle: "Client activity",
        clientActivityDescription: (count) =>
          count === 1
            ? "Clientes da instância selecionada nas últimas 24 horas, em janelas de 1 hora."
            : `Top clientes somados entre ${count} instâncias nas últimas 24 horas, em janelas de 1 hora.`,
        noData: "Sem dados suficientes para montar este gráfico ainda.",
      },
      partial: {
        title: "Dashboard parcial",
        description: (failedCount, totalCount) =>
          failedCount === 1
            ? `1 de ${totalCount} instância falhou ao carregar métricas. Os dados abaixo somam apenas as instâncias saudáveis.`
            : `${failedCount} de ${totalCount} instâncias falharam ao carregar métricas. Os dados abaixo somam apenas as instâncias saudáveis.`,
      },
      toasts: {
        instanceFailure: (instanceName, message) => `${instanceName}: ${message}`,
        genericInstanceFailure: (instanceName) =>
          `${instanceName}: não foi possível carregar as métricas desta instância.`,
      },
    },
  },
  "en-US": {
    common: {
      language: "Language",
      languagePlaceholder: "Select language",
      retry: "Try again",
      baseline: "Baseline",
      total: "Total",
      versionUnavailable: "-",
      notConfigured: "Not configured",
    },
    apiUnavailable: {
      badge: "YAPD API",
      title: "Backend unavailable",
      description: "The frontend started, but it could not reach the YAPD backend.",
      helpTitle: "How to unblock the frontend",
      helpDescription: (apiBaseUrl) =>
        `Start the backend with npm run dev:api and confirm it is responding at ${apiBaseUrl}.`,
      retry: "Try again",
    },
    apiError: {
      badge: "YAPD API",
      title: "The backend returned an error",
      helpTitle: "What to check",
      helpDescription: (apiBaseUrl, status) =>
        `Check the API logs, verify the database schema, and try again.${status ? ` HTTP status: ${status}.` : ""} Backend: ${apiBaseUrl}.`,
    },
    external: {
      setup: {
        badge: "Initial setup",
        title: "Define the YAPD baseline",
        description:
          "This first step registers the Pi-hole instance that will authenticate the interface and act as the product's primary authority.",
        technicalSecret:
          "The backend validates connectivity and stores only the baseline technical credential in encrypted form.",
        interactiveLogin: "Human login uses the official Pi-hole v6 flow to generate the SID for the proxy session.",
        formTitle: "Configure baseline",
        formDescription: "Fill in the main environment instance to unlock product login.",
        unavailableTitle: "Could not open setup",
        unavailableDescription:
          "Setup depends on the backend to validate the baseline, encrypt the technical secret, and save the initial configuration.",
      },
      login: {
        badge: "Baseline login",
        title: "Sign in with the primary Pi-hole",
        description:
          "YAPD uses the official Pi-hole v6 login endpoint to obtain an SID and create the dashboard's secure session.",
        ephemeralPassword: "Password and TOTP are sent only to the baseline and are never stored in the YAPD database.",
        serviceSecrets: "Other instances keep their own technical secrets for tests, imports, and future operations.",
        unavailableTitle: "Could not open login",
        unavailableDescription:
          "Login depends on the backend to query the baseline, open the proxy session, and store the secure YAPD cookie.",
      },
    },
    forms: {
      setup: {
        validation: {
          name: "Provide a baseline name.",
          baseUrl: "Use a full URL, such as https://pi.hole.",
          password: "Provide the Pi-hole password or application password.",
        },
        defaults: {
          name: "Primary Pi-hole",
          baseUrl: "https://pi.hole",
        },
        toasts: {
          success: "Baseline configured successfully.",
        },
        fields: {
          name: "Baseline name",
          baseUrl: "Base URL",
          baseUrlDescription: "Use the primary host that will act as the product login authority.",
          password: "Password/Application password",
          passwordDescription: "This credential is stored encrypted for backend technical operations.",
          totp: "Optional TOTP",
          allowSelfSigned: "Explicitly allow a self-signed certificate",
          allowSelfSignedDescription: "Use this only when the Pi-hole has a local certificate you trust.",
          certificate: "Optional custom CA",
        },
        errors: {
          title: "Baseline validation failed",
        },
        submit: {
          idle: "Save baseline",
          loading: "Validating baseline...",
        },
      },
      login: {
        validation: {
          password: "Provide the Pi-hole password.",
        },
        toasts: {
          success: (baselineName) => `Session created through ${baselineName}.`,
        },
        fields: {
          password: "Pi-hole password",
          passwordDescription: "The backend does not persist this password. It is only used to obtain the current SID.",
          totp: "Optional TOTP code",
        },
        submit: {
          idle: "Sign in to YAPD",
          loading: "Opening session...",
        },
      },
      instances: {
        validation: {
          name: "Provide a name.",
          baseUrl: "Use a full URL.",
          password: "Provide the password or application password.",
        },
        toasts: {
          refreshFailed: "Could not refresh the instance list.",
          createSuccess: "Instance created successfully.",
          discoverSuccess: "Discovery completed.",
          testSuccess: "Connection validated successfully.",
          reauthenticateSuccess: "Instance session renewed successfully.",
        },
        create: {
          title: "Register instance",
          description: "Store a technical credential so the backend can operate on another Pi-hole.",
          name: "Name",
          baseUrl: "Base URL",
          password: "Password/Application password",
          passwordDescription: "The backend validates authentication before saving the instance.",
          allowSelfSigned: "Explicitly allow self-signed",
          certificate: "Optional custom CA",
          validationFailedTitle: "Instance validation failed",
          submitIdle: "Save instance",
          submitLoading: "Validating...",
        },
        discovery: {
          title: "Guided discovery",
          description: "Provide candidates for the backend to verify as Pi-hole endpoints.",
          candidates: "Candidates",
          candidatesDescription: "Use one URL per line or separate them with commas.",
          empty: "No results yet. Run discovery to test candidates.",
          reachable: "Pi-hole responded to the /auth endpoint.",
          unreachable: "Could not connect.",
          submitIdle: "Run discovery",
          submitLoading: "Searching...",
        },
        table: {
          title: "Registered instances",
          description: "Test saved connections and keep track of the current baseline.",
          name: "Name",
          baseUrl: "Base URL",
          trust: "Trust",
          version: "Version",
          lastValidation: "Last validation",
          session: "Session",
          validUntil: "Valid until",
          lastError: "Last error",
          actions: "Actions",
          baseline: "Baseline",
          managed: "Managed instance",
          humanMaster: "Human master login",
          storedSecret: "Stored secret",
          testIdle: "Test",
          testLoading: "Testing...",
          reauthenticateIdle: "Reauthenticate",
          reauthenticateLoading: "Reauthenticating...",
          statusActive: "Active",
          statusExpired: "Expired",
          statusMissing: "No SID",
          statusError: "Error",
        },
        page: {
          eyebrow: "Managed infrastructure",
          title: "Instances",
          totalDescription: (count) => `${count} instances`,
          totalCaption: "Including the primary baseline.",
        },
      },
    },
    layout: {
      overviewButton: "Overview",
      instancesButton: "Instances",
      unavailableTitle: "The dashboard could not reach the backend",
      unavailableDescription:
        "The authenticated area needs the backend to validate the baseline, read the current session, and answer management routes.",
    },
    sidebar: {
      groups: {
        overview: "Overview",
        operations: "Operations",
        status: "Status",
      },
      items: {
        dashboard: "Dashboard",
        instances: "Instances",
        baselineLogin: "Baseline login",
        setupBaseline: "Baseline setup",
        apiHealth: "API health",
      },
      search: {
        button: "Quick jump",
        placeholder: "Find routes and actions…",
        empty: "No results found.",
        group: "Workspace",
      },
      user: {
        logoutError: "Could not end the session.",
        role: "Baseline operator",
        proxy: "Proxy session",
        authority: "Pi-hole authority",
        logout: "Log out",
      },
      statusCard: {
        title: "Slice 1 status",
        description: "Setup, login, and instance management are already wired for the first YAPD delivery.",
      },
      controls: {
        title: "Preferences",
        description: "Customize the language and layout of your dashboard.",
        language: "Language",
        themePreset: "Theme preset",
        font: "Font",
        fontPlaceholder: "Select font",
        themeMode: "Theme mode",
        light: "Light",
        dark: "Dark",
        system: "System",
        pageLayout: "Page layout",
        centered: "Centered",
        fullWidth: "Full width",
        navbarBehavior: "Navbar behavior",
        sticky: "Sticky",
        scroll: "Scroll",
        sidebarStyle: "Sidebar style",
        inset: "Inset",
        sidebar: "Sidebar",
        floating: "Floating",
        sidebarCollapseMode: "Sidebar collapse mode",
        icon: "Icon",
        offcanvas: "Offcanvas",
        restore: "Restore defaults",
      },
    },
    dashboard: {
      eyebrow: "Consolidated view of your Pi-hole instances",
      title: "Dashboard",
      scope: {
        label: "Dashboard scope",
        allInstances: "All instances",
        placeholder: "Select an instance",
      },
      cards: {
        totalQueries: "Total Queries",
        queriesBlocked: "Queries Blocked",
        percentageBlocked: "Percentage Blocked",
        domainsOnList: "Domains on list",
      },
      charts: {
        totalQueriesTitle: "Total Queries",
        totalQueriesDescription: (count) =>
          count === 1
            ? "Last 24 hours for the selected instance, grouped into 1-hour windows."
            : `Last 24 hours aggregated across ${count} instances, grouped into 1-hour windows.`,
        clientActivityTitle: "Client activity",
        clientActivityDescription: (count) =>
          count === 1
            ? "Clients for the selected instance over the last 24 hours, grouped into 1-hour windows."
            : `Top clients aggregated across ${count} instances over the last 24 hours, grouped into 1-hour windows.`,
        noData: "There is not enough data to draw this chart yet.",
      },
      partial: {
        title: "Partial dashboard data",
        description: (failedCount, totalCount) =>
          failedCount === 1
            ? `1 of ${totalCount} instances failed to load metrics. The dashboard below aggregates only the healthy instances.`
            : `${failedCount} of ${totalCount} instances failed to load metrics. The dashboard below aggregates only the healthy instances.`,
      },
      toasts: {
        instanceFailure: (instanceName, message) => `${instanceName}: ${message}`,
        genericInstanceFailure: (instanceName) => `${instanceName}: could not load metrics for this instance.`,
      },
    },
  },
};

export type { WebMessages };

export function getWebMessages(locale: AppLocale) {
  return messages[locale] ?? messages[DEFAULT_LOCALE];
}
