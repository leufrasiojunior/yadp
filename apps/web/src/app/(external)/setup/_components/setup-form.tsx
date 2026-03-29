"use client";

import { useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { SetupLayoutStep } from "@/app/(external)/setup/_components/setup-layout-step";
import { SetupLoginStep } from "@/app/(external)/setup/_components/setup-login-step";
import { SetupPiholesStep } from "@/app/(external)/setup/_components/setup-piholes-step";
import { SetupWelcomeStep } from "@/app/(external)/setup/_components/setup-welcome-step";
import { SetupWizardProgress } from "@/app/(external)/setup/_components/setup-wizard-progress";
import { getSetupCopy } from "@/app/(external)/setup/setup-copy";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { getBrowserApiClient } from "@/lib/api/yapd-client";
import type { SetupBaselineRequest, SetupBaselineResponse } from "@/lib/api/yapd-types";
import { useWebI18n } from "@/lib/i18n/client";
import { persistPreference } from "@/lib/preferences/preferences-storage";

import {
  buildBaseUrl,
  createDefaultSetupValues,
  createEmptyInstance,
  isBlankInstance,
  isValidHostPath,
  normalizeHostPath,
  normalizeText,
  TOTAL_STEPS,
} from "./setup-form.helpers";
import type { SetupWizardValues } from "./setup-form.types";

export function SetupForm() {
  const router = useRouter();
  const { locale, messages } = useWebI18n();
  const copy = useMemo(() => getSetupCopy(locale), [locale]);
  const [currentStep, setCurrentStep] = useState(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<SetupWizardValues>({
    defaultValues: createDefaultSetupValues(locale),
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "instances",
  });
  const watchedValues = useWatch({
    control: form.control,
  }) as Partial<SetupWizardValues> | undefined;
  const credentialsMode = watchedValues?.credentialsMode ?? form.getValues("credentialsMode");
  const instances = watchedValues?.instances ?? form.getValues("instances");
  const masterIndex = watchedValues?.masterIndex ?? form.getValues("masterIndex");
  const loginMode = watchedValues?.loginMode ?? form.getValues("loginMode");

  const clearPiholeErrors = () => {
    form.clearErrors(["credentialsMode", "masterIndex", "sharedPassword", "instances"]);
  };

  const clearLoginErrors = () => {
    form.clearErrors(["loginMode", "yapdPassword", "confirmYapdPassword"]);
  };

  const validatePiholeStep = () => {
    clearPiholeErrors();
    const values = form.getValues();
    let isValid = true;

    if (values.masterIndex < 0 || values.masterIndex >= values.instances.length) {
      form.setError("masterIndex", {
        type: "manual",
        message: copy.piholes.validation.masterRequired,
      });
      return false;
    }

    for (const [index, instance] of values.instances.entries()) {
      const label = copy.piholes.rowTitle(index, normalizeText(instance.name) || undefined);
      const isMaster = index === values.masterIndex;
      const alias = normalizeText(instance.name);
      const hostPath = normalizeHostPath(instance.hostPath);
      const blank = isBlankInstance(instance, values.credentialsMode);

      if (hostPath.length > 0 && !isValidHostPath(instance.scheme, hostPath)) {
        form.setError(`instances.${index}.hostPath`, {
          type: "manual",
          message: copy.piholes.validation.urlFormat,
        });
        isValid = false;
      }

      if (isMaster) {
        if (alias.length === 0) {
          form.setError(`instances.${index}.name`, {
            type: "manual",
            message: copy.piholes.validation.aliasRequired,
          });
          isValid = false;
        }

        if (hostPath.length === 0) {
          form.setError(`instances.${index}.hostPath`, {
            type: "manual",
            message: copy.piholes.validation.urlRequired,
          });
          isValid = false;
        }
      } else if (!blank) {
        if (alias.length === 0) {
          form.setError(`instances.${index}.name`, {
            type: "manual",
            message: copy.piholes.validation.instanceIncomplete(label),
          });
          isValid = false;
        }

        if (hostPath.length === 0) {
          form.setError(`instances.${index}.hostPath`, {
            type: "manual",
            message: copy.piholes.validation.instanceIncomplete(label),
          });
          isValid = false;
        }
      }

      if (values.credentialsMode === "individual" && (isMaster || !blank)) {
        if (normalizeText(instance.password).length === 0) {
          form.setError(`instances.${index}.password`, {
            type: "manual",
            message: copy.piholes.validation.instancePassword(label),
          });
          isValid = false;
        }
      }
    }

    const selectedMaster = values.instances[values.masterIndex];

    if (
      !selectedMaster ||
      normalizeText(selectedMaster.name).length === 0 ||
      normalizeHostPath(selectedMaster.hostPath).length === 0 ||
      !isValidHostPath(selectedMaster.scheme, selectedMaster.hostPath)
    ) {
      form.setError("masterIndex", {
        type: "manual",
        message: copy.piholes.validation.masterRequired,
      });
      isValid = false;
    }

    if (values.credentialsMode === "shared") {
      const hasFilledInstances = values.instances.some(
        (instance, index) => index === values.masterIndex || !isBlankInstance(instance, "shared"),
      );

      if (hasFilledInstances && normalizeText(values.sharedPassword).length === 0) {
        form.setError("sharedPassword", {
          type: "manual",
          message: copy.piholes.validation.sharedPassword,
        });
        isValid = false;
      }
    }

    return isValid;
  };

  const validateLoginStep = () => {
    clearLoginErrors();
    const values = form.getValues();
    let isValid = true;

    if (values.loginMode === "yapd-password") {
      const password = normalizeText(values.yapdPassword);
      const confirmation = normalizeText(values.confirmYapdPassword);

      if (password.length === 0) {
        form.setError("yapdPassword", {
          type: "manual",
          message: copy.loginMode.validation.passwordRequired,
        });
        isValid = false;
      } else if (password.length < 8) {
        form.setError("yapdPassword", {
          type: "manual",
          message: copy.loginMode.validation.passwordTooShort,
        });
        isValid = false;
      }

      if (confirmation.length === 0) {
        form.setError("confirmYapdPassword", {
          type: "manual",
          message: copy.loginMode.validation.passwordConfirmationRequired,
        });
        isValid = false;
      } else if (confirmation !== password) {
        form.setError("confirmYapdPassword", {
          type: "manual",
          message: copy.loginMode.validation.passwordConfirmationMismatch,
        });
        isValid = false;
      }
    }

    return isValid;
  };

  const goToNextStep = () => {
    setSubmitError(null);

    if (currentStep === 2 && !validatePiholeStep()) {
      return;
    }

    if (currentStep === 3 && !validateLoginStep()) {
      return;
    }

    setCurrentStep((step) => Math.min(step + 1, TOTAL_STEPS));
  };

  const goToPreviousStep = () => {
    setSubmitError(null);
    setCurrentStep((step) => Math.max(step - 1, 1));
  };

  const removeInstance = (index: number) => {
    const currentMasterIndex = form.getValues("masterIndex");
    remove(index);

    if (currentMasterIndex === index) {
      form.setValue("masterIndex", 0, { shouldDirty: true });
      return;
    }

    if (currentMasterIndex > index) {
      form.setValue("masterIndex", currentMasterIndex - 1, { shouldDirty: true });
    }
  };

  const onSubmit = async (values: SetupWizardValues) => {
    setSubmitError(null);

    if (!validatePiholeStep()) {
      setCurrentStep(2);
      return;
    }

    if (!validateLoginStep()) {
      setCurrentStep(3);
      return;
    }

    const body: SetupBaselineRequest = {
      credentialsMode: values.credentialsMode,
      ...(values.credentialsMode === "shared"
        ? {
            sharedPassword: normalizeText(values.sharedPassword),
          }
        : {}),
      instances: values.instances
        .map((instance, index) => ({
          index,
          source: instance,
          name: normalizeText(instance.name),
          baseUrl: buildBaseUrl(instance.scheme, instance.hostPath),
          allowSelfSigned: instance.allowSelfSigned,
          password: normalizeText(instance.password),
        }))
        .filter(
          (instance) =>
            instance.index === values.masterIndex || !isBlankInstance(instance.source, values.credentialsMode),
        )
        .map((instance) => ({
          name: instance.name || undefined,
          baseUrl: instance.baseUrl || undefined,
          isMaster: instance.index === values.masterIndex,
          allowSelfSigned: instance.allowSelfSigned,
          ...(values.credentialsMode === "individual"
            ? {
                password: instance.password || undefined,
              }
            : {}),
        })),
      loginMode: values.loginMode,
      ...(values.loginMode === "yapd-password"
        ? {
            yapdPassword: normalizeText(values.yapdPassword),
          }
        : {}),
    };

    const client = getBrowserApiClient();
    const { data, response } = await client.POST<SetupBaselineResponse>("/setup/baseline", {
      body,
    });

    if (!response.ok) {
      const message = typeof data?.message === "string" ? data.message : await getApiErrorMessage(response);
      setSubmitError(message);
      toast.error(message);
      return;
    }

    await Promise.all([
      persistPreference("language", values.applicationLanguage),
      persistPreference("theme_preset", values.themePreset),
      persistPreference("font", values.font),
      persistPreference("theme_mode", values.themeMode),
      persistPreference("content_layout", values.contentLayout),
      persistPreference("navbar_style", values.navbarStyle),
      persistPreference("sidebar_variant", values.sidebarVariant),
      persistPreference("sidebar_collapsible", values.sidebarCollapsible),
    ]);

    const message = typeof data?.message === "string" ? data.message : copy.wizard.finish;
    toast.success(message);
    router.replace("/login");
    router.refresh();
  };

  const handleFinish = form.handleSubmit((values) => void onSubmit(values));

  return (
    <form
      noValidate
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <SetupWizardProgress copy={copy.wizard} currentStep={currentStep} totalSteps={TOTAL_STEPS} />

      {currentStep === 1 ? <SetupWelcomeStep copy={copy.welcome} /> : null}

      {currentStep === 2 ? (
        <SetupPiholesStep
          copy={copy.piholes}
          credentialsMode={credentialsMode}
          fields={fields}
          form={form}
          instances={instances}
          masterIndex={masterIndex}
          onAddInstance={() => append(createEmptyInstance())}
          onRemoveInstance={removeInstance}
        />
      ) : null}

      {currentStep === 3 ? <SetupLoginStep copy={copy.loginMode} form={form} loginMode={loginMode} /> : null}

      {currentStep === 4 ? (
        <SetupLayoutStep
          copy={copy.layout}
          form={form}
          labels={{
            common: {
              languagePlaceholder: messages.common.languagePlaceholder,
            },
            controls: messages.sidebar.controls,
          }}
          locale={locale}
        />
      ) : null}

      {submitError ? (
        <Alert variant="destructive">
          <AlertTitle>{copy.submit.errorTitle}</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={goToPreviousStep}
          disabled={currentStep === 1 || form.formState.isSubmitting}
        >
          {copy.wizard.back}
        </Button>
        {currentStep < TOTAL_STEPS ? (
          <Button type="button" onClick={goToNextStep}>
            {copy.wizard.next}
          </Button>
        ) : (
          <Button type="button" disabled={form.formState.isSubmitting} onClick={() => void handleFinish()}>
            {form.formState.isSubmitting ? copy.wizard.finishing : copy.wizard.finish}
          </Button>
        )}
      </div>
    </form>
  );
}
