import { type AppLocale, DEFAULT_LOCALE } from "@/lib/i18n/config";

export type SetupCopy = {
  page: {
    badge: string;
    title: string;
    description: string;
    technicalSecret: string;
    interactiveLogin: string;
    formTitle: string;
    formDescription: string;
  };
  wizard: {
    stepLabel: (current: number, total: number) => string;
    steps: Array<{
      key: "welcome" | "instances" | "login" | "layout";
      label: string;
      shortLabel: string;
    }>;
    back: string;
    next: string;
    finish: string;
    finishing: string;
  };
  welcome: {
    eyebrow: string;
    title: string;
    description: string;
    primary: string;
    secondary: string;
  };
  piholes: {
    title: string;
    description: string;
    sharedPasswordToggle: string;
    sharedPasswordDescription: string;
    sharedPassword: string;
    sharedPasswordHelp: string;
    alias: string;
    aliasPlaceholder: (index: number) => string;
    scheme: string;
    url: string;
    urlPlaceholder: string;
    urlDescription: string;
    password: string;
    passwordDescription: string;
    allowSelfSigned: string;
    allowSelfSignedDescription: string;
    masterTitle: string;
    masterDescription: string;
    masterPlaceholder: string;
    rowTitle: (index: number, name?: string) => string;
    addInstance: string;
    removeInstance: string;
    validation: {
      urlFormat: string;
      masterRequired: string;
      aliasRequired: string;
      urlRequired: string;
      instanceIncomplete: (instance: string) => string;
      sharedPassword: string;
      instancePassword: (instance: string) => string;
    };
  };
  loginMode: {
    title: string;
    description: string;
    piholeMasterTitle: string;
    piholeMasterDescription: string;
    yapdPasswordTitle: string;
    yapdPasswordDescription: string;
    password: string;
    confirmPassword: string;
    passwordDescription: string;
    validationTitle: string;
    validation: {
      passwordRequired: string;
      passwordTooShort: string;
      passwordConfirmationRequired: string;
      passwordConfirmationMismatch: string;
    };
  };
  layout: {
    title: string;
    description: string;
    restore: string;
  };
  submit: {
    errorTitle: string;
  };
};

