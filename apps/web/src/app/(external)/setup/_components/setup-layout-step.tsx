import { Controller, type UseFormReturn } from "react-hook-form";

import type { SetupCopy } from "@/app/(external)/setup/setup-copy";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type FontKey, fontOptions } from "@/lib/fonts/registry";
import { type AppLocale, LOCALE_OPTIONS } from "@/lib/i18n/config";
import type { ContentLayout, NavbarStyle, SidebarCollapsible, SidebarVariant } from "@/lib/preferences/layout";
import { PREFERENCE_DEFAULTS } from "@/lib/preferences/preferences-config";
import { THEME_PRESET_OPTIONS, type ThemeMode, type ThemePreset } from "@/lib/preferences/theme";

import type { SetupWizardValues } from "./setup-form.types";

type LayoutLabels = {
  common: {
    languagePlaceholder: string;
  };
  controls: {
    language: string;
    themePreset: string;
    font: string;
    fontPlaceholder: string;
    themeMode: string;
    light: string;
    dark: string;
    system: string;
    pageLayout: string;
    centered: string;
    fullWidth: string;
    navbarBehavior: string;
    sticky: string;
    scroll: string;
    sidebarStyle: string;
    inset: string;
    sidebar: string;
    floating: string;
    sidebarCollapseMode: string;
    icon: string;
    offcanvas: string;
  };
};

