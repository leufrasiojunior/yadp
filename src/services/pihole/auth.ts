export type AuthData = { sid: string; csrf: string }

export async function login(url: string, password: string): Promise<AuthData> {
  const authRes = await fetch("/api/piholes/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, password }),
  })
  if (!authRes.ok) {
    const err = await authRes.json().catch(() => null)
    throw new Error(err?.error || `Auth falhou em ${url}`)
  }
  const { sid, csrf } = (await authRes.json()) as AuthData
  return { sid, csrf }
}

/**
 * Reexecuta a autenticação para um Pi-hole específico.
 * Busca a senha na configuração (/api/piholes) e chama login novamente.
 */
const pending: Record<string, Promise<AuthData> | undefined> = {}

export async function renewLogin(url: string): Promise<AuthData> {
  if (pending[url]) return pending[url]!

  const renewPromise = (async () => {
    const confRes = await fetch("/api/piholes")
    if (!confRes.ok) {
      throw new Error("Falha ao ler configuração")
    }
    const { piholes } = (await confRes.json()) as {
      piholes: { url: string; password: string }[]
    }
    const item = piholes.find((p) => p.url === url)
    if (!item) {
      throw new Error(`Configuração não encontrada para ${url}`)
    }
    return login(item.url, item.password)
  })()

  pending[url] = renewPromise

  try {
    const data = await renewPromise
    // Atualiza localStorage mantendo os dados existentes
    try {
      const raw = localStorage.getItem("piholesAuth")
      const current: Record<string, AuthData> = raw ? JSON.parse(raw) : {}
      current[url] = data
      localStorage.setItem("piholesAuth", JSON.stringify(current))
    } catch {
      // ignore errors ao acessar localStorage
    }
    return data
  } finally {
    delete pending[url]
  }
}
