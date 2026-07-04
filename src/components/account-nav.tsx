import Link from "next/link";

const TABS = [
  { href: "/account", label: "Wallet" },
  { href: "/account/hustle", label: "Hustle" },
  { href: "/account/quests", label: "Quests" },
  { href: "/account/digest", label: "Digest" },
  { href: "/account/creator", label: "Creator" },
  { href: "/account/achievements", label: "Achievements" },
  { href: "/account/disputes", label: "Disputes" },
  { href: "/account/votes", label: "Votes" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/account/profile", label: "Profile" },
] as const;

export function AccountNav({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-white/5 text-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TABS.map((tab) => {
        const isActive = tab.href === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              isActive
                ? "shrink-0 rounded-t-sm border-b-2 border-fuchsia-400 px-3 py-2 font-medium text-fuchsia-300"
                : "shrink-0 rounded-t-sm border-b-2 border-transparent px-3 py-2 text-zinc-400 hover:text-zinc-100"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