export function SetupLayoutStep({
  copy,
  form,
  labels,
  locale,
}: Readonly<{
  copy: SetupCopy["layout"];
  form: UseFormReturn<SetupWizardValues>;
  labels: LayoutLabels;
  locale: AppLocale;
}>) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="font-semibold text-xl">{copy.title}</h3>
        <p className="text-muted-foreground text-sm leading-6">{copy.description}</p>
      </div>

      <div className="space-y-5 **:data-[slot=toggle-group]:w-full **:data-[slot=toggle-group-item]:flex-1 **:data-[slot=toggle-group-item]:text-xs">
        <div className="space-y-1">
          <Label className="font-medium text-xs">{labels.controls.language}</Label>
          <Controller
            control={form.control}
            name="applicationLanguage"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(value) => field.onChange(value as AppLocale)}>
                <SelectTrigger size="sm" className="w-full text-xs">
                  <SelectValue placeholder={labels.common.languagePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {LOCALE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} className="text-xs" value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-1">
          <Label className="font-medium text-xs">{labels.controls.themePreset}</Label>
          <Controller
            control={form.control}
            name="themePreset"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(value) => field.onChange(value as ThemePreset)}>
                <SelectTrigger size="sm" className="w-full text-xs">
                  <SelectValue placeholder="Preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {THEME_PRESET_OPTIONS.map((preset) => (
                      <SelectItem key={preset.value} className="text-xs" value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-1">
          <Label className="font-medium text-xs">{labels.controls.font}</Label>
          <Controller
            control={form.control}
            name="font"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(value) => field.onChange(value as FontKey)}>
                <SelectTrigger size="sm" className="w-full text-xs">
                  <SelectValue placeholder={labels.controls.fontPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {fontOptions.map((font) => (
                      <SelectItem key={font.key} className="text-xs" value={font.key}>
                        {font.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-1">
          <Label className="font-medium text-xs">{labels.controls.themeMode}</Label>
          <Controller
            control={form.control}
            name="themeMode"
            render={({ field }) => (
              <ToggleGroup
                size="sm"
                variant="outline"
                type="single"
                value={field.value}
                onValueChange={(value) => {
                  if (value) {
                    field.onChange(value as ThemeMode);
                  }
                }}
              >
                <ToggleGroupItem value="light" aria-label={labels.controls.light}>
                  {labels.controls.light}
                </ToggleGroupItem>
                <ToggleGroupItem value="dark" aria-label={labels.controls.dark}>
                  {labels.controls.dark}
                </ToggleGroupItem>
                <ToggleGroupItem value="system" aria-label={labels.controls.system}>
                  {labels.controls.system}
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          />
        </div>

        <div className="space-y-1">
          <Label className="font-medium text-xs">{labels.controls.pageLayout}</Label>
          <Controller
            control={form.control}
            name="contentLayout"
            render={({ field }) => (
              <ToggleGroup
                size="sm"
                variant="outline"
                type="single"
                value={field.value}
                onValueChange={(value) => {
                  if (value) {
                    field.onChange(value as ContentLayout);
                  }
                }}
              >
                <ToggleGroupItem value="centered" aria-label={labels.controls.centered}>
                  {labels.controls.centered}
                </ToggleGroupItem>
                <ToggleGroupItem value="full-width" aria-label={labels.controls.fullWidth}>
                  {labels.controls.fullWidth}
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          />
        </div>

        <div className="space-y-1">
          <Label className="font-medium text-xs">{labels.controls.navbarBehavior}</Label>
          <Controller
            control={form.control}
            name="navbarStyle"
            render={({ field }) => (
              <ToggleGroup
                size="sm"
                variant="outline"
                type="single"
                value={field.value}
                onValueChange={(value) => {
                  if (value) {
                    field.onChange(value as NavbarStyle);
                  }
                }}
              >
                <ToggleGroupItem value="sticky" aria-label={labels.controls.sticky}>
                  {labels.controls.sticky}
                </ToggleGroupItem>
                <ToggleGroupItem value="scroll" aria-label={labels.controls.scroll}>
                  {labels.controls.scroll}
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          />
        </div>

        <div className="space-y-1">
          <Label className="font-medium text-xs">{labels.controls.sidebarStyle}</Label>
          <Controller
            control={form.control}
            name="sidebarVariant"
            render={({ field }) => (
              <ToggleGroup
                size="sm"
                variant="outline"
                type="single"
                value={field.value}
                onValueChange={(value) => {
                  if (value) {
                    field.onChange(value as SidebarVariant);
                  }
                }}
              >
                <ToggleGroupItem value="inset" aria-label={labels.controls.inset}>
                  {labels.controls.inset}
                </ToggleGroupItem>
                <ToggleGroupItem value="sidebar" aria-label={labels.controls.sidebar}>
                  {labels.controls.sidebar}
                </ToggleGroupItem>
                <ToggleGroupItem value="floating" aria-label={labels.controls.floating}>
                  {labels.controls.floating}
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          />
        </div>

        <div className="space-y-1">
          <Label className="font-medium text-xs">{labels.controls.sidebarCollapseMode}</Label>
          <Controller
            control={form.control}
            name="sidebarCollapsible"
            render={({ field }) => (
              <ToggleGroup
                size="sm"
                variant="outline"
                type="single"
                value={field.value}
                onValueChange={(value) => {
                  if (value) {
                    field.onChange(value as SidebarCollapsible);
                  }
                }}
              >
                <ToggleGroupItem value="icon" aria-label={labels.controls.icon}>
                  {labels.controls.icon}
                </ToggleGroupItem>
                <ToggleGroupItem value="offcanvas" aria-label={labels.controls.offcanvas}>
                  {labels.controls.offcanvas}
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          />
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full text-xs"
          onClick={() => {
            form.setValue("applicationLanguage", locale);
            form.setValue("themePreset", PREFERENCE_DEFAULTS.theme_preset);
            form.setValue("font", PREFERENCE_DEFAULTS.font);
            form.setValue("themeMode", PREFERENCE_DEFAULTS.theme_mode);
            form.setValue("contentLayout", PREFERENCE_DEFAULTS.content_layout);
            form.setValue("navbarStyle", PREFERENCE_DEFAULTS.navbar_style);
            form.setValue("sidebarVariant", PREFERENCE_DEFAULTS.sidebar_variant);
            form.setValue("sidebarCollapsible", PREFERENCE_DEFAULTS.sidebar_collapsible);
          }}
        >
          {copy.restore}
        </Button>
      </div>
    </div>
  );
}
