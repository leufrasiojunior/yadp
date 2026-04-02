import { type ApiLocale, DEFAULT_API_LOCALE } from "./locale";

type MessageValue = string | ((params: Record<string, string>) => string);

type ApiMessageKey =
  | "csrf.invalid"
  | "dashboard.allInstancesFailed"
  | "dashboard.instanceIdRequired"
  | "dashboard.noInstances"
  | "domains.instanceIdRequired"
  | "domains.operationRejected"
  | "instances.invalidTrustConfiguration"
  | "instances.invalidCredentials"
  | "instances.notFound"
  | "pihole.invalidResponse"
  | "pihole.invalidTechnicalCredentials"
  | "pihole.refused"
  | "pihole.reachable"
  | "pihole.socketClosed"
  | "pihole.tls"
  | "pihole.timeout"
  | "pihole.unresolved"
  | "pihole.unreachable"
  | "queries.instanceIdRequired"
  | "session.baselineMissing"
  | "session.baselineRequired"
  | "session.expired"
  | "session.localLoginFailed"
  | "session.localLoginUnavailable"
  | "session.loginFailed"
  | "session.noActiveSession"
  | "sync.blockingEnableTimerInvalid"
  | "sync.blockingAlreadyDesired"
  | "sync.emptyTargetSelection"
  | "sync.invalidTargetInstances"
  | "sync.noInstances"
  | "sync.precheckFailedSkip"
  | "setup.alreadyConfigured"
  | "setup.batchCreated"
  | "setup.created"
  | "setup.instanceCredentialsRequired"
  | "setup.instanceIncomplete"
  | "setup.instanceLabelFallback"
  | "setup.instanceValidationFailed"
  | "setup.invalidCredentials"
  | "setup.masterIncomplete"
  | "setup.loginModeRequired"
  | "setup.sharedCredentialsRequired"
  | "setup.singleMasterRequired"
  | "setup.yapdPasswordRequired"
  | "setup.yapdPasswordTooShort";

