"use client";

import { FieldArrayWithId, UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormField, FormItem, FormControl, FormLabel, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { SetupFormInput, SetupFormOutput } from "../hooks/use-setup-form";

type Step2Props = {
  form: UseFormReturn<SetupFormInput, unknown, SetupFormOutput>;
  fields: FieldArrayWithId<SetupFormInput, "piholes", "id">[];
  append: () => void;
  remove: (index: number) => void;
  t: (key: string) => string;
};

export default function Step2({ form, fields, append, remove, t }: Step2Props) {
  console.log(form);
  return (
    <Form {...form}>
      <form className="space-y-6">
        <FormField
          control={form.control}
          name="samePassword"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-2">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="font-normal">{t("step2_same_password")}</FormLabel>
            </FormItem>
          )}
        />

        {fields.map((field, index) => (
          <div key={field.id} className="space-y-4">
            <FormField
              control={form.control}
              name={`piholes.${index}.url`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("step2_pihole_url")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("step2_pihole_url_placeholder")} {...field} />
                  </FormControl>
                  <FormDescription>{t("step2_pihole_url_description")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(!form.watch("samePassword") || index === 0) && (
              <FormField
                control={form.control}
                name={`piholes.${index}.password`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("step2_password")}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder={t("step2_password_placeholder")} {...field} />
                    </FormControl>
                    <FormDescription>{t("step2_password_description")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {index > 0 && (
              <Button type="button" variant="outline" onClick={() => remove(index)}>
                {t("step2_remove_url")}
              </Button>
            )}
          </div>
        ))}

        {fields.length < 5 && (
          <Button type="button" variant="outline" onClick={() => append()}>
            {t("step2_add_url")}
          </Button>
        )}

        <FormField
          control={form.control}
          name="primaryIndex"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("step2_primary_url")}</FormLabel>
              <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("step2_primary_placeholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {fields.map((f, idx) => (
                    <SelectItem key={f.id} value={String(idx)}>
                      {form.watch(`piholes.${idx}.url`) || `#${idx + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>{t("step2_primary_description")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
