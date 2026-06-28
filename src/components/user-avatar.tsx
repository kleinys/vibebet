import Link from "next/link";
import {
  badgeStyleForSlug,
  SHIELD_STYLE,
  skinStyleForSlug,
} from "@/lib/cosmetic-styles";

export function UserAvatar({
  slug,
  badgeSlug,
  size = "sm",
  title,
  shieldPreview = false,
}: {
  slug?: string;
  badgeSlug?: string;
  size?: "sm" | "md" | "lg";
  title?: string;
  shieldPreview?: boolean;
}) {
  const style = shieldPreview ? SHIELD_STYLE : skinStyleForSlug(slug);
  const badge = badgeStyleForSlug(badgeSlug);
  const dim =
    size === "lg"
      ? "h-14 w-14 text-2xl"
      : size === "md"
        ? "h-9 w-9 text-base"
        : "h-7 w-7 text-sm";
  const badgeDim =
    size === "lg" ? "h-6 w-6 text-xs" : size === "md" ? "h-5 w-5 text-[10px]" : "h-4 w-4 text-[9px]";

  return (
    <span className="relative inline-flex shrink-0" title={title}>
      <span
        className={`inline-flex ${dim} items-center justify-center rounded-full bg-zinc-900 ring-2 ${style.ring} shadow-lg ${style.glow}`}
      >
        {style.avatar}
      </span>
      {badge && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 inline-flex ${badgeDim} items-center justify-center rounded-full ring-2 ${badge.ring}`}
          title={badge.label}
        >
          {badge.icon}
        </span>
      )}
    </span>
  );
}

export function UserAvatarLink({
  slug,
  badgeSlug,
  href,
  title,
}: {
  slug?: string;
  badgeSlug?: string;
  href: string;
  title?: string;
}) {
  return (
    <Link href={href} className="inline-flex shrink-0">
      <UserAvatar slug={slug} badgeSlug={badgeSlug} title={title} />
    </Link>
  );
}
