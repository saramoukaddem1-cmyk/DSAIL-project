"use client";

import type { StylePassport } from "@/types/style-passport";
import { SizesBudgetForm } from "@/components/profile/sizes-budget-form";

export function SizesBudgetStep({
  initialPassport,
  onStepCompleteChange,
}: {
  initialPassport: StylePassport;
  onStepCompleteChange?: (complete: boolean) => void;
}) {
  return (
    <SizesBudgetForm
      initialPassport={initialPassport}
      onStepCompleteChange={onStepCompleteChange}
    />
  );
}
