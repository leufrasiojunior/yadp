import { type ApiLocale, DEFAULT_API_LOCALE } from "./locale";

type MessageValue = string | ((params: Record<string, string>) => string);

type ApiMessageKey =
  | "csrf.invalid"
  | "instances.invalidCredentials"
  | "instances.notFound"
  | "pihole.refused"
  | "pihole.reachable"
  | "pihole.timeout"
  | "pihole.unresolved"
  | "pihole.unreachable"
  | "session.baselineMissing"
  | "session.baselineRequired"
  | "session.expired"
  | "session.localLoginFailed"
  | "session.localLoginUnavailable"
  | "session.loginFailed"
  | "session.noActiveSession"
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
    "instances.invalidCredentials": "As credenciais do Pi-hole são inválidas.",
    "instances.notFound": "Instância não encontrada.",
    "pihole.refused": ({ baseUrl }) =>
      `A conexão foi recusada por ${baseUrl}. Verifique o host, a porta e se o Pi-hole está em execução.`,
    "pihole.reachable": "Pi-hole alcançável",
    "pihole.timeout": ({ baseUrl }) =>
      `A conexão com ${baseUrl} expirou. Verifique se o Pi-hole está online e acessível pelo backend.`,
    "pihole.unresolved": ({ baseUrl }) =>
      `Não foi possível resolver ${baseUrl}. Verifique o hostname ou use o IP correto.`,
    "pihole.unreachable": ({ baseUrl }) =>
      `Não foi possível alcançar ${baseUrl}. Verifique a URL, a rede e as configurações de TLS desta instância.`,
    "session.baselineMissing": "A instância baseline não está mais disponível.",
    "session.baselineRequired": "Configure a baseline antes de fazer login.",
    "session.expired": "A sessão expirou.",
    "session.localLoginFailed": "A senha do YAPD está incorreta.",
    "session.localLoginUnavailable": "O login local do YAPD não está configurado.",
    "session.loginFailed": "O login do Pi-hole falhou.",
    "session.noActiveSession": "Nenhuma sessão ativa do YAPD foi encontrada.",
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
    "instances.invalidCredentials": "The Pi-hole credentials are invalid.",
    "instances.notFound": "Instance not found.",
    "pihole.refused": ({ baseUrl }) =>
      `Connection refused by ${baseUrl}. Check the host, port, and whether the Pi-hole is running.`,
    "pihole.reachable": "Pi-hole reachable",
    "pihole.timeout": ({ baseUrl }) =>
      `Timed out while connecting to ${baseUrl}. Check if the Pi-hole is online and reachable from the backend.`,
    "pihole.unresolved": ({ baseUrl }) =>
      `Could not resolve ${baseUrl}. Check the hostname or use the correct IP address.`,
    "pihole.unreachable": ({ baseUrl }) =>
      `Could not reach ${baseUrl}. Check the URL, network path, and TLS settings for this instance.`,
    "session.baselineMissing": "The baseline instance is no longer available.",
    "session.baselineRequired": "You must configure the baseline before logging in.",
    "session.expired": "The session has expired.",
    "session.localLoginFailed": "The YAPD password is invalid.",
    "session.localLoginUnavailable": "Local YAPD login is not configured.",
    "session.loginFailed": "The Pi-hole login failed.",
    "session.noActiveSession": "No active YAPD session was found.",
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
