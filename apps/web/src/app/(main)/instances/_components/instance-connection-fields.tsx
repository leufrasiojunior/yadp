"use client";

import { Controller, type UseFormReturn } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { WebMessages } from "@/lib/i18n/messages";
import { normalizeManagedInstanceHostPath } from "@/lib/instances/managed-instance-base-url";

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
        name="hostPath"
        render={({ field, fieldState }) => (
          <Field className="gap-1.5" data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`${idPrefix}-url`}>{messages.forms.instances.create.baseUrl}</FieldLabel>
            <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3">
              <Controller
                control={form.control}
                name="scheme"
                render={({ field: schemeField }) => (
                  <Select
                    value={schemeField.value}
                    onValueChange={(value) => schemeField.onChange(value as "http" | "https")}
                  >
                    <SelectTrigger
                      className="w-full min-w-0"
                      aria-label={messages.forms.instances.create.baseUrlScheme}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="http">http://</SelectItem>
                      <SelectItem value="https">https://</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <Input
                {...field}
                id={`${idPrefix}-url`}
                placeholder={messages.forms.instances.create.baseUrlPlaceholder}
                aria-invalid={fieldState.invalid}
                onBlur={(event) => {
                  field.onBlur();
                  const normalizedValue = normalizeManagedInstanceHostPath(event.target.value);
                  form.setValue("hostPath", normalizedValue, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                }}
              />
            </div>
            <FieldDescription>{messages.forms.instances.create.baseUrlDescription}</FieldDescription>
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
