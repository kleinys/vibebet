"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { installPlatformModule } from "@/app/apps/actions";

export function PlatformModuleInstallButton({
  slug,
  installed,
  targetHref,
}: {
  slug: string;
  installed: boolean;
  targetHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (installed) {
    return (
      <Link
        href={targetHref}
        className="inline-flex rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
      >
        Open module →
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await installPlatformModule(slug);
          if (r.error) toast.error(r.error);
          else {
            toast.success("Installed — adds a wing to your Legacy Cathedral");
            router.refresh();
          }
        })
      }
      className="rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-500 disabled:opacity-50"
    >
      {pending ? "Installing…" : "Install free"}
    </button>
  );
}
