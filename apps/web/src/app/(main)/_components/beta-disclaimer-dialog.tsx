"use client";

import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useWebI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type BetaDisclaimerDialogProps = {
  className?: string;
  placement?: "topbar" | "sidebar";
};

export function BetaDisclaimerDialog({ className, placement = "topbar" }: Readonly<BetaDisclaimerDialogProps>) {
  const { messages } = useWebI18n();
  const copy = messages.layout.beta;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={copy.openLabel}
          className={cn(
            badgeVariants({ variant: placement === "sidebar" ? "outline" : "secondary" }),
            "h-6 cursor-pointer border-primary/25 px-2.5 font-semibold text-[11px] hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
            placement === "sidebar" && "mx-2 justify-center",
            className,
          )}
        >
          {copy.label}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription className="space-y-3 leading-6">
            <span className="block">{copy.description}</span>
            <span className="block">{copy.disclaimer}</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button">{copy.close}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
