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
import { useSetupForm } from "./hooks/use-setup-form";

export default function SetupYadp() {
  const [needsConfirmation, setNeedsConfirmation] = useState<boolean | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [step, setStep] = useState(1);

  const router = useRouter();
  const t = useTranslations("Setup");

  const { form, fields, append, remove } = useSetupForm();

  useEffect(() => {
    async function checkConfig() {
      const res = await fetch("/api/config");
      const json = await res.json();
      setNeedsConfirmation(json.hasPiholesConfig);
    }
    checkConfig();
  }, []);

  const handleNext = async () => {
    if (step === 2 || step === 3) {
      const isValid = await form.trigger();
      if (!isValid) return;
    }
    setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setStep((prev) => prev - 1);
  };

  const handleFinish = async () => {
    const { piholes, samePassword, primaryIndex, usePiholeAuth, yapdPassword } = form.getValues();

    const final = piholes.map((item) => ({
      url: item.url,
      password: samePassword ? piholes[0].password : item.password,
    }));

    const mainUrl = piholes[Number(primaryIndex)]?.url ?? "";

    const payload: Record<string, unknown> = {
      piholes: final,
      mainUrl,
      usePiholeAuth,
    };

    if (!usePiholeAuth) {
      payload["yapdPassword"] = yapdPassword;
    }

    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    router.push("/");
  };

  if (needsConfirmation === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>{t("loading")}</p>
      </div>
    );
  }

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
          {step === 1 && <Step1 />}
          {step === 2 && (
            <Step2 form={form} fields={fields} append={() => append({ url: "", password: "" })} remove={remove} t={t} />
          )}
          {step === 3 && <Step3 form={form} t={t} />}
          {step === 4 && <Step4 />}
        </CardContent>
        <Separator />
        <CardFooter className="flex justify-between p-6">
          {step > 1 ? (
            <Button variant="outline" onClick={handleBack}>
              {t("back_button")}
            </Button>
          ) : (
            <div />
          )}
          {step < 4 && <Button onClick={handleNext}>{t("next_button")}</Button>}
          {step === 4 && <Button onClick={handleFinish}>{t("finish_button")}</Button>}
        </CardFooter>
      </Card>
    </div>
  );
}
