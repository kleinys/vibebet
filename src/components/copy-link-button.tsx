"use client";

import { useState } from "react";
import { toast } from "sonner";

export function CopyLinkButton({
  url,
  label = "Copy link",
  copiedLabel = "Copied!",
  className = "",
  successMessage,
}: {
  url: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  successMessage?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (successMessage) toast.success(successMessage);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the link manually.");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        className ||
        "rounded-md bg-violet-600/40 px-3 py-1.5 text-xs font-medium text-violet-100 ring-1 ring-violet-500/30 hover:bg-violet-500/50"
      }
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
