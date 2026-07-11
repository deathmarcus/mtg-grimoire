import Link from "next/link";

// Minimal public chrome for /d/<slug> — no sidebar, no session lookup.
// Root layout (src/app/layout.tsx) already supplies fonts and the mana-font
// stylesheet, so this only adds a thin brand header/footer.
export default function PublicDeckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid var(--line-soft)",
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-crimson-pro), Georgia, serif",
            fontSize: 18,
            color: "var(--accent)",
            textDecoration: "none",
          }}
        >
          Grimoire
        </Link>
        <Link href="/login" className="btn btn-sm">
          Iniciar sesión
        </Link>
      </header>

      <main style={{ flex: 1 }}>{children}</main>

      <footer
        style={{
          padding: "16px 24px",
          textAlign: "center",
          fontSize: 11,
          color: "var(--ink-3)",
        }}
      >
        Grimoire — MTG Collector
      </footer>
    </div>
  );
}
