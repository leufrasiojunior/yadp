import type { SetupCopy } from "@/app/(external)/setup/setup-copy";
import { cn } from "@/lib/utils";

export function SetupWizardProgress({
  copy,
  currentStep,
  totalSteps,
}: Readonly<{
  copy: SetupCopy["wizard"];
  currentStep: number;
  totalSteps: number;
}>) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{copy.stepLabel(currentStep, totalSteps)}</p>
        <p className="font-medium text-sm">{copy.steps[currentStep - 1]?.label}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {copy.steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isComplete = stepNumber < currentStep;

          return (
            <div
              key={step.key}
              className={cn(
                "rounded-xl border p-3 transition",
                isActive && "border-primary bg-primary/5",
                isComplete && "border-primary/30 bg-primary/10",
              )}
            >
              <p className="text-muted-foreground text-xs">{copy.stepLabel(stepNumber, totalSteps)}</p>
              <p className="mt-1 font-medium text-sm">{step.shortLabel}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
