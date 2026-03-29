import type { SetupCredentialMode, SetupLoginMode } from "@/lib/api/yapd-types";
import type { FontKey } from "@/lib/fonts/registry";
import type { AppLocale } from "@/lib/i18n/config";
import type { ContentLayout, NavbarStyle, SidebarCollapsible, SidebarVariant } from "@/lib/preferences/layout";
import type { ThemeMode, ThemePreset } from "@/lib/preferences/theme";

export type SetupScheme = "http" | "https";

export type SetupInstanceFormValue = {
  name: string;
  scheme: SetupScheme;
  hostPath: string;
  allowSelfSigned: boolean;
  password: string;
};

export type SetupWizardValues = {
  credentialsMode: SetupCredentialMode;
  masterIndex: number;
  sharedPassword: string;
  instances: SetupInstanceFormValue[];
  loginMode: SetupLoginMode;
  yapdPassword: string;
  confirmYapdPassword: string;
  applicationLanguage: AppLocale;
  themePreset: ThemePreset;
  font: FontKey;
  themeMode: ThemeMode;
  contentLayout: ContentLayout;
  navbarStyle: NavbarStyle;
  sidebarVariant: SidebarVariant;
  sidebarCollapsible: SidebarCollapsible;
};
