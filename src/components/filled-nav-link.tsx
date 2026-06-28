import Link from "next/link";
import { filledNavBtn, type FilledNavTone } from "@/lib/nav-button-styles";

export function FilledNavLink({
  href,
  tone = "violet",
  children,
}: {
  href: string;
  tone?: FilledNavTone;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={filledNavBtn[tone]}>
      {children}
    </Link>
  );
}