const messages: Record<ApiLocale, Record<ApiMessageKey, MessageValue>> = {
  "pt-BR": {
    "csrf.invalid": "Token CSRF ausente ou inválido.",
    "dashboard.allInstancesFailed": "Nenhuma instância retornou métricas válidas.",
    "dashboard.instanceIdRequired": "Selecione uma instância válida para carregar o dashboard.",
    "dashboard.noInstances": "Nenhuma instância Pi-hole está cadastrada no YAPD.",
    "domains.instanceIdRequired": "Selecione uma instância válida para aplicar esta ação de domínio.",
    "domains.operationRejected": ({ baseUrl }) => `O Pi-hole em ${baseUrl} recusou a alteração de domínio.`,
    "instances.invalidTrustConfiguration":
      "Use CA personalizada ou self-signed explícito, mas não os dois ao mesmo tempo.",
    "instances.invalidCredentials": "As credenciais do Pi-hole são inválidas.",
    "instances.notFound": "Instância não encontrada.",
    "pihole.invalidResponse": ({ baseUrl, path }) =>
      `O Pi-hole em ${baseUrl} respondeu em um formato inesperado para ${path}.`,
    "pihole.invalidTechnicalCredentials": ({ baseUrl }) =>
      `As credenciais técnicas salvas para ${baseUrl} são inválidas.`,
    "pihole.refused": ({ baseUrl }) =>
      `A conexão foi recusada por ${baseUrl}. Verifique o host, a porta e se o Pi-hole está em execução.`,
    "pihole.reachable": "Pi-hole alcançável",
    "pihole.socketClosed": ({ baseUrl }) =>
      `A instância em ${baseUrl} encerrou a conexão antes de concluir a resposta. Isso costuma indicar instabilidade momentânea no serviço, proxy reverso ou excesso de requisições simultâneas.`,
    "pihole.tls": ({ baseUrl }) => `O certificado TLS apresentado por ${baseUrl} não é confiável para esta instância.`,
    "pihole.timeout": ({ baseUrl }) =>
      `A conexão com ${baseUrl} expirou. Verifique se o Pi-hole está online e acessível pelo backend.`,
    "pihole.unresolved": ({ baseUrl }) =>
      `Não foi possível resolver ${baseUrl}. Verifique o hostname ou use o IP correto.`,
    "pihole.unreachable": ({ baseUrl }) =>
      `Não foi possível alcançar ${baseUrl}. Verifique a URL, a rede e as configurações de TLS desta instância.`,
    "queries.instanceIdRequired": "Selecione uma instância válida para carregar as queries.",
    "session.baselineMissing": "A instância baseline não está mais disponível.",
    "session.baselineRequired": "Configure a baseline antes de fazer login.",
    "session.expired": "A sessão expirou.",
    "session.localLoginFailed": "A senha do YAPD está incorreta.",
    "session.localLoginUnavailable": "O login local do YAPD não está configurado.",
    "session.loginFailed": "O login do Pi-hole falhou.",
    "session.noActiveSession": "Nenhuma sessão ativa do YAPD foi encontrada.",
    "sync.blockingEnableTimerInvalid": "Ao reabilitar o blocking, o timer deve ser nulo.",
    "sync.blockingAlreadyDesired": "A instância já estava com o blocking no estado desejado.",
    "sync.emptyTargetSelection": "Nenhuma instância pronta foi selecionada para aplicar o sincronismo.",
    "sync.invalidTargetInstances": "A seleção de instâncias para o sincronismo é inválida ou está desatualizada.",
    "sync.noInstances": "Nenhuma instância Pi-hole gerenciada está disponível para sincronismo.",
    "sync.precheckFailedSkip": "Ignorada porque falhou na pré-checagem e não foi confirmada para execução.",
    "setup.alreadyConfigured": "Uma instância baseline já está configurada.",
    "setup.batchCreated": ({ count }) =>
      Number(count) === 1
        ? "Setup concluído com 1 Pi-hole cadastrado."
        : `Setup concluído com ${count} Pi-holes cadastrados.`,
    "setup.created": "Baseline configurada com sucesso.",
    "setup.instanceCredentialsRequired": ({ instance }) => `Preencha a senha de ${instance}.`,
    "setup.instanceIncomplete": ({ instance }) =>
      `Complete alias e URL de ${instance} ou deixe essa linha totalmente vazia.`,
    "setup.instanceLabelFallback": ({ index }) => `Pi-hole ${index}`,
    "setup.instanceValidationFailed": ({ instance, message }) => `${instance}: ${message}`,
    "setup.invalidCredentials": "As credenciais informadas do Pi-hole são inválidas.",
    "setup.loginModeRequired": "Selecione como o login humano do YAPD será realizado.",
    "setup.masterIncomplete": "Preencha todos os campos obrigatórios do Pi-hole marcado como master.",
    "setup.sharedCredentialsRequired": "Preencha a senha compartilhada para os Pi-holes preenchidos.",
    "setup.singleMasterRequired": "Selecione exatamente 1 Pi-hole como master.",
    "setup.yapdPasswordRequired": "Defina uma senha própria do YAPD para concluir o setup.",
    "setup.yapdPasswordTooShort": "A senha própria do YAPD deve ter pelo menos 8 caracteres.",
  },
  "en-US": {
    "csrf.invalid": "Missing or invalid CSRF token.",
    "dashboard.allInstancesFailed": "No instance returned valid dashboard metrics.",
    "dashboard.instanceIdRequired": "Select a valid instance to load the dashboard.",
    "dashboard.noInstances": "No Pi-hole instance is registered in YAPD.",
    "domains.instanceIdRequired": "Select a valid instance to apply this domain action.",
    "domains.operationRejected": ({ baseUrl }) => `The Pi-hole at ${baseUrl} rejected the domain change.`,
    "instances.invalidTrustConfiguration":
      "Use either a custom CA or explicit self-signed trust, but not both at the same time.",
    "instances.invalidCredentials": "The Pi-hole credentials are invalid.",
    "instances.notFound": "Instance not found.",
    "pihole.invalidResponse": ({ baseUrl, path }) =>
      `The Pi-hole at ${baseUrl} returned an unexpected payload for ${path}.`,
    "pihole.invalidTechnicalCredentials": ({ baseUrl }) =>
      `The saved technical credentials for ${baseUrl} are invalid.`,
    "pihole.refused": ({ baseUrl }) =>
      `Connection refused by ${baseUrl}. Check the host, port, and whether the Pi-hole is running.`,
    "pihole.reachable": "Pi-hole reachable",
    "pihole.socketClosed": ({ baseUrl }) =>
      `The instance at ${baseUrl} closed the connection before completing the response. This usually indicates a transient service issue, reverse proxy behavior, or too many simultaneous requests.`,
    "pihole.tls": ({ baseUrl }) => `The TLS certificate presented by ${baseUrl} is not trusted for this instance.`,
    "pihole.timeout": ({ baseUrl }) =>
      `Timed out while connecting to ${baseUrl}. Check if the Pi-hole is online and reachable from the backend.`,
    "pihole.unresolved": ({ baseUrl }) =>
      `Could not resolve ${baseUrl}. Check the hostname or use the correct IP address.`,
    "pihole.unreachable": ({ baseUrl }) =>
      `Could not reach ${baseUrl}. Check the URL, network path, and TLS settings for this instance.`,
    "queries.instanceIdRequired": "Select a valid instance to load queries.",
    "session.baselineMissing": "The baseline instance is no longer available.",
    "session.baselineRequired": "You must configure the baseline before logging in.",
    "session.expired": "The session has expired.",
    "session.localLoginFailed": "The YAPD password is invalid.",
    "session.localLoginUnavailable": "Local YAPD login is not configured.",
    "session.loginFailed": "The Pi-hole login failed.",
    "session.noActiveSession": "No active YAPD session was found.",
    "sync.blockingEnableTimerInvalid": "When re-enabling blocking, the timer must be null.",
    "sync.blockingAlreadyDesired": "The instance already matched the desired blocking state.",
    "sync.emptyTargetSelection": "No ready instance was selected to apply the sync.",
    "sync.invalidTargetInstances": "The selected sync instances are invalid or stale.",
    "sync.noInstances": "No managed Pi-hole instance is available for sync.",
    "sync.precheckFailedSkip": "Skipped because precheck failed and it was not confirmed for execution.",
    "setup.alreadyConfigured": "A baseline instance is already configured.",
    "setup.batchCreated": ({ count }) =>
      Number(count) === 1
        ? "Setup completed with 1 Pi-hole registered."
        : `Setup completed with ${count} Pi-holes registered.`,
    "setup.created": "Baseline configured successfully.",
    "setup.instanceCredentialsRequired": ({ instance }) => `Provide the password for ${instance}.`,
    "setup.instanceIncomplete": ({ instance }) =>
      `Complete the alias and URL for ${instance} or leave that row entirely empty.`,
    "setup.instanceLabelFallback": ({ index }) => `Pi-hole ${index}`,
    "setup.instanceValidationFailed": ({ instance, message }) => `${instance}: ${message}`,
    "setup.invalidCredentials": "The provided Pi-hole credentials are invalid.",
    "setup.loginModeRequired": "Choose how human login to YAPD should work.",
    "setup.masterIncomplete": "Fill in all required fields for the Pi-hole marked as master.",
    "setup.sharedCredentialsRequired": "Provide the shared password for the filled Pi-holes.",
    "setup.singleMasterRequired": "Select exactly 1 Pi-hole as master.",
    "setup.yapdPasswordRequired": "Set a dedicated YAPD password to finish setup.",
    "setup.yapdPasswordTooShort": "The dedicated YAPD password must be at least 8 characters long.",
  },
};

export function translateApi(locale: ApiLocale, key: ApiMessageKey, params: Record<string, string> = {}) {
  const entry = (messages[locale] ?? messages[DEFAULT_API_LOCALE])[key];

  if (typeof entry === "function") {
    return entry(params);
  }

  return entry;
}
