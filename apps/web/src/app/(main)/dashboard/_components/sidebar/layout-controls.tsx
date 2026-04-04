"use client";

import { useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { Settings } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAppSession } from "@/components/yapd/app-session-provider";
import { LanguageSelect } from "@/components/yapd/language-select";
import { TimeZoneInput } from "@/components/yapd/time-zone-input";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getBrowserApiClient } from "@/lib/api/yapd-client";
import { type FontKey, fontOptions } from "@/lib/fonts/registry";
import { useWebI18n } from "@/lib/i18n/client";
import { applyTimeZoneToDocument, normalizeTimeZone } from "@/lib/i18n/config";
import type { ContentLayout, NavbarStyle, SidebarCollapsible, SidebarVariant } from "@/lib/preferences/layout";
import {
  applyContentLayout,
  applyFont,
  applyNavbarStyle,
  applySidebarCollapsible,
  applySidebarVariant,
} from "@/lib/preferences/layout-utils";
import { PREFERENCE_DEFAULTS } from "@/lib/preferences/preferences-config";
import { persistPreference } from "@/lib/preferences/preferences-storage";
import { THEME_PRESET_OPTIONS, type ThemeMode, type ThemePreset } from "@/lib/preferences/theme";
import { applyThemePreset } from "@/lib/preferences/theme-utils";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

