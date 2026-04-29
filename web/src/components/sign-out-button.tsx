"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className="rounded-full bg-white px-3 py-2 text-[#0b0014]/70 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] transition hover:bg-neutral-50 hover:text-[#0b0014]"
    >
      Log out
    </button>
  );
}
