import Link from "next/link";
import { skinStyleForSlug } from "@/lib/cosmetic-styles";

export function UserAvatar({
  slug,
  size = "sm",
  title,
}: {
  slug?: string;
  size?: "sm" | "md";
  title?: string;
}) {
  const style = skinStyleForSlug(slug);
  const dim = size === "md" ? "h-9 w-9 text-base" : "h-7 w-7 text-sm";

  return (
    <span
      title={title}
      className={`inline-flex ${dim} shrink-0 items-center justify-center rounded-full bg-zinc-900 ring-2 ${style.ring} shadow-lg ${style.glow}`}
    >
      {style.avatar}
    </span>
  );
}

export function UserAvatarLink({
  slug,
  href,
  title,
}: {
  slug?: string;
  href: string;
  title?: string;
}) {
  return (
    <Link href={href} className="inline-flex shrink-0">
      <UserAvatar slug={slug} title={title} />
    </Link>
  );
}
