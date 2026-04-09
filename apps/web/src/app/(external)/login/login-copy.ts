import type { SetupLoginMode } from "@/lib/api/yapd-types";
import { type AppLocale, DEFAULT_LOCALE } from "@/lib/i18n/config";

type LoginModeCopy = {
  badge: string;
  title: string;
  description: string;
  primaryNote: string;
  secondaryNote: string;
  cardTitle: (baselineName: string) => string;
  cardDescription: (baseUrl: string) => string;
  successToast: (baselineName: string) => string;
  fields: {
    password: string;
    passwordDescription: string;
  };
  validationPassword: string;
  submit: {
    idle: string;
    loading: string;
  };
};

type LoginCopy = {
  primaryInstanceLabel: string;
  modes: Record<SetupLoginMode, LoginModeCopy>;
};

const loginCopy: Record<AppLocale, LoginCopy> = {
  "pt-BR": {
    primaryInstanceLabel: "Pi-hole principal",
    modes: {
      "pihole-master": {
        badge: "Login da baseline",
        title: "Entre usando o Pi-hole master",
        description:
          "O YAPD usa o login oficial do Pi-hole master para criar a sessão inicial da baseline e sincronizar as sessões gerenciadas das instâncias.",
        primaryNote:
          "As credenciais das instâncias foram definidas no setup. O login humano da baseline reaproveita o SID obtido agora, sem abrir uma segunda sessão logo em seguida.",
        secondaryNote:
          "As outras instâncias continuam com suas próprias credenciais salvas e sessões gerenciadas pelo backend.",
        cardTitle: (baselineName) => baselineName,
        cardDescription: (baseUrl) => baseUrl,
        successToast: (baselineName) => `Sessão criada via ${baselineName}.`,
        fields: {
          password: "Senha do Pi-hole",
          passwordDescription:
            "Use a senha do Pi-hole master para autorizar a sessão inicial da baseline e liberar o painel.",
        },
        validationPassword: "Informe a senha do Pi-hole.",
        submit: {
          idle: "Entrar no YAPD",
          loading: "Abrindo sessão...",
        },
      },
      "yapd-password": {
        badge: "Login do YAPD",
        title: "Entre usando a senha do YAPD",
        description:
          "O setup definiu uma senha própria do produto. O painel agora autentica operadores sem depender da senha do Pi-hole master.",
        primaryNote: "A senha humana do YAPD é validada localmente pelo backend e armazenada apenas como hash.",
        secondaryNote:
          "A baseline continua cadastrada para operações do sistema, mas não participa do login humano neste modo.",
        cardTitle: () => "Senha do YAPD",
        cardDescription: (baseUrl) => `Baseline técnica: ${baseUrl}`,
        successToast: () => "Sessão criada com a senha do YAPD.",
        fields: {
          password: "Senha do YAPD",
          passwordDescription: "Use a senha definida no passo 3 do setup inicial.",
        },
        validationPassword: "Informe a senha do YAPD.",
        submit: {
          idle: "Entrar no YAPD",
          loading: "Validando senha...",
        },
      },
    },
  },
  "en-US": {
    primaryInstanceLabel: "Primary Pi-hole",
    modes: {
      "pihole-master": {
        badge: "Baseline login",
        title: "Sign in with the master Pi-hole",
        description:
          "YAPD uses the official master Pi-hole login to seed the baseline session and synchronize the managed sessions of the instances.",
        primaryNote:
          "Instance credentials were defined during setup. The baseline human login reuses the SID obtained now instead of opening a second session right after login.",
        secondaryNote: "Other instances keep their own stored credentials and backend-managed sessions.",
        cardTitle: (baselineName) => baselineName,
        cardDescription: (baseUrl) => baseUrl,
        successToast: (baselineName) => `Session created through ${baselineName}.`,
        fields: {
          password: "Pi-hole password",
          passwordDescription:
            "Use the master Pi-hole password to authorize the baseline session and unlock the panel.",
        },
        validationPassword: "Provide the Pi-hole password.",
        submit: {
          idle: "Sign in to YAPD",
          loading: "Opening session...",
        },
      },
      "yapd-password": {
        badge: "YAPD login",
        title: "Sign in with the YAPD password",
        description:
          "Setup defined a dedicated product password. The panel now authenticates operators without relying on the master Pi-hole password.",
        primaryNote: "The human YAPD password is validated locally by the backend and stored only as a hash.",
        secondaryNote:
          "The baseline is still registered for system operations, but it is not part of human login in this mode.",
        cardTitle: () => "YAPD password",
        cardDescription: (baseUrl) => `Technical baseline: ${baseUrl}`,
        successToast: () => "Session created with the YAPD password.",
        fields: {
          password: "YAPD password",
          passwordDescription: "Use the password defined in step 3 of the initial setup.",
        },
        validationPassword: "Provide the YAPD password.",
        submit: {
          idle: "Sign in to YAPD",
          loading: "Validating password...",
        },
      },
    },
  },
};

export function getLoginCopy(locale: AppLocale) {
  return loginCopy[locale] ?? loginCopy[DEFAULT_LOCALE];
}
