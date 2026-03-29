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
    totp: string;
  };
  validationPassword: string;
  submit: {
    idle: string;
    loading: string;
  };
};

type LoginCopy = {
  unavailableTitle: string;
  unavailableDescription: string;
  modes: Record<SetupLoginMode, LoginModeCopy>;
};

const loginCopy: Record<AppLocale, LoginCopy> = {
  "pt-BR": {
    unavailableTitle: "Não foi possível abrir o login",
    unavailableDescription:
      "O login depende do backend para consultar a baseline, validar o modo de autenticação configurado e gravar o cookie seguro do YAPD.",
    modes: {
      "pihole-master": {
        badge: "Login da baseline",
        title: "Entre usando o Pi-hole master",
        description: "O YAPD usa o endpoint oficial do Pi-hole v6 para obter um SID e criar a sessão segura do painel.",
        primaryNote: "Senha e TOTP são enviados apenas para a baseline e não ficam gravados no banco do YAPD.",
        secondaryNote:
          "As outras instâncias continuam com segredos técnicos próprios para operações internas do backend.",
        cardTitle: (baselineName) => baselineName,
        cardDescription: (baseUrl) => baseUrl,
        successToast: (baselineName) => `Sessão criada via ${baselineName}.`,
        fields: {
          password: "Senha do Pi-hole",
          passwordDescription: "O backend não persiste essa senha. Ela só serve para obter o SID atual da interface.",
          totp: "Código TOTP opcional",
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
          totp: "",
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
    unavailableTitle: "Could not open login",
    unavailableDescription:
      "Login depends on the backend to query the baseline, validate the configured authentication mode, and store the secure YAPD cookie.",
    modes: {
      "pihole-master": {
        badge: "Baseline login",
        title: "Sign in with the master Pi-hole",
        description:
          "YAPD uses the official Pi-hole v6 endpoint to obtain an SID and create the dashboard's secure session.",
        primaryNote: "Password and TOTP are sent only to the baseline and are never stored in the YAPD database.",
        secondaryNote: "Other instances keep their own technical secrets for internal backend operations.",
        cardTitle: (baselineName) => baselineName,
        cardDescription: (baseUrl) => baseUrl,
        successToast: (baselineName) => `Session created through ${baselineName}.`,
        fields: {
          password: "Pi-hole password",
          passwordDescription: "The backend does not persist this password. It is only used to obtain the current SID.",
          totp: "Optional TOTP code",
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
          totp: "",
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
