"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

const Step3 = () => {
  const t = useTranslations("Setup");
  return (
    <div className="flex h-full flex-col items-center justify-center space-y-4 text-center">
      <h3 className="text-2xl font-semibold">{t("step3_title")}</h3>
      <p className="text-muted-foreground">{t("step3_description")}</p>
      <p>{t("step3_instruction")}</p>
    </div>
  );
};

export default function SetupYadp() {
  const [step, setStep] = useState(1);
  const router = useRouter();
  const t = useTranslations("Setup");
  const step2Schema = z.object({
    samePassword: z.boolean().default(true),
    piholes: z
      .array(
        z.object({
          url: z.string().url({ message: t("step2_pihole_url_error") }),
          password: z.string().min(1, { message: t("step2_password_error") }),
        })
      )
      .min(1)
      .max(5),
  });

  const form = useForm<z.infer<typeof step2Schema>>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      samePassword: true,
      piholes: [{ url: "", password: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "piholes",
  });

  const handleNext = async () => {
    if (step === 2) {
      const isValid = await form.trigger();
      if (!isValid) return;
      console.log("Step 2 Data:", form.getValues());
    }
    setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setStep((prev) => prev - 1);
  };

  const handleFinish = async () => {
    const { piholes, samePassword } = form.getValues();
    const final = piholes.map((item) => ({
      url: item.url,
      password: samePassword ? piholes[0].password : item.password,
    }));
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ piholes: final }),
    });
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
              </form>
            </Form>
          )}
          {step === 3 && <Step3 />}


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

          {step < 3 && <Button onClick={handleNext}>{t("next_button")}</Button>}
          {step === 3 && (
            <Button onClick={handleFinish}>{t("finish_button")}</Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
