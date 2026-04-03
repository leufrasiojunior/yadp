import { Transform } from "class-transformer";
import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
  ValidatorConstraint,
} from "class-validator";

export const GROUP_NAME_MAX_LENGTH = 255;
export const GROUP_COMMENT_MAX_LENGTH = 500;
export const GROUP_BATCH_DELETE_MAX_ITEMS = 200;

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

  if (normalizedValue.length > GROUP_NAME_MAX_LENGTH) {
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

export function TrimRequiredString() {
  return Transform(({ value }) => (typeof value === "string" ? value.trim() : value));
}

export function TrimOptionalString() {
  return Transform(({ value }) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });
}

export function TrimStringAllowEmpty() {
  return Transform(({ value }) => (typeof value === "string" ? value.trim() : value));
}

export function NormalizeGroupNameArray() {
  return Transform(({ value }) => {
    if (!Array.isArray(value)) {
      return value;
    }

    const normalizedValues: string[] = [];
    const seen = new Set<string>();

    for (const entry of value) {
      if (typeof entry !== "string") {
        continue;
      }

      const trimmed = entry.trim();

      if (trimmed.length === 0 || seen.has(trimmed)) {
        continue;
      }

      seen.add(trimmed);
      normalizedValues.push(trimmed);
    }

    return normalizedValues.length > 0 ? normalizedValues : undefined;
  });
}

@ValidatorConstraint({ name: "parsableGroupNamesInput", async: false })
class ParsableGroupNamesInputConstraint {
  validate(value: unknown) {
    if (typeof value !== "string") {
      return false;
    }

    const result = parseGroupNamesInput(value);
    return result.error === null;
  }

  defaultMessage(args?: ValidationArguments) {
    const rawValue = typeof args?.value === "string" ? args.value : "";
    const result = parseGroupNamesInput(rawValue);

    switch (result.error) {
      case "unterminated_quote":
        return 'Close the quoted group name before saving. Example: "My New Group"';
      case "invalid_quote":
        return "Use quotes only to wrap a full group name when it contains spaces.";
      case "too_long":
        return `Each group name must be at most ${GROUP_NAME_MAX_LENGTH} characters long.`;
      default:
        return "Provide at least one valid group name.";
    }
  }
}

export function IsParsableGroupNamesInput(validationOptions?: ValidationOptions) {
  return (target: object, propertyName: string) => {
    registerDecorator({
      target: target.constructor,
      propertyName,
      options: validationOptions,
      validator: ParsableGroupNamesInputConstraint,
    });
  };
}
