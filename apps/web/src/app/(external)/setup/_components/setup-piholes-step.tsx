import { Plus, Trash2 } from "lucide-react";
import { Controller, type FieldArrayWithId, type UseFormReturn } from "react-hook-form";

import type { SetupCopy } from "@/app/(external)/setup/setup-copy";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SetupCredentialMode } from "@/lib/api/yapd-types";
import { cn } from "@/lib/utils";

import { INITIAL_INSTANCE_COUNT, normalizeHostPath, normalizeText } from "./setup-form.helpers";
import type { SetupWizardValues } from "./setup-form.types";

export function SetupPiholesStep({
  copy,
  credentialsMode,
  fields,
  form,
  instances,
  masterIndex,
  onAddInstance,
  onRemoveInstance,
}: Readonly<{
  copy: SetupCopy["piholes"];
  credentialsMode: SetupCredentialMode;
  fields: FieldArrayWithId<SetupWizardValues, "instances", "id">[];
  form: UseFormReturn<SetupWizardValues>;
  instances: SetupWizardValues["instances"];
  masterIndex: number;
  onAddInstance: () => void;
  onRemoveInstance: (index: number) => void;
}>) {
  const sharedPasswordField = form.register("sharedPassword", {
    setValueAs: (value) => normalizeText(value),
  });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="font-semibold text-xl">{copy.title}</h3>
        <p className="text-muted-foreground text-sm leading-6">{copy.description}</p>
      </div>

      <Controller
        control={form.control}
        name="credentialsMode"
        render={({ field }) => (
          <Field orientation="horizontal">
            <Checkbox
              id="shared-password-toggle"
              checked={field.value === "shared"}
              onCheckedChange={(checked) => field.onChange(checked ? "shared" : "individual")}
            />
            <FieldContent>
              <FieldLabel htmlFor="shared-password-toggle">{copy.sharedPasswordToggle}</FieldLabel>
              <FieldDescription>{copy.sharedPasswordDescription}</FieldDescription>
            </FieldContent>
          </Field>
        )}
      />

      {credentialsMode === "shared" ? (
        <Field className="gap-1.5" data-invalid={Boolean(form.formState.errors.sharedPassword)}>
          <FieldLabel htmlFor="shared-password">{copy.sharedPassword}</FieldLabel>
          <Input
            id="shared-password"
            type="password"
            placeholder="••••••••"
            aria-invalid={Boolean(form.formState.errors.sharedPassword)}
            autoComplete="new-password"
            {...sharedPasswordField}
          />
          <FieldDescription>{copy.sharedPasswordHelp}</FieldDescription>
          <FieldError errors={[form.formState.errors.sharedPassword]} />
        </Field>
      ) : null}

      <div className="space-y-4">
        {fields.map((fieldItem, index) => {
          const instance = instances[index];
          const label = copy.rowTitle(index, instance?.name);
          const aliasError = form.formState.errors.instances?.[index]?.name;
          const hostPathError = form.formState.errors.instances?.[index]?.hostPath;
          const passwordError = form.formState.errors.instances?.[index]?.password;
          const aliasField = form.register(`instances.${index}.name`, {
            setValueAs: (value) => normalizeText(value),
          });
          const hostPathField = form.register(`instances.${index}.hostPath`, {
            setValueAs: (value) => normalizeHostPath(value),
            onBlur: (event) => {
              const nextValue = normalizeHostPath(event.target.value);
              form.setValue(`instances.${index}.hostPath`, nextValue, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
              });
            },
          });
          const passwordField = form.register(`instances.${index}.password`, {
            setValueAs: (value) => normalizeText(value),
          });

          return (
            <div
              key={fieldItem.id}
              className={cn(
                "space-y-4 rounded-xl border p-4",
                index === masterIndex && "border-primary/40 bg-primary/5",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium text-sm">{label}</p>
                  {index === masterIndex ? <p className="text-primary text-xs">{copy.masterDescription}</p> : null}
                </div>
                {index >= INITIAL_INSTANCE_COUNT ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => onRemoveInstance(index)}>
                    <Trash2 className="size-4" />
                    {copy.removeInstance}
                  </Button>
                ) : null}
              </div>

              <Field className="gap-1.5" data-invalid={Boolean(aliasError)}>
                <FieldLabel htmlFor={`instance-alias-${fieldItem.id}`}>{copy.alias}</FieldLabel>
                <Input
                  id={`instance-alias-${fieldItem.id}`}
                  placeholder={copy.aliasPlaceholder(index)}
                  aria-invalid={Boolean(aliasError)}
                  autoComplete="off"
                  {...aliasField}
                />
                <FieldError errors={[aliasError]} />
              </Field>

              <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)_auto] md:items-start">
                <Controller
                  control={form.control}
                  name={`instances.${index}.scheme`}
                  render={({ field }) => (
                    <Field className="gap-1.5">
                      <FieldLabel>{copy.scheme}</FieldLabel>
                      <Select value={field.value} onValueChange={(value) => field.onChange(value as "http" | "https")}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="http">http</SelectItem>
                          <SelectItem value="https">https</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />

                <Field className="gap-1.5" data-invalid={Boolean(hostPathError)}>
                  <FieldLabel htmlFor={`instance-url-${fieldItem.id}`}>{copy.url}</FieldLabel>
                  <Input
                    id={`instance-url-${fieldItem.id}`}
                    placeholder={copy.urlPlaceholder}
                    aria-invalid={Boolean(hostPathError)}
                    autoComplete="off"
                    {...hostPathField}
                  />
                  <FieldDescription>{copy.urlDescription}</FieldDescription>
                  <FieldError errors={[hostPathError]} />
                </Field>

                <Controller
                  control={form.control}
                  name={`instances.${index}.allowSelfSigned`}
                  render={({ field }) => (
                    <Field orientation="horizontal" className="pt-7">
                      <Checkbox
                        id={`allow-self-signed-${fieldItem.id}`}
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                      />
                      <FieldContent>
                        <Label
                          htmlFor={`allow-self-signed-${fieldItem.id}`}
                          className="cursor-pointer font-normal text-sm"
                        >
                          {copy.allowSelfSigned}
                        </Label>
                      </FieldContent>
                    </Field>
                  )}
                />
              </div>

              {credentialsMode === "individual" ? (
                <Field className="gap-1.5" data-invalid={Boolean(passwordError)}>
                  <FieldLabel htmlFor={`instance-password-${fieldItem.id}`}>{copy.password}</FieldLabel>
                  <Input
                    id={`instance-password-${fieldItem.id}`}
                    type="password"
                    placeholder="••••••••"
                    aria-invalid={Boolean(passwordError)}
                    autoComplete="new-password"
                    {...passwordField}
                  />
                  <FieldDescription>{copy.passwordDescription}</FieldDescription>
                  <FieldError errors={[passwordError]} />
                </Field>
              ) : null}
            </div>
          );
        })}
      </div>

      <Button type="button" variant="outline" className="w-full" onClick={onAddInstance}>
        <Plus className="size-4" />
        {copy.addInstance}
      </Button>

      <Controller
        control={form.control}
        name="masterIndex"
        render={({ field, fieldState }) => (
          <Field className="gap-1.5" data-invalid={fieldState.invalid}>
            <FieldLabel>{copy.masterTitle}</FieldLabel>
            <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
              <SelectTrigger>
                <SelectValue placeholder={copy.masterPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {fields.map((fieldItem, index) => (
                  <SelectItem key={fieldItem.id} value={String(index)}>
                    {copy.rowTitle(index, instances[index]?.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{copy.masterDescription}</FieldDescription>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
    </div>
  );
}
