"use client";

import { UseFormReturn } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { SetupFormInput, SetupFormOutput } from "../hooks/use-setup-form";

type Step3Props = {
  form: UseFormReturn<SetupFormInput, unknown, SetupFormOutput>;
  t: (key: string) => string;
};

export default function Step3({ form, t }: Step3Props) {
  const usePihole = form.watch("usePiholeAuth");

  return (
    <Form {...form}>
      <form className="space-y-6">
        <FormField
          control={form.control}
          name="usePiholeAuth"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-2">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="font-normal">{t("step3_use_pihole")}</FormLabel>
            </FormItem>
          )}
        />

        {!usePihole && (
          <FormField
            control={form.control}
            name="yapdPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("step3_yapd_password")}</FormLabel>
                <FormControl>
                  <Input type="password" placeholder={t("step3_yapd_password_placeholder")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </form>
    </Form>
  );
}
