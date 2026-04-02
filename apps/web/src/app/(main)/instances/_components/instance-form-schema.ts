"use client";

import { z } from "zod";

import { FRONTEND_CONFIG } from "@/config/frontend-config";
import type { WebMessages } from "@/lib/i18n/messages";

const PEM_CERTIFICATE_PATTERN = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/;

export type InstanceFormValues = {
  name: string;
  baseUrl: string;
  servicePassword: string;
  allowSelfSigned: boolean;
  certificatePem: string;
};

export const DEFAULT_INSTANCE_FORM_VALUES: InstanceFormValues = {
  name: "",
  baseUrl: "",
  servicePassword: "",
  allowSelfSigned: false,
  certificatePem: "",
};

function normalizeText(value: string) {
  return value.trim();
}

export function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isPemCertificateBundle(value: string) {
  return PEM_CERTIFICATE_PATTERN.test(normalizeText(value));
}

export function buildInstanceFormSchema(messages: WebMessages, options: { requirePassword: boolean }) {
  return z
    .object({
      name: z
        .string()
        .transform(normalizeText)
        .refine((value) => value.length >= 2 && value.length <= 120, messages.forms.instances.validation.name),
      baseUrl: z
        .string()
        .transform(normalizeText)
        .refine((value) => isValidHttpUrl(value), messages.forms.instances.validation.baseUrl),
      servicePassword: z
        .string()
        .transform(normalizeText)
        .refine(
          (value) =>
            options.requirePassword
              ? value.length >= 4 && value.length <= 512
              : value.length === 0 || (value.length >= 4 && value.length <= 512),
          messages.forms.instances.validation.password,
        ),
      allowSelfSigned: z.boolean(),
      certificatePem: z
        .string()
        .transform(normalizeText)
        .refine(
          (value) => value.length === 0 || isPemCertificateBundle(value),
          messages.forms.instances.validation.certificatePem,
        ),
    })
    .superRefine((values, context) => {
      if (values.allowSelfSigned && values.certificatePem.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["certificatePem"],
          message: messages.forms.instances.validation.trustMode,
        });
      }
    });
}

export function toInstanceRequestBody(values: InstanceFormValues) {
  return {
    name: values.name,
    baseUrl: values.baseUrl,
    servicePassword: values.servicePassword || undefined,
    allowSelfSigned: values.certificatePem.length > 0 ? false : values.allowSelfSigned,
    certificatePem: values.certificatePem || undefined,
  };
}

export function parseDiscoveryCandidatesInput(value: string | undefined) {
  const entries = (value ?? "")
    .split(/\r?\n|,/)
    .map(normalizeText)
    .filter((entry) => entry.length > 0);
  const candidates: string[] = [];
  const invalidValues: string[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (!isValidHttpUrl(entry)) {
      invalidValues.push(entry);
      continue;
    }

    if (seen.has(entry)) {
      continue;
    }

    seen.add(entry);
    candidates.push(entry);
  }

  return {
    candidates,
    invalidValues,
    exceedsLimit: candidates.length > FRONTEND_CONFIG.instances.discoveryCandidateLimit,
  };
}

export function buildDiscoverySchema(messages: WebMessages) {
  return z.object({
    candidates: z
      .string()
      .optional()
      .superRefine((value, context) => {
        const parsed = parseDiscoveryCandidatesInput(value);

        if (parsed.invalidValues.length > 0) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: messages.forms.instances.validation.candidates,
          });
        }

        if (parsed.exceedsLimit) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: messages.forms.instances.validation.candidatesLimit(
              FRONTEND_CONFIG.instances.discoveryCandidateLimit,
            ),
          });
        }
      }),
  });
}
