export function isCredentialPasswordError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("password") ||
    normalized.includes("senha") ||
    normalized.includes("credential") ||
    normalized.includes("credencial") ||
    normalized.includes("credenciais") ||
    normalized.includes("login failed") ||
    normalized.includes("login do pi-hole falhou") ||
    normalized.includes("invalid") ||
    normalized.includes("invalida") ||
    normalized.includes("inválida") ||
    normalized.includes("incorreta")
  );
}
