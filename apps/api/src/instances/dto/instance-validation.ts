import { Transform } from "class-transformer";
import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
  ValidatorConstraint,
} from "class-validator";

import { isManagedInstanceBaseUrl } from "../../common/url/managed-instance-base-url";

const PEM_CERTIFICATE_PATTERN = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/;

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

export function NormalizeDiscoveryCandidates() {
  return Transform(({ value }) => {
    if (!Array.isArray(value)) {
      return value;
    }

    const normalizedValues: unknown[] = [];
    const seen = new Set<string>();

    for (const entry of value) {
      if (typeof entry !== "string") {
        normalizedValues.push(entry);
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

export function isPemCertificateBundle(value: string) {
  return PEM_CERTIFICATE_PATTERN.test(value.trim());
}

@ValidatorConstraint({ name: "isPemCertificateBundle", async: false })
class PemCertificateBundleConstraint {
  validate(value: unknown) {
    if (value === undefined || value === null) {
      return true;
    }

    if (typeof value !== "string") {
      return false;
    }

    return isPemCertificateBundle(value);
  }

  defaultMessage() {
    return "certificatePem must be a valid PEM certificate bundle.";
  }
}

export function IsPemCertificateBundle(validationOptions?: ValidationOptions) {
  return (target: object, propertyName: string) => {
    registerDecorator({
      target: target.constructor,
      propertyName,
      options: validationOptions,
      validator: PemCertificateBundleConstraint,
    });
  };
}

@ValidatorConstraint({ name: "instanceTrustConfiguration", async: false })
class InstanceTrustConfigurationConstraint {
  validate(_value: unknown, args: ValidationArguments) {
    const object = args.object as {
      allowSelfSigned?: unknown;
      certificatePem?: unknown;
    };
    const allowSelfSigned = object.allowSelfSigned === true;
    const hasCustomCertificate = typeof object.certificatePem === "string" && object.certificatePem.trim().length > 0;

    return !(allowSelfSigned && hasCustomCertificate);
  }

  defaultMessage() {
    return "Use either allowSelfSigned or certificatePem, not both.";
  }
}

export function IsExclusiveTrustConfiguration(validationOptions?: ValidationOptions) {
  return (target: object, propertyName: string) => {
    registerDecorator({
      target: target.constructor,
      propertyName,
      options: validationOptions,
      validator: InstanceTrustConfigurationConstraint,
    });
  };
}

@ValidatorConstraint({ name: "managedInstanceBaseUrl", async: false })
class ManagedInstanceBaseUrlConstraint {
  validate(value: unknown) {
    if (value === undefined || value === null) {
      return true;
    }

    return isManagedInstanceBaseUrl(value);
  }

  defaultMessage() {
    return "baseUrl must be a valid http:// or https:// URL with host and optional path.";
  }
}

export function IsManagedInstanceBaseUrl(validationOptions?: ValidationOptions) {
  return (target: object, propertyName: string) => {
    registerDecorator({
      target: target.constructor,
      propertyName,
      options: validationOptions,
      validator: ManagedInstanceBaseUrlConstraint,
    });
  };
}
