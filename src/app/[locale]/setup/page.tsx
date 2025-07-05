"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname, useRouter } from "next/navigation";
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

const piholeSchema = z.object({
  url: z.string().url({ message: "Please enter a valid URL." }),
  apiKey: z.string().optional(),
});

const step2Schema = z
  .object({
    piholes: z.array(piholeSchema).min(1).max(5),
    sameApiKey: z.boolean(),
    apiKey: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sameApiKey) {
      if (!data.apiKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "API Key is required.",
          path: ["apiKey"],
        });
      }
    } else {
      data.piholes.forEach((p, i) => {
        if (!p.apiKey) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "API Key is required.",
            path: ["piholes", i, "apiKey"],
          });
        }
      });
    }
  });

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

const Step3 = () => (
  <div className="flex h-full flex-col items-center justify-center space-y-4 text-center">
    <h3 className="text-2xl font-semibold">Configuration Complete!</h3>
    <p className="text-muted-foreground">
      You have successfully configured your dashboard.
    </p>
    <p>Click &quot;Finish&quot; to be redirected to the main page.</p>
  </div>
);

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

function Page() {
  const [step, setStep] = useState(1);
  const router = useRouter();
  const t = useTranslations("Setup");

  const form = useForm<z.infer<typeof step2Schema>>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      piholes: [{ url: "", apiKey: "" }],
      sameApiKey: false,
      apiKey: "",
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
      const values = form.getValues();
      if (values.sameApiKey) {
        values.piholes = values.piholes.map((p) => ({
          ...p,
          apiKey: values.apiKey,
        }));
      }
      console.log("Step 2 Data:", values);
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
            Follow the steps to configure your dashboard. Step {step} of 3.
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
                  name="sameApiKey"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel>{t("step2_same_api")}</FormLabel>
                    </FormItem>
                  )}
                />

                {fields.map((item, index) => (
                  <div key={item.id} className="space-y-4">
                    <FormField
                      control={form.control}
                      name={`piholes.${index}.url`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("step2_pihole_url")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t(
                                "step2_pihole_url_placeholder"
                              )}
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
                    {!form.watch("sameApiKey") && (
                      <FormField
                        control={form.control}
                        name={`piholes.${index}.apiKey`}
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

                {form.watch("sameApiKey") && (
                  <FormField
                    control={form.control}
                    name="apiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("step2_shared_api_key")}</FormLabel>
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
                )}

                {fields.length < 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ url: "", apiKey: "" })}
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
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < 3 && <Button onClick={handleNext}>Next</Button>}
          {step === 3 && <Button onClick={handleFinish}>Finish</Button>}
        </CardFooter>
      </Card>
    </div>
  );
}

export default Page;
