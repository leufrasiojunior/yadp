"use client";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getBrowserApiClient } from "@/lib/api/yapd-client";

const formSchema = z.object({
  name: z.string().min(2, "Informe um nome para a baseline."),
  baseUrl: z.string().url("Use uma URL completa, como https://pi.hole."),
  servicePassword: z.string().min(4, "Informe a senha ou application password do Pi-hole."),
  totp: z.string().optional(),
  allowSelfSigned: z.boolean().default(false),
  certificatePem: z.string().optional(),
});

export function SetupForm() {
  const router = useRouter();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "Pi-hole Principal",
      baseUrl: "https://pi.hole",
      servicePassword: "",
      totp: "",
      allowSelfSigned: false,
      certificatePem: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const client = getBrowserApiClient();
    const { response } = await client.POST("/setup/baseline", {
      body: {
        ...values,
        totp: values.totp || undefined,
        certificatePem: values.certificatePem || undefined,
      },
    });

    if (!response.ok) {
      toast.error(await getApiErrorMessage(response));
      return;
    }

    toast.success("Baseline configurada com sucesso.");
    router.replace("/login");
    router.refresh();
  };

  return (
    <form noValidate className="space-y-6" onSubmit={form.handleSubmit((values) => void onSubmit(values))}>
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="baseline-name">Nome da baseline</FieldLabel>
              <Input {...field} id="baseline-name" placeholder="Pi-hole Principal" aria-invalid={fieldState.invalid} />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="baseUrl"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="baseline-url">Base URL</FieldLabel>
              <Input {...field} id="baseline-url" placeholder="https://pi.hole" aria-invalid={fieldState.invalid} />
              <FieldDescription>Use o host principal que sera a autoridade de login do produto.</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="servicePassword"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="service-password">Senha/Application password</FieldLabel>
              <Input
                {...field}
                id="service-password"
                type="password"
                placeholder="••••••••"
                aria-invalid={fieldState.invalid}
              />
              <FieldDescription>
                Essa credencial sera guardada criptografada para operacoes tecnicas do backend.
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
              <FieldLabel htmlFor="baseline-totp">TOTP opcional</FieldLabel>
              <Input {...field} id="baseline-totp" placeholder="123456" aria-invalid={fieldState.invalid} />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="allowSelfSigned"
          render={({ field, fieldState }) => (
            <Field orientation="horizontal" data-invalid={fieldState.invalid}>
              <Checkbox
                id="allow-self-signed"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                aria-invalid={fieldState.invalid}
              />
              <FieldContent>
                <FieldLabel htmlFor="allow-self-signed" className="font-normal">
                  Permitir certificado self-signed explicitamente
                </FieldLabel>
                <FieldDescription>
                  Use apenas quando o Pi-hole tiver um certificado local que voce confia.
                </FieldDescription>
              </FieldContent>
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="certificatePem"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="certificate-pem">CA personalizada opcional</FieldLabel>
              <Textarea
                {...field}
                id="certificate-pem"
                rows={5}
                placeholder="-----BEGIN CERTIFICATE-----"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Validando baseline..." : "Salvar baseline"}
      </Button>
    </form>
  );
}
