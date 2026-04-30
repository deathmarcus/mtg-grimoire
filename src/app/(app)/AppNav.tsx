"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconDashboard,
  IconCollection,
  IconWishlist,
  IconDecks,
  IconImport,
  IconSearch,
  IconTrendUp,
  IconSignOut,
} from "@/components/Icons";
import { t, type Locale } from "@/lib/i18n";

type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  section: "library" | "tools";
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: IconDashboard, section: "library" },
  { href: "/collection", labelKey: "nav.collection", icon: IconCollection, section: "library" },
  { href: "/decks", labelKey: "nav.decks", icon: IconDecks, section: "library" },
  { href: "/wishlist", labelKey: "nav.wishlist", icon: IconWishlist, section: "library" },
  { href: "/search", labelKey: "nav.search", icon: IconSearch, section: "tools" },
  { href: "/stats", labelKey: "nav.stats", icon: IconTrendUp, section: "tools" },
  { href: "/import", labelKey: "nav.import", icon: IconImport, section: "tools" },
];

export function AppNav({
  userName,
  locale,
  signOutAction,
}: {
  userName: string;
  locale: Locale;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : href === "/collection"
        ? pathname === "/collection" || pathname.startsWith("/collection/")
        : href === "/decks"
          ? pathname === "/decks" || pathname.startsWith("/decks/")
          : pathname.startsWith(href);

  const library = NAV_ITEMS.filter((i) => i.section === "library");
  const tools = NAV_ITEMS.filter((i) => i.section === "tools");

  const initial = userName.charAt(0).toUpperCase() || "?";

  const libLabel = locale === "en" ? "Library" : "Biblioteca";
  const toolsLabel = locale === "en" ? "Tools" : "Herramientas";

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">✦</div>
        <div>
          <div className="brand-name">Grimoire</div>
          <div className="brand-sub">mtg · collector</div>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Primary">
        <div className="nav-section">{libLabel}</div>
        {library.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`nav-item ${active ? "active" : ""}`}
            >
              <item.icon size={16} className="icon" />
              <span>{t(item.labelKey, locale)}</span>
            </Link>
          );
        })}

        <div className="nav-section">{toolsLabel}</div>
        {tools.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`nav-item ${active ? "active" : ""}`}
            >
              <item.icon size={16} className="icon" />
              <span>{t(item.labelKey, locale)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-avatar">{initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              color: "var(--ink-0)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {userName}
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: 10,
                color: "var(--ink-3)",
                fontFamily: "var(--font-jetbrains-mono), monospace",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                display: "flex",
                alignItems: "center",
                gap: 4,
                marginTop: 2,
              }}
            >
              <IconSignOut size={10} />
              {t("action.signOut", locale)}
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
