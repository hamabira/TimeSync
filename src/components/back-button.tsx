"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BackButtonProps = {
  fallbackHref?: string;
  label?: string;
  className?: string;
};

export function BackButton({
  fallbackHref = "/",
  label = "戻る",
  className,
}: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (typeof window !== "undefined") {
      const referrer = document.referrer;

      if (referrer) {
        try {
          if (new URL(referrer).origin === window.location.origin) {
            router.back();
            return;
          }
        } catch {
          // Ignore malformed referrers and fall back to the default route.
        }
      }
    }

    router.replace(fallbackHref);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="元のページに戻る"
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit gap-1.5", className)}
    >
      <ArrowLeft className="size-3.5" />
      <span>{label}</span>
    </button>
  );
}
