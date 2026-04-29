import { Suspense } from "react";
import { EnvConfigBanner } from "@/components/env-config-banner";
import { SkuAnimatedLogo } from "@/components/sku-animated-logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-[2] min-h-screen">
      <div className="border-b border-[var(--border)] bg-[rgba(5,4,10,0.7)] px-4 py-4 backdrop-blur-[26px] saturate-150">
        <SkuAnimatedLogo />
      </div>
      <Suspense fallback={null}>
        <EnvConfigBanner />
      </Suspense>
      {children}
    </div>
  );
}
