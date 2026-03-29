"use client";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getBrowserApiClient } from "@/lib/api/yapd-client";

type YapdPasswordLoginFormCopy = {
  fields: {
    password: string;
    passwordDescription: string;
    totp: string;
  };
  validationPassword: string;
  submit: {
    idle: string;
    loading: string;
  };
  successToast: string;
};

export function YapdPasswordLoginForm({
  copy,
}: Readonly<{
  copy: YapdPasswordLoginFormCopy;
}>) {
  const formSchema = z.object({
    password: z.string().min(8, copy.validationPassword),
  });
  const router = useRouter();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const client = getBrowserApiClient();
    const { response } = await client.POST("/session/login", {
      body: {
        password: values.password,
      },
    });

    if (!response.ok) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    toast.success(copy.successToast);
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
              <FieldLabel htmlFor="yapd-password">{copy.fields.password}</FieldLabel>
              <Input
                {...field}
                id="yapd-password"
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
