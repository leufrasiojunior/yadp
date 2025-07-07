"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { login } from "@/services/pihole/auth";
import { Separator } from "@/components/ui/separator";
import { LanguageSwitcher } from "@/components/general/languageSwitcher";

const Step1 = () => {
  const t = useTranslations("Setup");
  return (
    <div className="flex h-full flex-col items-center justify-center space-y-4 text-center">
      <h3 className="text-2xl font-semibold">{t("step1_title")}</h3>
      <p className="text-muted-foreground">{t("step1_description")}</p>
      <p>{t("step1_instruction")}</p>
    </div>
  );
};

export default function SetupYadp() {
  const [needsConfirmation, setNeedsConfirmation] = useState<boolean | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const [step, setStep] = useState(1);
  const router = useRouter();
  const t = useTranslations("Setup");
  const schema = z
    .object({
      samePassword: z.boolean().default(true),
      piholes: z
        .array(
          z.object({
            url: z.string().url({ message: t("step2_pihole_url_error") }),
            password: z.string().optional(),
          })
        )
        .min(1)
        .max(5),
      primaryIndex: z.number().int().default(0),
      usePiholeAuth: z.boolean().default(true),
      yapdPassword: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      data.piholes.forEach((item, idx) => {
        if (!data.samePassword || idx === 0) {
          if (!item.password || item.password.trim().length === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t("step2_password_error"),
              path: ["piholes", idx, "password"],
            });
          }
        }
      });

      if (data.primaryIndex < 0 || data.primaryIndex >= data.piholes.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("step2_primary_error"),
          path: ["primaryIndex"],
        });
      }

      if (!data.usePiholeAuth) {
        if (!data.yapdPassword || data.yapdPassword.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("step3_password_error"),
            path: ["yapdPassword"],
          });
        }
      }
    });

  const form = useForm<
    z.input<typeof schema>,
    unknown,
    z.infer<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      samePassword: true,
      piholes: [{ url: "", password: "" }],
      primaryIndex: 0,
      usePiholeAuth: true,
      yapdPassword: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "piholes",
  });

  const Step3 = () => {
    const usePihole = form.watch("usePiholeAuth");
    return (
      <Form {...form}>
        <form className="space-y-6">
          <FormField
            control={form.control}
            name="usePiholeAuth"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="font-normal">
                  {t("step3_use_pihole")}
                </FormLabel>
              </FormItem>
            )}
          />

          {!usePihole && (
            <FormField
              control={form.control}
              name="yapdPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("step3_yapd_password")}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={t("step3_yapd_password_placeholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </form>
      </Form>
    );
  };

  const Step4 = () => (
    <div className="flex h-full flex-col items-center justify-center space-y-4 text-center">
      <h3 className="text-2xl font-semibold">{t("step4_title")}</h3>
      <p className="text-muted-foreground">{t("step4_description")}</p>
      <p>{t("step4_instruction")}</p>
    </div>
  );

  // BUSCA flag na inicialização
  useEffect(() => {
    async function checkConfig() {
      const res = await fetch("/api/config")
      const json = await res.json()
      setNeedsConfirmation(json.hasPiholesConfig)
    }
    checkConfig()
  }, [])

  // Loading enquanto busca
  if (needsConfirmation === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>{t("loading")}</p>
      </div>
    )
  }

  // Se já havia config e usuário não confirmou ainda
  if (needsConfirmation && !confirmed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
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
    )
  }

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
    const {
      piholes,
      samePassword,
      primaryIndex,
      usePiholeAuth,
      yapdPassword,
    } = form.getValues();

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

    if (usePiholeAuth) {
      const pwd = samePassword
        ? piholes[0].password!
        : piholes[Number(primaryIndex)]?.password || "";
      try {
        const auth = await login(mainUrl, pwd);
        localStorage.setItem("piholesAuth", JSON.stringify({ [mainUrl]: auth }));
      } catch (e) {
        console.error("auth", e);
      }
    }

    router.push("/");
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <Card className="w-full max-w-3xl rounded-2xl shadow-lg">

        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">
            {t("title")}
          </CardTitle>
          <CardDescription className="text-center text-sm text-muted-foreground">
            {t("description", { step })}
          </CardDescription>
        </CardHeader>
        <Separator />
        <div className="flex justify-end pr-6 m-0 ">
          <LanguageSwitcher />
        </div>
        <CardContent className="p-6 min-h-[300px] flex flex-col justify-center">
          {step === 1 && <Step1 />}
          {step === 2 && (
            <Form {...form}>
              <form className="space-y-6">
                <FormField
                  control={form.control}
                  name="samePassword"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">
                        {t("step2_same_password")}
                      </FormLabel>
                    </FormItem>
                  )}
                />

                {fields.map((field, index) => (
                  <div key={field.id} className="space-y-4">
                    <FormField
                      control={form.control}
                      name={`piholes.${index}.url` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("step2_pihole_url")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t("step2_pihole_url_placeholder")}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            {t("step2_pihole_url_description")}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {(!form.watch("samePassword") || index === 0) && (
                      <FormField
                        control={form.control}
                        name={`piholes.${index}.password` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("step2_password")}</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder={t("step2_password_placeholder")}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              {t("step2_password_description")}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {index > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => remove(index)}
                      >
                        {t("step2_remove_url")}
                      </Button>
                    )}
                  </div>
                ))}

                {fields.length < 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ url: "", password: "" })}
                  >
                    {t("step2_add_url")}
                  </Button>
                )}

                <FormField
                  control={form.control}
                  name="primaryIndex"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("step2_primary_url")}</FormLabel>
                      <Select
                        value={String(field.value)}
                        onValueChange={(v) => field.onChange(Number(v))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("step2_primary_placeholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {fields.map((f, idx) => (
                            <SelectItem key={f.id} value={String(idx)}>
                              {form.watch(`piholes.${idx}.url`) || `#${idx + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {t("step2_primary_description")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          )}
          {step === 3 && <Step3 />}
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
          {step === 4 && (
            <Button onClick={handleFinish}>{t("finish_button")}</Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
