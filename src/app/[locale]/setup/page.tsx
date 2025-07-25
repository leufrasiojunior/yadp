"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import Step1 from "./_components/step1";
import Step2 from "./_components/step2";
import Step3 from "./_components/step3";
import Step4 from "./_components/step4";
import Step5 from "./_components/step5"; // Importa o novo componente da etapa 5
import { useSetupForm } from "./hooks/use-setup-form";

export default function SetupYadp() {
  // Estado para verificar se uma configuração anterior existe
  const [needsConfirmation, setNeedsConfirmation] = useState<boolean | null>(null);
  // Estado para confirmar a substituição da configuração anterior
  const [confirmed, setConfirmed] = useState(false);
  // Estado para controlar a etapa atual do processo de configuração
  const [step, setStep] = useState(1);

  const router = useRouter();
  const t = useTranslations("Setup");

  // Hook para gerenciar o formulário de configuração
  const { form, fields, append, remove } = useSetupForm();

  // Efeito para verificar se uma configuração anterior existe
  useEffect(() => {
    async function checkConfig() {
      const res = await fetch("/api/config");
      const json = await res.json();
      setNeedsConfirmation(json.hasPiholesConfig);
    }
    checkConfig();
  }, []);

  // Função para avançar para a próxima etapa
  const handleNext = async () => {
    // Valida o formulário nas etapas 2 e 3 antes de avançar
    if (step === 2 || step === 3) {
      const isValid = await form.trigger();
      if (!isValid) return;
    }
    setStep((prev) => prev + 1);
  };

  // Função para voltar para a etapa anterior
  const handleBack = () => {
    setStep((prev) => prev - 1);
  };

  // Função para finalizar a configuração
  const handleFinish = async () => {
    // Obtém os valores do formulário
    const {
      piholes,
      samePassword,
      primaryIndex,
      usePiholeAuth,
      yapdPassword,
      themePreset,
      themeMode,
      sidebarVariant,
      sidebarCollapsible,
      contentLayout,
    } = form.getValues();

    // Formata os dados dos Pi-holes
    const final = piholes.map((item) => ({
      url: item.url,
      password: samePassword ? piholes[0].password : item.password,
    }));

    // Obtém a URL do Pi-hole primário
    const mainUrl = piholes[Number(primaryIndex)]?.url ?? "";

    // Cria o payload para a requisição
    const payload: Record<string, unknown> = {
      piholes: final,
      mainUrl,
      usePiholeAuth,
      theme_preset: themePreset,
      theme_mode: themeMode,
      sidebar_variant: sidebarVariant,
      sidebar_collapsible: sidebarCollapsible,
      content_layout: contentLayout,
    };

    // Adiciona a senha do YAPD ao payload se a autenticação do Pi-hole não for usada
    if (!usePiholeAuth) {
      payload["yapdPassword"] = yapdPassword;
    }

    // Envia os dados para a API
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Redireciona para a página inicial
    router.push("/");
  };

  // Exibe uma mensagem de carregamento enquanto a configuração é verificada
  if (needsConfirmation === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>{t("loading")}</p>
      </div>
    );
  }

  // Exibe uma mensagem de confirmação se uma configuração anterior existir
  if (needsConfirmation && !confirmed) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{t("warning")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{t("needs_confirmation")}</p>
          </CardContent>
          <CardFooter className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => router.push("/")}>
              {t("cancel_button")}
            </Button>
            <Button onClick={() => setConfirmed(true)}>{t("confirm_button")}</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Renderiza o processo de configuração
  return (
    <div className="bg-background flex min-h-screen w-full items-center justify-center px-4">
      <Card className="w-full max-w-3xl rounded-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">{t("title")}</CardTitle>
          <CardDescription className="text-muted-foreground text-center text-sm">
            {t("description", { step })}
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="flex min-h-[300px] flex-col justify-center p-6">
          {/* Renderiza o componente da etapa atual */}
          {step === 1 && <Step1 />}
          {step === 2 && (
            <Step2 form={form} fields={fields} append={() => append({ url: "", password: "" })} remove={remove} t={t} />
          )}
          {step === 3 && <Step3 form={form} t={t} />}
          {step === 4 && <Step4 />}
          {step === 5 && <Step5 form={form} t={t} />}
        </CardContent>
        <Separator />
        <CardFooter className="flex justify-between p-6">
          {/* Renderiza o botão de voltar se não for a primeira etapa */}
          {step > 1 ? (
            <Button variant="outline" onClick={handleBack}>
              {t("back_button")}
            </Button>
          ) : (
            <div />
          )}
          {/* Renderiza o botão de avançar se não for a última etapa */}
          {step < 5 && <Button onClick={handleNext}>{t("next_button")}</Button>}
          {/* Renderiza o botão de finalizar na última etapa */}
          {step === 5 && <Button onClick={handleFinish}>{t("finish_button")}</Button>}
        </CardFooter>
      </Card>
    </div>
  );
}
