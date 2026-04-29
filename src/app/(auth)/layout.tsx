import { HeroVideo } from "./HeroVideo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell">
      {/* Hero side — video fullscreen con overlays */}
      <div className="auth-hero">
        {/* Logo — arriba izquierda */}
        <div className="auth-hero-brand">
          <div className="brand-mark" style={{ width: 40, height: 40, fontSize: 18 }}>
            ✦
          </div>
          <div>
            <div
              style={{
                fontFamily: "var(--font-crimson-pro), Georgia, serif",
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: "-0.01em",
                lineHeight: 1,
              }}
            >
              Grimoire
            </div>
            <div
              className="mono"
              style={{
                fontSize: 9,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "var(--ink-3)",
                marginTop: 3,
              }}
            >
              mtg · collector
            </div>
          </div>
        </div>

        {/* Video + fallback + quote (client component) */}
        <HeroVideo />
      </div>

      {/* Form side */}
      <div className="auth-form">
        <div style={{ width: "100%", maxWidth: 400 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