const setupCopy: Record<AppLocale, SetupCopy> = {
  "pt-BR": {
    page: {
      badge: "Setup inicial",
      title: "Configure o YAPD passo a passo",
      description:
        "O assistente inicial organiza a criação da baseline, o modo de login humano e as preferências visuais que o produto deve assumir depois do primeiro acesso.",
      technicalSecret:
        "Os Pi-holes preenchidos são validados antes de salvar e o backend mantém apenas segredos técnicos criptografados para as operações futuras.",
      interactiveLogin:
        "Você decide se o painel usará a senha do Pi-hole master ou uma senha própria do YAPD para autenticação humana.",
      formTitle: "Assistente de setup",
      formDescription: "Preencha os 4 passos abaixo. Nada é persistido até a conclusão final do wizard.",
    },
    wizard: {
      stepLabel: (current, total) => `Passo ${current} de ${total}`,
      steps: [
        { key: "welcome", label: "Boas-vindas", shortLabel: "Boas-vindas" },
        { key: "instances", label: "Pi-holes", shortLabel: "Pi-holes" },
        { key: "login", label: "Login do produto", shortLabel: "Login" },
        { key: "layout", label: "Layout settings", shortLabel: "Layout" },
      ],
      back: "Voltar",
      next: "Próximo",
      finish: "Concluir setup",
      finishing: "Salvando setup...",
    },
    welcome: {
      eyebrow: "Primeiro acesso",
      title: "Bem-vindo ao YAPD",
      description:
        "Este wizard prepara a baseline, as instâncias iniciais, o modo de autenticação humana e o layout padrão que será aplicado logo após o setup.",
      primary:
        "Você pode revisar tudo antes de concluir. O backend só será chamado quando o wizard terminar no último passo.",
      secondary:
        "Se preferir, mude o idioma do assistente no seletor superior e depois escolha um idioma específico da aplicação no passo de layout.",
    },
    piholes: {
      title: "Cadastre os Pi-holes iniciais",
      description:
        "Adicione as URLs que o YAPD deve validar no setup, escolha uma senha compartilhada ou individual e defina qual delas será a master.",
      sharedPasswordToggle: "Usar a mesma senha para todas as instâncias",
      sharedPasswordDescription:
        "Quando marcado, o setup usa uma única senha para validar todos os Pi-holes preenchidos.",
      sharedPassword: "Senha compartilhada",
      sharedPasswordHelp: "Essa senha será aplicada a todas as URLs preenchidas neste passo.",
      alias: "Alias",
      aliasPlaceholder: (index) => `Pi-hole ${index + 1}`,
      scheme: "Protocolo",
      url: "URL",
      urlPlaceholder: "pi.hole ou 192.168.31.10:8080/admin",
      urlDescription: "Informe apenas host, porta e caminho. O protocolo é escolhido ao lado.",
      password: "Senha/Application password",
      passwordDescription: "Essa credencial técnica será salva criptografada para o backend operar a instância.",
      allowSelfSigned: "Permitir certificado autoassinado explicitamente",
      allowSelfSignedDescription: "Use apenas quando você confiar no certificado local dessa instância.",
      masterTitle: "Pi-hole master",
      masterDescription: "Selecione qual URL será usada como baseline oficial do YAPD.",
      masterPlaceholder: "Selecione o Pi-hole master",
      rowTitle: (index, name) => (name && name.trim().length > 0 ? name : `Pi-hole ${index + 1}`),
      addInstance: "Adicionar URL",
      removeInstance: "Remover",
      validation: {
        urlFormat: "Informe apenas host, porta e caminho válidos, sem incluir http:// ou https://.",
        masterRequired: "Selecione um Pi-hole master válido para continuar.",
        aliasRequired: "Informe um alias para esta instância.",
        urlRequired: "Informe a URL desta instância.",
        instanceIncomplete: (instance) =>
          `Complete alias, URL e senha de ${instance} ou deixe essa linha totalmente vazia.`,
        sharedPassword: "Informe a senha compartilhada para os Pi-holes preenchidos.",
        instancePassword: (instance) => `Informe a senha de ${instance}.`,
      },
    },
    loginMode: {
      title: "Escolha como o YAPD fará login",
      description:
        "Esse passo define como os operadores humanos vão entrar no painel depois que o setup for concluído.",
      piholeMasterTitle: "Entrar com a senha do Pi-hole master",
      piholeMasterDescription:
        "Mantém o fluxo oficial do Pi-hole v6. O backend abrirá a sessão proxy a partir do Pi-hole master.",
      yapdPasswordTitle: "Criar uma senha própria do YAPD",
      yapdPasswordDescription:
        "Cria uma senha única do produto para o primeiro operador. O login humano deixa de depender da senha do Pi-hole.",
      password: "Nova senha do YAPD",
      confirmPassword: "Confirmar nova senha",
      passwordDescription: "Essa senha será armazenada em hash no backend e usada somente para login humano no YAPD.",
      validationTitle: "Revise o modo de login",
      validation: {
        passwordRequired: "Defina uma senha própria do YAPD para continuar.",
        passwordTooShort: "A senha própria do YAPD deve ter pelo menos 8 caracteres.",
        passwordConfirmationRequired: "Confirme a senha própria do YAPD.",
        passwordConfirmationMismatch: "A confirmação da senha do YAPD não confere.",
      },
    },
    layout: {
      title: "Defina o layout inicial da aplicação",
      description:
        "Escolha o timezone e as preferências visuais que o YAPD deve aplicar logo após o setup. Elas só serão persistidas quando o wizard for concluído.",
      restore: "Restaurar padrões",
    },
    submit: {
      errorTitle: "Falha ao concluir o setup",
    },
  },
  "en-US": {
    page: {
      badge: "Initial setup",
      title: "Configure YAPD step by step",
      description:
        "The initial wizard organizes baseline creation, the human login mode, and the visual preferences the product should use after first access.",
      technicalSecret:
        "Filled Pi-holes are validated before saving, and the backend only keeps encrypted technical secrets for future operations.",
      interactiveLogin:
        "You decide whether the panel uses the master Pi-hole password or a dedicated YAPD password for human authentication.",
      formTitle: "Setup wizard",
      formDescription: "Fill in the 4 steps below. Nothing is persisted until the final wizard completion.",
    },
    wizard: {
      stepLabel: (current, total) => `Step ${current} of ${total}`,
      steps: [
        { key: "welcome", label: "Welcome", shortLabel: "Welcome" },
        { key: "instances", label: "Pi-holes", shortLabel: "Pi-holes" },
        { key: "login", label: "Product login", shortLabel: "Login" },
        { key: "layout", label: "Layout settings", shortLabel: "Layout" },
      ],
      back: "Back",
      next: "Next",
      finish: "Finish setup",
      finishing: "Saving setup...",
    },
    welcome: {
      eyebrow: "First access",
      title: "Welcome to YAPD",
      description:
        "This wizard prepares the baseline, the initial instances, the human authentication mode, and the default layout that will be applied right after setup.",
      primary:
        "You can review everything before finishing. The backend is only called when the wizard reaches the final step.",
      secondary:
        "If you want, change the wizard language with the selector above and then choose a specific application language in the layout step.",
    },
    piholes: {
      title: "Register the initial Pi-holes",
      description:
        "Add the URLs YAPD should validate during setup, choose a shared or per-instance password, and define which one is the master.",
      sharedPasswordToggle: "Use the same password for all instances",
      sharedPasswordDescription: "When enabled, setup uses one password to validate every filled Pi-hole.",
      sharedPassword: "Shared password",
      sharedPasswordHelp: "This password will be used for every filled URL in this step.",
      alias: "Alias",
      aliasPlaceholder: (index) => `Pi-hole ${index + 1}`,
      scheme: "Protocol",
      url: "URL",
      urlPlaceholder: "pi.hole or 192.168.31.10:8080/admin",
      urlDescription: "Provide only host, port, and path. The protocol is selected next to it.",
      password: "Password/Application password",
      passwordDescription:
        "This technical credential will be stored encrypted so the backend can operate the instance.",
      allowSelfSigned: "Explicitly allow a self-signed certificate",
      allowSelfSignedDescription: "Use this only when you trust this instance's local certificate.",
      masterTitle: "Master Pi-hole",
      masterDescription: "Select which URL becomes the official YAPD baseline.",
      masterPlaceholder: "Select the master Pi-hole",
      rowTitle: (index, name) => (name && name.trim().length > 0 ? name : `Pi-hole ${index + 1}`),
      addInstance: "Add URL",
      removeInstance: "Remove",
      validation: {
        urlFormat: "Provide only a valid host, port, and path without including http:// or https://.",
        masterRequired: "Select a valid master Pi-hole before continuing.",
        aliasRequired: "Provide an alias for this instance.",
        urlRequired: "Provide the URL for this instance.",
        instanceIncomplete: (instance) =>
          `Complete the alias, URL, and password for ${instance}, or leave that row entirely empty.`,
        sharedPassword: "Provide the shared password for the filled Pi-holes.",
        instancePassword: (instance) => `Provide the password for ${instance}.`,
      },
    },
    loginMode: {
      title: "Choose how YAPD login should work",
      description: "This step defines how human operators will sign in to the panel after setup is complete.",
      piholeMasterTitle: "Sign in with the master Pi-hole password",
      piholeMasterDescription:
        "Keeps the official Pi-hole v6 flow. The backend will open the proxy session through the master Pi-hole.",
      yapdPasswordTitle: "Create a dedicated YAPD password",
      yapdPasswordDescription:
        "Creates a single product password for the first operator. Human login no longer depends on the Pi-hole password.",
      password: "New YAPD password",
      confirmPassword: "Confirm new password",
      passwordDescription: "This password will be stored as a hash in the backend and used only for human YAPD login.",
      validationTitle: "Review the login mode",
      validation: {
        passwordRequired: "Set a dedicated YAPD password to continue.",
        passwordTooShort: "The dedicated YAPD password must be at least 8 characters long.",
        passwordConfirmationRequired: "Confirm the dedicated YAPD password.",
        passwordConfirmationMismatch: "The YAPD password confirmation does not match.",
      },
    },
    layout: {
      title: "Choose the initial application layout",
      description:
        "Select the time zone and visual preferences that YAPD should apply right after setup. They are only persisted when the wizard finishes.",
      restore: "Restore defaults",
    },
    submit: {
      errorTitle: "Could not finish setup",
    },
  },
};

export function getSetupCopy(locale: AppLocale) {
  return setupCopy[locale] ?? setupCopy[DEFAULT_LOCALE];
}
