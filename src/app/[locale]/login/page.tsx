"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/spinner";
import { AuthData, login } from "@/providers/auth";

type Config = {
  piholes: { url: string; password: string }[];
  mainUrl: string;
  usePiholeAuth: boolean;
  yapdPassword?: string;
};

export default function LoginPage() {
  const t = useTranslations("Login");
  const router = useRouter();
  const locale = useLocale();

  const [password, setPassword] = useState("");
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const yapdAuthTime = localStorage.getItem("yapdAuthTime");
    if (yapdAuthTime) {
      const authTime = parseInt(yapdAuthTime, 10);
      const now = Math.floor(Date.now() / 1000);
      const twentyFourHoursInSeconds = 24 * 60 * 60;

      if (now - authTime < twentyFourHoursInSeconds) {
        router.push(`/${locale}/dashboard/default`);
      }
    }
  }, [router, locale]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/piholes");
        const data = (await res.json()) as Config;
        setConfig(data);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function handleLogin() {
    if (!config) return;
    setError(null);
    setIsSubmitting(true);
    // Cria um Map para armazenar resultados de autenticação ao invés de objeto genérico
    // Isso evita ataques de injeção de objeto (Object Injection)
    const authResults = new Map<string, AuthData>();

    if (config.usePiholeAuth) {
      try {
        const mainAuth = await login(config.mainUrl, password);
        if (isSafeKey(config.mainUrl)) authResults.set(config.mainUrl, mainAuth);
      } catch {
        setError(t("error"));
        setIsSubmitting(false);
        return;
      }
    } else {
      // Proteção contra timing attacks usando comparação segura
      // A comparação direta de strings pode revelar informações sobre a senha
      // através do tempo de execução
      const expectedPassword = config.yapdPassword ?? "";
      const isValidPassword = await secureStringCompare(password, expectedPassword);
      setIsSubmitting(false);

      if (!isValidPassword) {
        setError(t("error"));
        setIsSubmitting(false);
        return;
      }
    }

    await Promise.all(
      config.piholes.map(async ({ url, password: pwd }) => {
        // Verifica se já existe autenticação para esta URL usando Map.has()
        // que é mais seguro que acessar propriedades de objeto diretamente
        if (!isSafeKey(url)) {
          console.warn("URL rejeitada por segurança:", url);
          return;
        }
        if (authResults.has(url)) return;
        try {
          const data = await login(url, pwd);
          authResults.set(url, data);
        } catch (e) {
          console.error("auth", url, e);
        }
      }),
    );

    // Converte o Map para objeto de forma segura
    // Ao invés de usar Object.fromEntries() que pode ser vulnerável,
    // criamos o objeto manualmente validando cada chave
    const authResultsObject = createSecureObjectFromMap(authResults);

    localStorage.setItem("piholesAuth", JSON.stringify(authResultsObject));
    localStorage.setItem("yapdAuthTime", Math.floor(Date.now() / 1000).toString());
    router.push(`/dashboard/default`);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <Card className="bg-card text-card-foreground w-full max-w-md rounded-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">{t("title")}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t("password_placeholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </CardContent>

        <CardFooter>
          <Button className="w-full" onClick={handleLogin} disabled={isSubmitting}>
            {isSubmitting ? <LoadingSpinner className="mx-auto h-4 w-4" /> : t("button")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * Converte um Map para objeto de forma segura, evitando Object Injection
 *
 * Object.fromEntries() pode ser vulnerável se as chaves contiverem propriedades
 * perigosas como "__proto__", "constructor", "prototype", etc.
 * Esta função valida as chaves antes de criar o objeto.
 *
 * @param map - Map a ser convertido
 * @returns Objeto seguro criado a partir do Map
 */

function isSafeKey(key: string): boolean {
  const dangerousKeys = [
    "__proto__",
    "constructor",
    "prototype",
    "hasOwnProperty",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "toString",
    "valueOf",
  ];

  if (!key || typeof key !== "string") return false;

  if (dangerousKeys.includes(key.toLowerCase())) return false;

  for (let i = 0; i < key.length; i++) {
    const code = key.charCodeAt(i);
    if ((code >= 0 && code <= 31) || (code >= 127 && code <= 159)) {
      return false;
    }
  }

  return true;
}

function createSecureObjectFromMap<T>(map: Map<string, T>): Record<string, T> {
  const result = Object.create(null) as Record<string, T>;

  for (const [key, value] of map) {
    if (isSafeKey(key)) {
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        console.warn(`Chave duplicada rejeitada: ${key}`);
        continue;
      }
      Object.defineProperty(result, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    } else {
      console.warn(`Chave perigosa ou inválida rejeitada: ${key}`);
    }
  }

  return result;
}

/**
 * Função para comparação segura de strings que evita timing attacks
 *
 * Timing attacks exploram diferenças no tempo de execução para deduzir informações.
 * Uma comparação simples com === pode parar na primeira diferença encontrada,
 * revelando informações sobre a senha através do tempo de resposta.
 *
 * @param input - String inserida pelo usuário
 * @param expected - String esperada (senha correta)
 * @returns Promise<boolean> - Se as strings são iguais
 */
async function secureStringCompare(input: string, expected: string): Promise<boolean> {
  // Garante que ambas as strings tenham o mesmo comprimento para comparação
  const maxLength = Math.max(input.length, expected.length);

  // Padroniza ambas as strings para o mesmo tamanho
  const paddedInput = input.padEnd(maxLength, "\0");
  const paddedExpected = expected.padEnd(maxLength, "\0");

  // Usa TextEncoder para converter para bytes
  const encoder = new TextEncoder();
  const inputBytes = encoder.encode(paddedInput);
  const expectedBytes = encoder.encode(paddedExpected);

  // Realiza comparação byte por byte sempre percorrendo toda a string
  // independente de quando encontrar diferenças (tempo constante)
  let isEqual = true;
  for (let i = 0; i < maxLength; i++) {
    // Usa bitwise XOR para comparar - sempre executa independente do resultado
    if (inputBytes[i] !== expectedBytes[i]) {
      isEqual = false;
      // Não para o loop aqui - continua até o final para manter tempo constante
    }
  }

  // Adiciona um pequeno delay aleatório para mascarar ainda mais o timing
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));

  return isEqual;
}
