"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { login, AuthData } from "@/services/pihole/auth";
import { useTranslations } from "next-intl";

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

    const authResults: Record<string, AuthData> = {};

    if (config.usePiholeAuth) {
      try {
        const mainAuth = await login(config.mainUrl, password);
        authResults[config.mainUrl] = mainAuth;
      } catch {
        setError(t("error"));
        return;
      }
    } else {
      if (password !== config.yapdPassword) {
        setError(t("error"));
        return;
      }
    }

    await Promise.all(
      config.piholes.map(async ({ url, password: pwd }) => {
        if (authResults[url]) return;
        try {
          const data = await login(url, pwd);
          authResults[url] = data;
        } catch (e) {
          console.error("auth", url, e);
        }
      })
    );

    localStorage.setItem("piholesAuth", JSON.stringify(authResults));
    localStorage.setItem("yapdAuthTime", Date.now().toString());
    router.push("/");
  }

  if (loading) {
    return <p>{t("loading")}</p>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="w-full max-w-md shadow-lg rounded-2xl bg-card text-card-foreground">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">
            {t("title")}
          </CardTitle>
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
          {error && <p className="text-red-500 text-sm">{error}</p>}
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
