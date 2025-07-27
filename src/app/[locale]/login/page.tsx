"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// import { login, AuthData } from "@/services/pihole/auth";

type Config = {
  piholes: { url: string; password: string }[];
  mainUrl: string;
  usePiholeAuth: boolean;
  yapdPassword?: string;
};

export default function LoginPage() {
  const t = useTranslations("Login");
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    // const authResults: Record<string, AuthData> = {};

    // if (config.usePiholeAuth) {
    //     try {
    //         const mainAuth = await login(config.mainUrl, password);
    //         authResults[config.mainUrl] = mainAuth;
    //     } catch {
    //         setError(t("error"));
    //         return;
    //     }
    // } else {
    //     if (password !== config.yapdPassword) {
    //         setError(t("error"));
    //         return;
    //     }
    // }

    // await Promise.all(
    //     config.piholes.map(async ({ url, password: pwd }) => {
    //         if (authResults[url]) return;
    //         try {
    //             const data = await login(url, pwd);
    //             authResults[url] = data;
    //         } catch (e) {
    //             console.error("auth", url, e);
    //         }
    //     })
    // );

    // localStorage.setItem("piholesAuth", JSON.stringify(authResults));
    localStorage.setItem("yapdAuthTime", Date.now().toString());
    router.push("/");
  }

  if (loading) {
    return <p>{t("loading")}</p>;
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
          <Button className="w-full" onClick={handleLogin}>
            {t("button")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
