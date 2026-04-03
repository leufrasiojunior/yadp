export type WebMessages = {
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
        syncEnabledSuccess: string;
        syncDisabledSuccess: string;
        updateSuccess: string;
      };
      create: {
        openModal: string;
        title: string;
        description: string;
        manualTab: string;
        discoveryTab: string;
        name: string;
        baseUrlScheme: string;
        baseUrl: string;
        baseUrlPlaceholder: string;
        baseUrlDescription: string;
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
        sync: string;
        lastError: string;
        actions: string;
        baseline: string;
        baselineBadge: string;
        syncEnabled: string;
        syncDisabled: string;
        syncEnabling: string;
        syncDisabling: string;
        syncLocked: string;
        errorDetails: string;
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
      errorDetails: {
        title: string;
        description: (instanceName: string) => string;
        summary: string;
        possibleCause: string;
        whatToCheck: string;
        technicalDetails: string;
        noTechnicalDetails: string;
        close: string;
        invalid_credentials: {
          title: string;
          cause: string;
          checks: string[];
        };
        tls_error: {
          title: string;
          cause: string;
          checks: string[];
        };
        timeout: {
          title: string;
          cause: string;
          checks: string[];
        };
        dns_error: {
          title: string;
          cause: string;
          checks: string[];
        };
        connection_refused: {
          title: string;
          cause: string;
          checks: string[];
        };
        pihole_response_error: {
          title: string;
          cause: string;
          checks: string[];
        };
        unknown: {
          title: string;
          cause: string;
          checks: string[];
        };
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
    groupsButton: string;
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
      groups: string;
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
  groups: {
    eyebrow: string;
    title: string;
    description: string;
    validation: {
      createNames: string;
      editName: string;
      comment: string;
    };
    create: {
      title: string;
      description: string;
      nameLabel: string;
      commentLabel: string;
      tipMultiple: string;
      tipQuoted: string;
      submitIdle: string;
      submitLoading: string;
    };
    table: {
      title: string;
      description: (baselineName: string) => string;
      searchPlaceholder: string;
      refresh: string;
      refreshLoading: string;
      sync: string;
      syncLoading: string;
      selectAll: string;
      selectRow: (name: string) => string;
      name: string;
      status: string;
      comment: string;
      actions: string;
      edit: string;
      delete: string;
      deleteSelected: (count: number) => string;
      protectedBadge: string;
      protectedDescription: string;
      syncIssue: string;
      syncIssueAction: (name: string) => string;
      emptyTitle: string;
      emptyDescription: string;
    };
    syncDialog: {
      titleAll: string;
      titleSingle: (name: string) => string;
      descriptionAll: (baselineName: string) => string;
      descriptionSingle: (name: string) => string;
      partialAvailability: (availableCount: number, totalCount: number) => string;
      emptyTitle: string;
      emptyDescription: string;
      sourceLabel: string;
      sourceHint: (count: number) => string;
      availabilityHint: (presentCount: number, missingCount: number) => string;
      sourcePlaceholder: string;
      targetsLabel: string;
      targetsHint: (count: number) => string;
      presentCount: (count: number) => string;
      missingCount: (count: number) => string;
      instanceHasGroup: string;
      instanceMissingGroup: string;
      targetsRequired: string;
      noTargets: string;
      syncAction: string;
      syncLoading: string;
      close: string;
    };
    status: {
      active: string;
      inactive: string;
      enabling: string;
      disabling: string;
    };
    edit: {
      title: string;
      description: string;
      nameLabel: string;
      commentLabel: string;
      cancel: string;
      submitIdle: string;
      submitLoading: string;
    };
    delete: {
      titleSingle: (name: string) => string;
      titleBatch: (count: number) => string;
      descriptionSingle: (name: string) => string;
      descriptionBatch: (count: number) => string;
      irreversible: string;
      dontAskAgain: string;
      cancel: string;
      confirmSingle: string;
      confirmBatch: (count: number) => string;
      confirmLoading: string;
    };
    toasts: {
      refreshFailed: string;
      createSuccess: string;
      updateSuccess: string;
      deleteSuccess: string;
      enabledSuccess: string;
      disabledSuccess: string;
      syncSuccess: string;
      syncGroupSuccess: (name: string) => string;
      partialWarning: (successfulCount: number, failedCount: number) => string;
    };
  };
};
