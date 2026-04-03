"use client";

import { z } from "zod";

import { FRONTEND_CONFIG } from "@/config/frontend-config";
import type { WebMessages } from "@/lib/i18n/messages";

type GroupNameParseError = "empty" | "invalid_quote" | "unterminated_quote" | "too_long";

type GroupNameParseResult = {
  names: string[];
  error: GroupNameParseError | null;
};

function finalizeParsedGroupName(rawValue: string, names: string[], seen: Set<string>): GroupNameParseError | null {
  const normalizedValue = rawValue.trim();

  if (normalizedValue.length === 0) {
    return null;
  }

  if (normalizedValue.length > FRONTEND_CONFIG.groups.nameMaxLength) {
    return "too_long";
  }

  if (seen.has(normalizedValue)) {
    return null;
  }

  seen.add(normalizedValue);
  names.push(normalizedValue);
  return null;
}

export function parseGroupNamesInput(value: string): GroupNameParseResult {
  const names: string[] = [];
  const seen = new Set<string>();
  let currentValue = "";
  let isQuoted = false;
  let justClosedQuote = false;

  for (const character of value) {
    if (character === '"') {
      if (justClosedQuote) {
        return {
          names: [],
          error: "invalid_quote",
        };
      }

      if (isQuoted) {
        isQuoted = false;
        justClosedQuote = true;
        continue;
      }

      if (currentValue.trim().length > 0) {
        return {
          names: [],
          error: "invalid_quote",
        };
      }

      isQuoted = true;
      continue;
    }

    const isSeparator = character === "," || /\s/.test(character);

    if (!isQuoted && isSeparator) {
      const finalizeError = finalizeParsedGroupName(currentValue, names, seen);

      if (finalizeError) {
        return {
          names: [],
          error: finalizeError,
        };
      }

      currentValue = "";
      justClosedQuote = false;
      continue;
    }

    if (justClosedQuote) {
      return {
        names: [],
        error: "invalid_quote",
      };
    }

    currentValue += character;
  }

  if (isQuoted) {
    return {
      names: [],
      error: "unterminated_quote",
    };
  }

  const finalizeError = finalizeParsedGroupName(currentValue, names, seen);

  if (finalizeError) {
    return {
      names: [],
      error: finalizeError,
    };
  }

  if (names.length === 0) {
    return {
      names: [],
      error: "empty",
    };
  }

  return {
    names,
    error: null,
  };
}

const DEFAULT_COMMENT = "";

export const DEFAULT_CREATE_GROUP_FORM_VALUES = {
  name: "",
  comment: DEFAULT_COMMENT,
};

export const DEFAULT_EDIT_GROUP_FORM_VALUES = {
  name: "",
  comment: DEFAULT_COMMENT,
};

export function buildCreateGroupSchema(messages: WebMessages) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, messages.groups.validation.createNames)
      .superRefine((value, context) => {
        const parsed = parseGroupNamesInput(value);

        if (parsed.error !== null) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: messages.groups.validation.createNames,
          });
        }
      }),
    comment: z
      .string()
      .max(FRONTEND_CONFIG.groups.commentMaxLength, messages.groups.validation.comment)
      .transform((value) => value.trim()),
  });
}

export function buildEditGroupSchema(messages: WebMessages) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, messages.groups.validation.editName)
      .max(FRONTEND_CONFIG.groups.nameMaxLength, messages.groups.validation.editName),
    comment: z
      .string()
      .max(FRONTEND_CONFIG.groups.commentMaxLength, messages.groups.validation.comment)
      .transform((value) => value.trim()),
  });
}
