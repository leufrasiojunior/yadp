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