export function LayoutControls() {
  const router = useRouter();
  const client = useMemo(() => getBrowserApiClient(), []);
  const { csrfToken } = useAppSession();
  const { messages } = useWebI18n();
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const resolvedThemeMode = usePreferencesStore((s) => s.resolvedThemeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);
  const timeZone = usePreferencesStore((s) => s.timeZone);
  const setTimeZone = usePreferencesStore((s) => s.setTimeZone);
  const themePreset = usePreferencesStore((s) => s.themePreset);
  const setThemePreset = usePreferencesStore((s) => s.setThemePreset);
  const contentLayout = usePreferencesStore((s) => s.contentLayout);
  const setContentLayout = usePreferencesStore((s) => s.setContentLayout);
  const navbarStyle = usePreferencesStore((s) => s.navbarStyle);
  const setNavbarStyle = usePreferencesStore((s) => s.setNavbarStyle);
  const variant = usePreferencesStore((s) => s.sidebarVariant);
  const setSidebarVariant = usePreferencesStore((s) => s.setSidebarVariant);
  const collapsible = usePreferencesStore((s) => s.sidebarCollapsible);
  const setSidebarCollapsible = usePreferencesStore((s) => s.setSidebarCollapsible);
  const font = usePreferencesStore((s) => s.font);
  const setFont = usePreferencesStore((s) => s.setFont);
  const [timeZoneError, setTimeZoneError] = useState<string | null>(null);
  const [isSavingTimeZone, setIsSavingTimeZone] = useState(false);

  const onThemePresetChange = async (preset: ThemePreset) => {
    applyThemePreset(preset);
    setThemePreset(preset);
    persistPreference("theme_preset", preset);
  };

  const onThemeModeChange = async (mode: ThemeMode | "") => {
    if (!mode) return;
    setThemeMode(mode);
    persistPreference("theme_mode", mode);
  };

  const onContentLayoutChange = async (layout: ContentLayout | "") => {
    if (!layout) return;
    applyContentLayout(layout);
    setContentLayout(layout);
    persistPreference("content_layout", layout);
  };

  const onNavbarStyleChange = async (style: NavbarStyle | "") => {
    if (!style) return;
    applyNavbarStyle(style);
    setNavbarStyle(style);
    persistPreference("navbar_style", style);
  };

  const onSidebarStyleChange = async (value: SidebarVariant | "") => {
    if (!value) return;
    setSidebarVariant(value);
    applySidebarVariant(value);
    persistPreference("sidebar_variant", value);
  };

  const onSidebarCollapseModeChange = async (value: SidebarCollapsible | "") => {
    if (!value) return;
    setSidebarCollapsible(value);
    applySidebarCollapsible(value);
    persistPreference("sidebar_collapsible", value);
  };

  const onFontChange = async (value: FontKey | "") => {
    if (!value) return;
    applyFont(value);
    setFont(value);
    persistPreference("font", value);
  };

  const commitTimeZone = async (rawValue: string) => {
    const nextTimeZone = normalizeTimeZone(rawValue, "");

    if (nextTimeZone.length === 0) {
      setTimeZoneError(messages.sidebar.controls.timeZoneInvalid);
      return;
    }

    setTimeZoneError(null);

    if (nextTimeZone === timeZone) {
      return;
    }

    const previousTimeZone = timeZone;
    setTimeZone(nextTimeZone);
    applyTimeZoneToDocument(nextTimeZone);
    setIsSavingTimeZone(true);

    const { data, response } = await client.PATCH<{ timeZone: string }>("/session/preferences", {
      body: {
        timeZone: nextTimeZone,
      },
      headers: {
        "x-yapd-csrf": csrfToken,
      },
    });

    setIsSavingTimeZone(false);

    if (!response.ok) {
      const message = await getApiErrorMessage(response);
      setTimeZone(previousTimeZone);
      applyTimeZoneToDocument(previousTimeZone);
      toast.error(message);
      return;
    }

    const persistedTimeZone = typeof data?.timeZone === "string" ? data.timeZone : nextTimeZone;
    setTimeZone(persistedTimeZone);
    applyTimeZoneToDocument(persistedTimeZone);
    router.refresh();
  };

  const handleRestore = () => {
    void commitTimeZone(PREFERENCE_DEFAULTS.time_zone);
    onThemePresetChange(PREFERENCE_DEFAULTS.theme_preset);
    onThemeModeChange(PREFERENCE_DEFAULTS.theme_mode);
    onContentLayoutChange(PREFERENCE_DEFAULTS.content_layout);
    onNavbarStyleChange(PREFERENCE_DEFAULTS.navbar_style);
    onSidebarStyleChange(PREFERENCE_DEFAULTS.sidebar_variant);
    onSidebarCollapseModeChange(PREFERENCE_DEFAULTS.sidebar_collapsible);
    onFontChange(PREFERENCE_DEFAULTS.font);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon">
          <Settings />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <div className="flex flex-col gap-5">
          <div className="space-y-1.5">
            <h4 className="font-medium text-sm leading-none">{messages.sidebar.controls.title}</h4>
            <p className="text-muted-foreground text-xs">{messages.sidebar.controls.description}</p>
          </div>
          <div className="space-y-3 **:data-[slot=toggle-group]:w-full **:data-[slot=toggle-group-item]:flex-1 **:data-[slot=toggle-group-item]:text-xs">
            <div className="space-y-1">
              <Label className="font-medium text-xs">{messages.sidebar.controls.language}</Label>
              <LanguageSelect showIcon={false} triggerClassName="w-full text-xs" />
            </div>

            <div className="space-y-1">
              <Label className="font-medium text-xs">{messages.sidebar.controls.timeZone}</Label>
              <TimeZoneInput
                value={timeZone}
                disabled={isSavingTimeZone}
                emptyText={messages.sidebar.controls.timeZoneEmpty}
                error={timeZoneError}
                placeholder={messages.sidebar.controls.timeZonePlaceholder}
                searchPlaceholder={messages.sidebar.controls.timeZonePlaceholder}
                triggerClassName="text-xs"
                onChange={(selectedTimeZone) => void commitTimeZone(selectedTimeZone)}
              />
            </div>

            <div className="space-y-1">
              <Label className="font-medium text-xs">{messages.sidebar.controls.themePreset}</Label>
              <Select value={themePreset} onValueChange={onThemePresetChange}>
                <SelectTrigger size="sm" className="w-full text-xs">
                  <SelectValue placeholder="Preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {THEME_PRESET_OPTIONS.map((preset) => (
                      <SelectItem key={preset.value} className="text-xs" value={preset.value}>
                        <span
                          className="size-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              (resolvedThemeMode ?? "light") === "dark" ? preset.primary.dark : preset.primary.light,
                          }}
                        />
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="font-medium text-xs">{messages.sidebar.controls.font}</Label>
              <Select value={font} onValueChange={onFontChange}>
                <SelectTrigger size="sm" className="w-full text-xs">
                  <SelectValue placeholder={messages.sidebar.controls.fontPlaceholder} />
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
            </div>

            <div className="space-y-1">
              <Label className="font-medium text-xs">{messages.sidebar.controls.themeMode}</Label>
              <ToggleGroup
                size="sm"
                variant="outline"
                type="single"
                value={themeMode}
                onValueChange={onThemeModeChange}
              >
                <ToggleGroupItem value="light" aria-label={messages.sidebar.controls.light}>
                  {messages.sidebar.controls.light}
                </ToggleGroupItem>
                <ToggleGroupItem value="dark" aria-label={messages.sidebar.controls.dark}>
                  {messages.sidebar.controls.dark}
                </ToggleGroupItem>
                <ToggleGroupItem value="system" aria-label={messages.sidebar.controls.system}>
                  {messages.sidebar.controls.system}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-1">
              <Label className="font-medium text-xs">{messages.sidebar.controls.pageLayout}</Label>
              <ToggleGroup
                size="sm"
                variant="outline"
                type="single"
                value={contentLayout}
                onValueChange={onContentLayoutChange}
              >
                <ToggleGroupItem value="centered" aria-label={messages.sidebar.controls.centered}>
                  {messages.sidebar.controls.centered}
                </ToggleGroupItem>
                <ToggleGroupItem value="full-width" aria-label={messages.sidebar.controls.fullWidth}>
                  {messages.sidebar.controls.fullWidth}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-1">
              <Label className="font-medium text-xs">{messages.sidebar.controls.navbarBehavior}</Label>
              <ToggleGroup
                size="sm"
                variant="outline"
                type="single"
                value={navbarStyle}
                onValueChange={onNavbarStyleChange}
              >
                <ToggleGroupItem value="sticky" aria-label={messages.sidebar.controls.sticky}>
                  {messages.sidebar.controls.sticky}
                </ToggleGroupItem>
                <ToggleGroupItem value="scroll" aria-label={messages.sidebar.controls.scroll}>
                  {messages.sidebar.controls.scroll}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-1">
              <Label className="font-medium text-xs">{messages.sidebar.controls.sidebarStyle}</Label>
              <ToggleGroup
                size="sm"
                variant="outline"
                type="single"
                value={variant}
                onValueChange={onSidebarStyleChange}
              >
                <ToggleGroupItem value="inset" aria-label={messages.sidebar.controls.inset}>
                  {messages.sidebar.controls.inset}
                </ToggleGroupItem>
                <ToggleGroupItem value="sidebar" aria-label={messages.sidebar.controls.sidebar}>
                  {messages.sidebar.controls.sidebar}
                </ToggleGroupItem>
                <ToggleGroupItem value="floating" aria-label={messages.sidebar.controls.floating}>
                  {messages.sidebar.controls.floating}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-1">
              <Label className="font-medium text-xs">{messages.sidebar.controls.sidebarCollapseMode}</Label>
              <ToggleGroup
                size="sm"
                variant="outline"
                type="single"
                value={collapsible}
                onValueChange={onSidebarCollapseModeChange}
              >
                <ToggleGroupItem value="icon" aria-label={messages.sidebar.controls.icon}>
                  {messages.sidebar.controls.icon}
                </ToggleGroupItem>
                <ToggleGroupItem value="offcanvas" aria-label={messages.sidebar.controls.offcanvas}>
                  {messages.sidebar.controls.offcanvas}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <Button type="button" size="sm" variant="outline" className="w-full text-xs" onClick={handleRestore}>
              {messages.sidebar.controls.restore}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
