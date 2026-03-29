import { ShieldCheck } from "lucide-react";
import { Controller, type UseFormReturn } from "react-hook-form";

import type { SetupCopy } from "@/app/(external)/setup/setup-copy";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

import type { SetupWizardValues } from "./setup-form.types";

export function SetupLoginStep({
  copy,
  form,
  loginMode,
}: Readonly<{
  copy: SetupCopy["loginMode"];
  form: UseFormReturn<SetupWizardValues>;
  loginMode: SetupWizardValues["loginMode"];
}>) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="font-semibold text-xl">{copy.title}</h3>
        <p className="text-muted-foreground text-sm leading-6">{copy.description}</p>
      </div>

      <Controller
        control={form.control}
        name="loginMode"
        render={({ field, fieldState }) => (
          <Field className="gap-4" data-invalid={fieldState.invalid}>
            <RadioGroup
              value={field.value}
              onValueChange={(value) => field.onChange(value as SetupWizardValues["loginMode"])}
              className="gap-4"
            >
              <label
                htmlFor="login-mode-pihole"
                className={cn(
                  "block rounded-xl border p-5 transition",
                  field.value === "pihole-master" ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem id="login-mode-pihole" value="pihole-master" />
                  <div className="space-y-1">
                    <div className="font-medium">{copy.piholeMasterTitle}</div>
                    <p className="text-muted-foreground text-sm leading-6">{copy.piholeMasterDescription}</p>
                  </div>
                </div>
              </label>

              <label
                htmlFor="login-mode-yapd"
                className={cn(
                  "block rounded-xl border p-5 transition",
                  field.value === "yapd-password" ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem id="login-mode-yapd" value="yapd-password" />
                  <div className="space-y-1">
                    <div className="font-medium">{copy.yapdPasswordTitle}</div>
                    <p className="text-muted-foreground text-sm leading-6">{copy.yapdPasswordDescription}</p>
                  </div>
                </div>
              </label>
            </RadioGroup>
            {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
          </Field>
        )}
      />

      {loginMode === "yapd-password" ? (
        <Card className="border-primary/15 bg-primary/5">
          <CardHeader>
            <CardTitle>{copy.yapdPasswordTitle}</CardTitle>
            <CardDescription>{copy.yapdPasswordDescription}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field className="gap-1.5" data-invalid={Boolean(form.formState.errors.yapdPassword)}>
              <FieldLabel htmlFor="setup-yapd-password">{copy.password}</FieldLabel>
              <Input
                id="setup-yapd-password"
                type="password"
                placeholder="••••••••"
                aria-invalid={Boolean(form.formState.errors.yapdPassword)}
                {...form.register("yapdPassword")}
              />
              <FieldDescription>{copy.passwordDescription}</FieldDescription>
              <FieldError errors={[form.formState.errors.yapdPassword]} />
            </Field>
            <Field className="gap-1.5" data-invalid={Boolean(form.formState.errors.confirmYapdPassword)}>
              <FieldLabel htmlFor="setup-yapd-password-confirm">{copy.confirmPassword}</FieldLabel>
              <Input
                id="setup-yapd-password-confirm"
                type="password"
                placeholder="••••••••"
                aria-invalid={Boolean(form.formState.errors.confirmYapdPassword)}
                {...form.register("confirmYapdPassword")}
              />
              <FieldError errors={[form.formState.errors.confirmYapdPassword]} />
            </Field>
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>{copy.piholeMasterTitle}</AlertTitle>
          <AlertDescription>{copy.piholeMasterDescription}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
