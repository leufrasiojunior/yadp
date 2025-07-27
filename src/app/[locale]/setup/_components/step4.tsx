"use client";

import { UseFormReturn } from "react-hook-form";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { THEME_PRESET_OPTIONS } from "@/types/preferences/theme";

import { SetupFormInput, SetupFormOutput } from "../hooks/use-setup-form";

type Step5Props = {
  form: UseFormReturn<SetupFormInput, unknown, SetupFormOutput>;
  t: (key: string) => string;
};

export default function Step5({ form, t }: Step5Props) {
  const themeMode = form.watch("themeMode");

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h4 className="text-sm leading-none font-medium">{t("step5_title")}</h4>
        <p className="text-muted-foreground text-xs">{t("step5_description")}</p>
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs font-medium">{t("step5_preset")}</Label>
          <Select value={form.watch("themePreset")} onValueChange={(value) => form.setValue("themePreset", value)}>
            <SelectTrigger size="sm" className="w-full text-xs">
              <SelectValue placeholder={t("step5_preset")} />
            </SelectTrigger>
            <SelectContent>
              {THEME_PRESET_OPTIONS.map((preset) => (
                <SelectItem key={preset.value} className="text-xs" value={preset.value}>
                  <span
                    className="size-2.5 rounded-full"
                    style={{
                      backgroundColor: themeMode === "dark" ? preset.primary.dark : preset.primary.light,
                    }}
                  />
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium">{t("step5_mode")}</Label>
          <ToggleGroup
            className="w-full"
            size="sm"
            variant="outline"
            type="single"
            value={form.watch("themeMode")}
            onValueChange={(value) => form.setValue("themeMode", value)}
          >
            <ToggleGroupItem className="text-xs" value="light" aria-label={t("step5_light")}>
              {t("step5_light")}
            </ToggleGroupItem>
            <ToggleGroupItem className="text-xs" value="dark" aria-label={t("step5_dark")}>
              {t("step5_dark")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium">{t("step5_sidebar_variant")}</Label>
          <ToggleGroup
            className="w-full"
            size="sm"
            variant="outline"
            type="single"
            value={form.watch("sidebarVariant")}
            onValueChange={(value) => form.setValue("sidebarVariant", value)}
          >
            <ToggleGroupItem className="text-xs" value="inset" aria-label={t("step5_inset")}>
              {t("step5_inset")}
            </ToggleGroupItem>
            <ToggleGroupItem className="text-xs" value="sidebar" aria-label={t("step5_sidebar")}>
              {t("step5_sidebar")}
            </ToggleGroupItem>
            <ToggleGroupItem className="text-xs" value="floating" aria-label={t("step5_floating")}>
              {t("step5_floating")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium">{t("step5_sidebar_collapsible")}</Label>
          <ToggleGroup
            className="w-full"
            size="sm"
            variant="outline"
            type="single"
            value={form.watch("sidebarCollapsible")}
            onValueChange={(value) => form.setValue("sidebarCollapsible", value)}
          >
            <ToggleGroupItem className="text-xs" value="icon" aria-label={t("step5_icon")}>
              {t("step5_icon")}
            </ToggleGroupItem>
            <ToggleGroupItem className="text-xs" value="offcanvas" aria-label={t("step5_offcanvas")}>
              {t("step5_offcanvas")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium">{t("step5_content_layout")}</Label>
          <ToggleGroup
            className="w-full"
            size="sm"
            variant="outline"
            type="single"
            value={form.watch("contentLayout")}
            onValueChange={(value) => form.setValue("contentLayout", value)}
          >
            <ToggleGroupItem className="text-xs" value="centered" aria-label={t("step5_centered")}>
              {t("step5_centered")}
            </ToggleGroupItem>
            <ToggleGroupItem className="text-xs" value="full-width" aria-label={t("step5_full_width")}>
              {t("step5_full_width")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
    </div>
  );
}
