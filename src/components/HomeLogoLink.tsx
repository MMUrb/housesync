"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { confirmLeave } from "@/lib/leaveGuard";

/** The HouseSync wordmark, always linking home, with a leave-confirm guard. */
export function HomeLogoLink({
  className = "",
  logoClassName = "",
}: {
  className?: string;
  logoClassName?: string;
}) {
  return (
    <Link
      href="/"
      aria-label="HouseSync home"
      className={className}
      onClick={(e) => {
        if (!confirmLeave()) e.preventDefault();
      }}
    >
      <Logo className={logoClassName} />
    </Link>
  );
}
