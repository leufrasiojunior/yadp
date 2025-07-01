"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname, useRouter } from "next/navigation";
import { use, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { setRequestLocale } from 'next-intl/server';

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
import { Separator } from "@/components/ui/separator";

type Props = {
  params: {
    locale: string;
  };
};

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

const LanguageSwitcher = () => {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("Setup");

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLocale = e.target.value;
    // Replace the locale part of the path
    const newPath = pathname.replace(/\/(en|pt-br)/, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <div className="mb-4">
      <label htmlFor="language-select" className="mr-2">
        {t("language")}:
      </label>
      <select
        id="language-select"
        onChange={handleChange}
        defaultValue={pathname.split("/")[1]}
      >
        <option value="en">English</option>
        <option value="pt-br">Português (Brasil)</option>
      </select>
    </div>
  );
};

export default function Page({ params }: Props) {
  const [step, setStep] = useState(1);
  const router = useRouter();

  const t = useTranslations("Setup");

  const step2Schema = z.object({
    piholeUrl: z.string().url({ message: t("step2_pihole_url_error") }),
    apiKey: z.string().min(1, { message: t("step2_api_key_error") }),
  });

  const form = useForm<z.infer<typeof step2Schema>>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      piholeUrl: "",
      apiKey: "",
    },
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

  const handleFinish = () => {
    console.log("Setup finished!");
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

        <CardContent className="p-6 min-h-[300px] flex flex-col justify-center">
          <LanguageSwitcher />
          {step === 1 && <Step1 />}
          {step === 2 && (
            <Form {...form}>
              <form className="space-y-6">
                <FormField
                  control={form.control}
                  name="piholeUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("step2_pihole_url")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("step2_pihole_url_placeholder")} {...field} />
                      </FormControl>
                      <FormDescription>
                        {t("step2_pihole_url_description")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("step2_api_key")}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={t("step2_api_key_placeholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("step2_api_key_description")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
          {step === 3 && <Button onClick={handleFinish}>{t("finish_button")}</Button>}
        </CardFooter>
      </Card>
    </div>
  );
}


