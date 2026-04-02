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
        certificatePem: string;
        trustMode: string;
        candidates: string;
        candidatesLimit: (limit: number) => string;
      };
      toasts: {
        refreshFailed: string;
        createSuccess: string;
        discoverSuccess: string;
        detailsLoadFailed: string;
        testSuccess: string;
        reauthenticateSuccess: string;
        updateSuccess: string;
      };
      create: {
        openModal: string;
        title: string;
        description: string;
        manualTab: string;
        discoveryTab: string;
        name: string;
        baseUrl: string;
        password: string;
        passwordDescription: string;
        allowSelfSigned: string;
        certificate: string;
        validationFailedTitle: string;
        cancel: string;
        submitIdle: string;
        submitLoading: string;
      };
      edit: {
        title: string;
        description: string;
        passwordDescription: string;
        validationFailedTitle: string;
        loadFailedTitle: string;
        loading: string;
        cancel: string;
        submitIdle: string;
        submitLoading: string;
      };
      discovery: {
        title: string;
        description: string;
        candidates: string;
        candidatesDescription: (limit: number) => string;
        empty: string;
        reachable: string;
        unreachable: string;
        useAddressHint: string;
        useDiscoveredAddress: string;
        invalidSelection: string;
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
        editIdle: string;
        editLoading: string;
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
    queriesButton: string;
    instancesButton: string;
    unavailableTitle: string;
    unavailableDescription: string;
  };
  sidebar: {
    groups: {
      overview: string;
      operations: string;
      status: string;
      sync: string;
    };
    items: {
      dashboard: string;
      queries: string;
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
    sync: {
      title: string;
      blocking: string;
      statusTitle: string;
      disableBlocking: string;
      enableBlocking: string;
      refresh: string;
      loading: string;
      refreshLoading: string;
      quickIndefinite: string;
      quick10Seconds: string;
      quick30Seconds: string;
      quick5Minutes: string;
      savedPreset: string;
      configurePreset: string;
      custom: string;
      missingPreset: string;
      aggregateEnabled: string;
      aggregateDisabled: string;
      aggregateMixed: string;
      aggregatePartial: string;
      instanceEnabled: string;
      instanceDisabled: string;
      instanceUnavailable: string;
      timerLabel: string;
      messageLabel: string;
      valueLabel: string;
      unitLabel: string;
      unitSeconds: string;
      unitMinutes: string;
      invalidValue: string;
      normalizedTimer: (timerLabel: string) => string;
      presetDescription: string;
      presetsManagerTitle: string;
      presetsManagerDescription: string;
      presetAliasLabel: string;
      addPreset: string;
      removePreset: string;
      movePresetUp: string;
      movePresetDown: string;
      emptyPresets: string;
      savePresets: string;
      savingPresets: string;
      customDescription: string;
      previewTitle: string;
      readyInstances: (count: number) => string;
      noopInstances: (count: number) => string;
      failedInstances: (count: number) => string;
      noReadyInstances: string;
      desiredEnable: string;
      desiredDisable: (timerLabel: string) => string;
      applyReady: (count: number) => string;
      applyPartial: (count: number) => string;
      savePreset: string;
      savingPreset: string;
      previewing: string;
      applying: string;
      cancel: string;
      close: string;
      statusRefreshError: string;
      toasts: {
        presetSaved: string;
        alreadyDesired: string;
        applySuccess: (count: number) => string;
        applyPartial: (successfulCount: number, failedCount: number) => string;
        applyFailure: string;
        instanceFailure: (instanceName: string, message: string) => string;
        masterMismatch: (instanceName: string, instanceAddress: string) => string;
      };
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
  queries: {
    eyebrow: string;
    title: string;
    description: string;
    responsiveInstances: (successfulCount: number, totalCount: number) => string;
    liveInterval: string;
    filters: {
      title: string;
      description: string;
      show: string;
      hide: string;
      from: string;
      until: string;
      length: string;
      domain: string;
      clientIp: string;
      upstream: string;
      type: string;
      status: string;
      reply: string;
      dnssec: string;
      disk: string;
      diskDescription: string;
      apply: string;
      applying: string;
      clear: string;
      suggestionsLoading: string;
      suggestionPlaceholder: string;
      empty: string;
    };
    table: {
      title: string;
      description: string;
      liveToggle: string;
      liveNavigationWarning: string;
      rowsPerPage: string;
      live: string;
      refreshing: string;
      time: string;
      instance: string;
      client: string;
      domain: string;
      type: string;
      status: string;
      reply: string;
      upstream: string;
      details: string;
      showing: (start: number, end: number, total: number) => string;
      previous: string;
      next: string;
      noResultsTitle: string;
      noResultsDescription: string;
    };
    details: {
      dnssec: string;
      listId: string;
      ede: string;
      cname: string;
    };
    actions: {
      block: string;
      blockDomain: string;
      blockRegex: string;
      allow: string;
      applying: string;
    };
    toasts: {
      actionSuccess: (action: string, count: number) => string;
      actionPartial: (action: string, successCount: number, failedCount: number) => string;
      instanceFailure: (instanceName: string, message: string) => string;
      genericInstanceFailure: (instanceName: string) => string;
    };
    statusTypes: {
      cache: string;
      forwarded: string;
      cacheStale: string;
      gravity: string;
      unknown: (status: string) => string;
      unavailable: string;
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
          certificatePem: "Informe um certificado PEM valido.",
          trustMode: "Use CA personalizada ou self-signed explicito, mas nao os dois ao mesmo tempo.",
          candidates: "Use apenas URLs http/https validas, uma por linha ou separadas por virgula.",
          candidatesLimit: (limit) => `Informe no maximo ${limit} candidatos por descoberta.`,
        },
        toasts: {
          refreshFailed: "Não foi possível atualizar a lista de instâncias.",
          createSuccess: "Instância cadastrada com sucesso.",
          discoverSuccess: "Descoberta executada.",
          detailsLoadFailed: "Não foi possível carregar os detalhes da instância.",
          testSuccess: "Conexão validada com sucesso.",
          reauthenticateSuccess: "Sessão da instância renovada com sucesso.",
          updateSuccess: "Instância atualizada com sucesso.",
        },
        create: {
          openModal: "Cadastrar instância",
          title: "Cadastrar instância",
          description: "Salve uma credencial técnica para o backend operar sobre outro Pi-hole.",
          manualTab: "Manual",
          discoveryTab: "Descoberta",
          name: "Nome",
          baseUrl: "Base URL",
          password: "Senha/Application password",
          passwordDescription: "O backend vai testar a autenticação antes de salvar a instância.",
          allowSelfSigned: "Permitir self-signed explicitamente",
          certificate: "CA personalizada opcional",
          validationFailedTitle: "Falha ao validar a instância",
          cancel: "Cancelar",
          submitIdle: "Salvar instância",
          submitLoading: "Validando...",
        },
        edit: {
          title: "Editar instância",
          description: "Atualize a conexão técnica e revalide a instância antes de salvar.",
          passwordDescription: "Deixe em branco para manter a credencial técnica atual.",
          validationFailedTitle: "Falha ao atualizar a instância",
          loadFailedTitle: "Falha ao carregar a instância",
          loading: "Carregando detalhes da instância...",
          cancel: "Cancelar",
          submitIdle: "Salvar alterações",
          submitLoading: "Salvando...",
        },
        discovery: {
          title: "Descoberta assistida",
          description: "Informe candidatos para o backend verificar se respondem como Pi-hole.",
          candidates: "Candidatos",
          candidatesDescription: (limit) =>
            `Use uma URL por linha ou separadas por vírgula, com limite de ${limit} candidatos.`,
          empty: "Nenhum resultado ainda. Rode a descoberta para testar candidatos.",
          reachable: "Pi-hole respondeu ao endpoint /auth.",
          unreachable: "Não foi possível conectar.",
          useAddressHint: "Use um resultado alcançável para preencher a Base URL na aba manual.",
          useDiscoveredAddress: "Usar este endereço",
          invalidSelection: "O resultado selecionado não contém uma URL válida.",
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
          editIdle: "Editar",
          editLoading: "Abrindo...",
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
      queriesButton: "Queries",
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
        sync: "Sync",
      },
      items: {
        dashboard: "Dashboard",
        queries: "Queries Log",
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
      sync: {
        title: "Sync",
        blocking: "Blocking",
        statusTitle: "Estado atual",
        disableBlocking: "Disable Blocking",
        enableBlocking: "Reabilitar blocking",
        refresh: "Atualizar",
        loading: "Carregando status...",
        refreshLoading: "Atualizando...",
        quickIndefinite: "Indefinido",
        quick10Seconds: "10 segundos",
        quick30Seconds: "30 segundos",
        quick5Minutes: "5 minutos",
        savedPreset: "Preset salvo",
        configurePreset: "Gerenciar presets",
        custom: "Customizado",
        missingPreset: "Nenhum preset salvo ainda.",
        aggregateEnabled: "Enabled",
        aggregateDisabled: "Disabled",
        aggregateMixed: "Mixed",
        aggregatePartial: "Partial",
        instanceEnabled: "Enabled",
        instanceDisabled: "Disabled",
        instanceUnavailable: "Sem leitura",
        timerLabel: "Timer",
        messageLabel: "Motivo",
        valueLabel: "Valor",
        unitLabel: "Unidade",
        unitSeconds: "Segundos",
        unitMinutes: "Minutos",
        invalidValue: "Informe um valor inteiro positivo.",
        normalizedTimer: (timerLabel) => `Será enviado como ${timerLabel}.`,
        presetDescription: "Use presets salvos para aplicar tempos recorrentes com um clique.",
        presetsManagerTitle: "Gerenciar presets",
        presetsManagerDescription: "Reordene, renomeie, crie e remova os presets de duração do blocking.",
        presetAliasLabel: "Alias do preset",
        addPreset: "Adicionar preset",
        removePreset: "Apagar",
        movePresetUp: "Mover para cima",
        movePresetDown: "Mover para baixo",
        emptyPresets: "Nenhum preset configurado.",
        savePresets: "Salvar presets",
        savingPresets: "Salvando presets...",
        customDescription:
          "Informe uma duração personalizada. O frontend sempre converte para segundos antes do envio.",
        previewTitle: "Confirmar sincronismo",
        readyInstances: (count) => `${count} prontas`,
        noopInstances: (count) => `${count} sem alteração`,
        failedInstances: (count) => `${count} com falha`,
        noReadyInstances: "Nenhuma instância pronta para aplicar agora.",
        desiredEnable: "Reabilitar blocking em todas as instâncias prontas.",
        desiredDisable: (timerLabel) => `Desabilitar blocking por ${timerLabel} nas instâncias prontas.`,
        applyReady: (count) => `Aplicar em ${count} instâncias prontas`,
        applyPartial: (count) => `Aplicar parcialmente em ${count} instâncias`,
        savePreset: "Salvar preset",
        savingPreset: "Salvando...",
        previewing: "Validando...",
        applying: "Aplicando...",
        cancel: "Cancelar",
        close: "Fechar",
        statusRefreshError: "Não foi possível atualizar o status do blocking.",
        toasts: {
          presetSaved: "Presets de blocking salvos com sucesso.",
          alreadyDesired: "As instâncias já estavam no estado desejado.",
          applySuccess: (count) =>
            count === 1 ? "Blocking sincronizado em 1 instância." : `Blocking sincronizado em ${count} instâncias.`,
          applyPartial: (successfulCount, failedCount) =>
            `${successfulCount} instâncias foram atualizadas e ${failedCount} falharam durante o sincronismo.`,
          applyFailure: "Não foi possível aplicar o sincronismo de blocking.",
          instanceFailure: (instanceName, message) => `${instanceName}: ${message}`,
          masterMismatch: (instanceName, instanceAddress) =>
            `${instanceName} (${instanceAddress}) não está com o mesmo estado de blocking da instância master.`,
        },
      },
    },
    dashboard: {
      eyebrow: "Visão consolidada das instâncias Pi-hole",
      title: "Dashboard",
      scope: {
        label: "Escopo",
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
    queries: {
      eyebrow: "Logs compartilhados entre instâncias Pi-hole",
      title: "Queries",
      description: "Acompanhe as consultas DNS mais recentes com filtros, sugestões e atualização contínua.",
      responsiveInstances: (successfulCount, totalCount) =>
        totalCount === 0
          ? "Nenhuma instância cadastrada."
          : successfulCount === 1
            ? "1 instância contribuiu com dados nesta leitura."
            : `${successfulCount} instâncias contribuíram com dados nesta leitura.`,
      liveInterval: "Live update a cada 2 segundos.",
      filters: {
        title: "Filtros",
        description: "Combine período, origem e tipos de resposta para recortar a tabela.",
        show: "Mostrar filtros",
        hide: "Ocultar filtros",
        from: "De",
        until: "Até",
        length: "Quantidade",
        domain: "Domínio",
        clientIp: "Client IP",
        upstream: "Upstream",
        type: "Tipo",
        status: "Status",
        reply: "Reply",
        dnssec: "DNSSEC",
        disk: "Buscar no banco em disco",
        diskDescription:
          "Consulta dados on-disk. Isso é bem mais lento, mas necessário se você quiser obter queries com mais de 24 horas. Esta opção desativa o live update.",
        apply: "Aplicar filtros",
        applying: "Aplicando...",
        clear: "Limpar",
        suggestionsLoading: "Carregando sugestões...",
        suggestionPlaceholder: "Digite ou escolha da lista",
        empty: "Nenhuma opção encontrada.",
      },
      table: {
        title: "Tabela de queries",
        description: "A tabela agrega somente as instâncias que responderem ao recorte atual.",
        liveToggle: "Live",
        liveNavigationWarning: "Desative o modo live para navegar entre as páginas.",
        rowsPerPage: "Itens por página",
        live: "Ao vivo",
        refreshing: "Atualizando...",
        time: "Horário",
        instance: "Instância",
        client: "Cliente",
        domain: "Domínio",
        type: "Tipo",
        status: "Status",
        reply: "Reply",
        upstream: "Upstream",
        details: "Detalhes",
        showing: (start, end, total) => `Mostrando ${start}-${end} de ${total}`,
        previous: "Anterior",
        next: "Próxima",
        noResultsTitle: "Nenhuma query encontrada",
        noResultsDescription: "Ajuste os filtros ou aguarde novas consultas chegarem pelas instâncias selecionadas.",
      },
      details: {
        dnssec: "DNSSEC",
        listId: "List ID",
        ede: "EDE",
        cname: "CNAME",
      },
      actions: {
        block: "Bloquear",
        blockDomain: "Bloquear domínio",
        blockRegex: "Bloquear via regex",
        allow: "Permitir",
        applying: "Aplicando...",
      },
      toasts: {
        actionSuccess: (action, count) =>
          count === 1 ? `${action} aplicado em 1 instância.` : `${action} aplicado em ${count} instâncias.`,
        actionPartial: (action, successCount, failedCount) =>
          `${action} concluído em ${successCount} instâncias, com falha em ${failedCount}.`,
        instanceFailure: (instanceName, message) => `${instanceName}: ${message}`,
        genericInstanceFailure: (instanceName) => `${instanceName}: a ação de domínio falhou.`,
      },
      statusTypes: {
        cache: "CACHE: resposta servida diretamente do cache.",
        forwarded: "FORWARDED: consulta encaminhada para o servidor upstream.",
        cacheStale: "CACHE_STALE: resposta servida do cache expirado.",
        gravity: "GRAVITY: consulta bloqueada pelo Gravity.",
        unknown: (status) => `${status}: status retornado pela instância Pi-hole.`,
        unavailable: "Status indisponível.",
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
          certificatePem: "Provide a valid PEM certificate bundle.",
          trustMode: "Use either a custom CA or explicit self-signed trust, but not both at the same time.",
          candidates: "Use only valid http/https URLs, one per line or separated with commas.",
          candidatesLimit: (limit) => `Provide at most ${limit} discovery candidates.`,
        },
        toasts: {
          refreshFailed: "Could not refresh the instance list.",
          createSuccess: "Instance created successfully.",
          discoverSuccess: "Discovery completed.",
          detailsLoadFailed: "Could not load the instance details.",
          testSuccess: "Connection validated successfully.",
          reauthenticateSuccess: "Instance session renewed successfully.",
          updateSuccess: "Instance updated successfully.",
        },
        create: {
          openModal: "Register instance",
          title: "Register instance",
          description: "Store a technical credential so the backend can operate on another Pi-hole.",
          manualTab: "Manual",
          discoveryTab: "Discovery",
          name: "Name",
          baseUrl: "Base URL",
          password: "Password/Application password",
          passwordDescription: "The backend validates authentication before saving the instance.",
          allowSelfSigned: "Explicitly allow self-signed",
          certificate: "Optional custom CA",
          validationFailedTitle: "Instance validation failed",
          cancel: "Cancel",
          submitIdle: "Save instance",
          submitLoading: "Validating...",
        },
        edit: {
          title: "Edit instance",
          description: "Update the technical connection and revalidate the instance before saving.",
          passwordDescription: "Leave blank to keep the current technical credential.",
          validationFailedTitle: "Failed to update the instance",
          loadFailedTitle: "Failed to load the instance",
          loading: "Loading instance details...",
          cancel: "Cancel",
          submitIdle: "Save changes",
          submitLoading: "Saving...",
        },
        discovery: {
          title: "Guided discovery",
          description: "Provide candidates for the backend to verify as Pi-hole endpoints.",
          candidates: "Candidates",
          candidatesDescription: (limit) =>
            `Use one URL per line or separate them with commas, up to ${limit} candidates.`,
          empty: "No results yet. Run discovery to test candidates.",
          reachable: "Pi-hole responded to the /auth endpoint.",
          unreachable: "Could not connect.",
          useAddressHint: "Use a reachable result to populate the Base URL in the manual tab.",
          useDiscoveredAddress: "Use this address",
          invalidSelection: "The selected result does not contain a valid URL.",
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
          editIdle: "Edit",
          editLoading: "Opening...",
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
      queriesButton: "Queries",
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
        sync: "Sync",
      },
      items: {
        dashboard: "Dashboard",
        queries: "Queries Log",
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
      sync: {
        title: "Sync",
        blocking: "Blocking",
        statusTitle: "Current state",
        disableBlocking: "Disable Blocking",
        enableBlocking: "Enable blocking",
        refresh: "Refresh",
        loading: "Loading status...",
        refreshLoading: "Refreshing...",
        quickIndefinite: "Indefinite",
        quick10Seconds: "10 seconds",
        quick30Seconds: "30 seconds",
        quick5Minutes: "5 minutes",
        savedPreset: "Saved preset",
        configurePreset: "Manage presets",
        custom: "Custom",
        missingPreset: "No saved preset yet.",
        aggregateEnabled: "Enabled",
        aggregateDisabled: "Disabled",
        aggregateMixed: "Mixed",
        aggregatePartial: "Partial",
        instanceEnabled: "Enabled",
        instanceDisabled: "Disabled",
        instanceUnavailable: "Unavailable",
        timerLabel: "Timer",
        messageLabel: "Reason",
        valueLabel: "Value",
        unitLabel: "Unit",
        unitSeconds: "Seconds",
        unitMinutes: "Minutes",
        invalidValue: "Enter a positive integer value.",
        normalizedTimer: (timerLabel) => `It will be sent as ${timerLabel}.`,
        presetDescription: "Use saved presets to apply recurring blocking durations with one click.",
        presetsManagerTitle: "Manage presets",
        presetsManagerDescription: "Reorder, rename, create, and remove the blocking duration presets.",
        presetAliasLabel: "Preset alias",
        addPreset: "Add preset",
        removePreset: "Delete",
        movePresetUp: "Move up",
        movePresetDown: "Move down",
        emptyPresets: "No presets configured.",
        savePresets: "Save presets",
        savingPresets: "Saving presets...",
        customDescription: "Provide a custom duration. The frontend always converts it to seconds before sending.",
        previewTitle: "Confirm sync",
        readyInstances: (count) => `${count} ready`,
        noopInstances: (count) => `${count} unchanged`,
        failedInstances: (count) => `${count} failed`,
        noReadyInstances: "There are no ready instances to apply right now.",
        desiredEnable: "Enable blocking on all ready instances.",
        desiredDisable: (timerLabel) => `Disable blocking for ${timerLabel} on the ready instances.`,
        applyReady: (count) => `Apply to ${count} ready instances`,
        applyPartial: (count) => `Apply partially to ${count} instances`,
        savePreset: "Save preset",
        savingPreset: "Saving...",
        previewing: "Validating...",
        applying: "Applying...",
        cancel: "Cancel",
        close: "Close",
        statusRefreshError: "Could not refresh blocking status.",
        toasts: {
          presetSaved: "Blocking presets saved successfully.",
          alreadyDesired: "The instances already matched the desired state.",
          applySuccess: (count) =>
            count === 1 ? "Blocking synchronized on 1 instance." : `Blocking synchronized on ${count} instances.`,
          applyPartial: (successfulCount, failedCount) =>
            `${successfulCount} instances were updated and ${failedCount} failed during sync.`,
          applyFailure: "Could not apply the blocking sync.",
          instanceFailure: (instanceName, message) => `${instanceName}: ${message}`,
          masterMismatch: (instanceName, instanceAddress) =>
            `${instanceName} (${instanceAddress}) does not match the blocking state defined by the master instance.`,
        },
      },
    },
    dashboard: {
      eyebrow: "Consolidated view of your Pi-hole instances",
      title: "Dashboard",
      scope: {
        label: "Scope",
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
    queries: {
      eyebrow: "Shared logs across your Pi-hole instances",
      title: "Queries",
      description: "Track recent DNS queries with filters, suggestions, and continuous updates.",
      responsiveInstances: (successfulCount, totalCount) =>
        totalCount === 0
          ? "There are no registered instances yet."
          : successfulCount === 1
            ? "1 instance contributed data to this snapshot."
            : `${successfulCount} instances contributed data to this snapshot.`,
      liveInterval: "Live update every 2 seconds.",
      filters: {
        title: "Filters",
        description: "Combine time range, origin, and response types to narrow the table.",
        show: "Show filters",
        hide: "Hide filters",
        from: "From",
        until: "Until",
        length: "Length",
        domain: "Domain",
        clientIp: "Client IP",
        upstream: "Upstream",
        type: "Type",
        status: "Status",
        reply: "Reply",
        dnssec: "DNSSEC",
        disk: "Load from on-disk database",
        diskDescription:
          "Query on-disk data. This is a lot slower but necessary if you want to obtain queries older than 24 hours. This option disables live update.",
        apply: "Apply filters",
        applying: "Applying...",
        clear: "Clear",
        suggestionsLoading: "Loading suggestions...",
        suggestionPlaceholder: "Type or pick from the list",
        empty: "No options found.",
      },
      table: {
        title: "Queries table",
        description: "The grid aggregates only the instances that responded for the current slice.",
        liveToggle: "Live",
        liveNavigationWarning: "Turn off live mode to navigate between pages.",
        rowsPerPage: "Rows per page",
        live: "Live",
        refreshing: "Refreshing...",
        time: "Time",
        instance: "Instance",
        client: "Client",
        domain: "Domain",
        type: "Type",
        status: "Status",
        reply: "Reply",
        upstream: "Upstream",
        details: "Details",
        showing: (start, end, total) => `Showing ${start}-${end} of ${total}`,
        previous: "Previous",
        next: "Next",
        noResultsTitle: "No queries found",
        noResultsDescription: "Adjust the filters or wait for new queries to arrive from the selected instances.",
      },
      details: {
        dnssec: "DNSSEC",
        listId: "List ID",
        ede: "EDE",
        cname: "CNAME",
      },
      actions: {
        block: "Block",
        blockDomain: "Block domain",
        blockRegex: "Block via regex",
        allow: "Allow",
        applying: "Applying...",
      },
      toasts: {
        actionSuccess: (action, count) =>
          count === 1 ? `${action} applied to 1 instance.` : `${action} applied to ${count} instances.`,
        actionPartial: (action, successCount, failedCount) =>
          `${action} completed on ${successCount} instances, with ${failedCount} failures.`,
        instanceFailure: (instanceName, message) => `${instanceName}: ${message}`,
        genericInstanceFailure: (instanceName) => `${instanceName}: the domain action failed.`,
      },
      statusTypes: {
        cache: "CACHE: response served directly from cache.",
        forwarded: "FORWARDED: query forwarded to the upstream server.",
        cacheStale: "CACHE_STALE: response served from stale cache.",
        gravity: "GRAVITY: query blocked by Gravity.",
        unknown: (status) => `${status}: status returned by the Pi-hole instance.`,
        unavailable: "Status unavailable.",
      },
    },
  },
};

export type { WebMessages };

export function getWebMessages(locale: AppLocale) {
  return messages[locale] ?? messages[DEFAULT_LOCALE];
}
