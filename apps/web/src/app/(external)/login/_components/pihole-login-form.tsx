"use client";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AppSession } from "@/components/yapd/app-session-provider";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getBrowserApiClient } from "@/lib/api/yapd-client";
import { useWebI18n } from "@/lib/i18n/client";

type PiholeLoginFormCopy = {
  fields: {
    password: string;
    passwordDescription: string;
  };
  validationPassword: string;
  submit: {
    idle: string;
    loading: string;
  };
  successToast: string;
};

export function PiholeLoginForm({
  copy,
}: Readonly<{
  copy: PiholeLoginFormCopy;
}>) {
  const formSchema = z.object({
    password: z.string().min(4, copy.validationPassword),
  });
  const router = useRouter();
  const { messages } = useWebI18n();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const client = getBrowserApiClient();
    const { data, response } = await client.POST<AppSession>("/session/login", {
      body: {
        password: values.password,
      },
    });

    if (!response.ok) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    toast.success(copy.successToast);

    data?.instanceSessions.failedInstances.forEach((failure) => {
      const message =
        failure.message.trim().length > 0
          ? messages.dashboard.toasts.instanceFailure(failure.instanceName, failure.message)
          : messages.dashboard.toasts.genericInstanceFailure(failure.instanceName);

      toast.warning(message, {
        id: `login-instance-failure-${failure.instanceId}`,
      });
    });

    router.replace("/dashboard");
    router.refresh();
  };

  return (
    <form noValidate className="space-y-6" onSubmit={form.handleSubmit((values) => void onSubmit(values))}>
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="pihole-password">{copy.fields.password}</FieldLabel>
              <Input
                {...field}
                id="pihole-password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              <FieldDescription>{copy.fields.passwordDescription}</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? copy.submit.loading : copy.submit.idle}
      </Button>
    </form>
  );
}
