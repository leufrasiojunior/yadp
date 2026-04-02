"use client";

import { Controller, type UseFormReturn } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { WebMessages } from "@/lib/i18n/messages";

import type { InstanceFormValues } from "./instance-form-schema";

type InstanceConnectionFieldsProps = {
  form: UseFormReturn<InstanceFormValues>;
  idPrefix: string;
  isAllowSelfSignedDisabled: boolean;
  messages: WebMessages;
  passwordDescription: string;
};

export function InstanceConnectionFields({
  form,
  idPrefix,
  isAllowSelfSignedDisabled,
  messages,
  passwordDescription,
}: Readonly<InstanceConnectionFieldsProps>) {
  return (
    <FieldGroup className="gap-4">
      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <Field className="gap-1.5" data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`${idPrefix}-name`}>{messages.forms.instances.create.name}</FieldLabel>
            <Input {...field} id={`${idPrefix}-name`} placeholder="Pi-hole Sala" aria-invalid={fieldState.invalid} />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        control={form.control}
        name="baseUrl"
        render={({ field, fieldState }) => (
          <Field className="gap-1.5" data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`${idPrefix}-url`}>{messages.forms.instances.create.baseUrl}</FieldLabel>
            <Input
              {...field}
              id={`${idPrefix}-url`}
              placeholder="https://pihole.lan"
              aria-invalid={fieldState.invalid}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        control={form.control}
        name="servicePassword"
        render={({ field, fieldState }) => (
          <Field className="gap-1.5" data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`${idPrefix}-password`}>{messages.forms.instances.create.password}</FieldLabel>
            <Input
              {...field}
              id={`${idPrefix}-password`}
              type="password"
              placeholder="••••••••"
              aria-invalid={fieldState.invalid}
            />
            <FieldDescription>{passwordDescription}</FieldDescription>
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
              id={`${idPrefix}-self-signed`}
              checked={field.value}
              disabled={isAllowSelfSignedDisabled}
              onCheckedChange={(checked) => field.onChange(Boolean(checked))}
            />
            <FieldContent>
              <FieldLabel htmlFor={`${idPrefix}-self-signed`} className="font-normal">
                {messages.forms.instances.create.allowSelfSigned}
              </FieldLabel>
            </FieldContent>
          </Field>
        )}
      />
      <Controller
        control={form.control}
        name="certificatePem"
        render={({ field, fieldState }) => (
          <Field className="gap-1.5" data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`${idPrefix}-cert`}>{messages.forms.instances.create.certificate}</FieldLabel>
            <Textarea
              {...field}
              id={`${idPrefix}-cert`}
              rows={4}
              placeholder="-----BEGIN CERTIFICATE-----"
              aria-invalid={fieldState.invalid}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </FieldGroup>
  );
}
