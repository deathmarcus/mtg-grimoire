import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { signOut } from "@/auth";
import { AppNav } from "./AppNav";
import { CurrencyToggle } from "./CurrencyToggle";
import { LocaleToggle } from "./LocaleToggle";
import type { Locale } from "@/lib/i18n";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { displayCurrency: true, locale: true },
  });
  const currency = dbUser?.displayCurrency ?? "USD";
  const locale = (dbUser?.locale ?? "es") as Locale;

  const userName = user.name || user.email || "User";

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="app-shell" data-locale={locale}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <AppNav userName={userName} locale={locale} signOutAction={signOutAction} />

      <div className="app-main">
        <header className="topbar">
          <div style={{ flex: 1 }} />
          <LocaleToggle current={locale} />
          <CurrencyToggle current={currency} />
        </header>

        <main id="main-content" className="app-content">
          {children}
        </main>
      </div>
    </div>
  );
}
