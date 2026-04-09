"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type ManagedItemsPartialAlertProps = {
  description: string;
  title: string;
};

export function ManagedItemsPartialAlert({ description, title }: Readonly<ManagedItemsPartialAlertProps>) {
  return (
    <Alert>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}
