import { Suspense } from "react";
import { ResetPasswordClient } from "./reset-password-client";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-12" />}>
      <ResetPasswordClient />
    </Suspense>
  );
}

