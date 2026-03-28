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

const formSchema = z.object({
  password: z.string().min(4, "Informe a senha do Pi-hole."),
  totp: z.string().optional(),
});

export function PiholeLoginForm({
  baseline,
}: Readonly<{
  baseline: {
    name: string;
    baseUrl: string;
  };
}>) {
  const router = useRouter();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: "",
      totp: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const client = getBrowserApiClient();
    const { response } = await client.POST("/session/login", {
      body: {
        password: values.password,
        totp: values.totp || undefined,
      },
    });

    if (!response.ok) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    toast.success(`Sessao criada via ${baseline.name}.`);
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
              <FieldLabel htmlFor="pihole-password">Senha do Pi-hole</FieldLabel>
              <Input
                {...field}
                id="pihole-password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              <FieldDescription>
                O backend nao persiste essa senha. Ela so serve para obter o SID atual da interface.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="totp"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="pihole-totp">Codigo TOTP opcional</FieldLabel>
              <Input {...field} id="pihole-totp" placeholder="123456" aria-invalid={fieldState.invalid} />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Abrindo sessao..." : "Entrar no YAPD"}
      </Button>
    </form>
  );
}
