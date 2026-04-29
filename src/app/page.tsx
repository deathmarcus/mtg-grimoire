import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        display: "flex",
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: "0 32px",
      }}
    >
      <section style={{ maxWidth: 560, padding: "80px 0", textAlign: "center" }}>
        <div className="brand-mark" style={{ width: 56, height: 56, fontSize: 26, margin: "0 auto 24px" }}>
          ✦
        </div>
        <h1
          style={{
            fontFamily: "var(--font-crimson-pro), Georgia, serif",
            fontSize: 36,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            marginBottom: 12,
          }}
        >
          Grimoire
        </h1>
        <p
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--ink-3)",
            marginBottom: 32,
          }}
        >
          mtg · collector
        </p>
        <p style={{ color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6, marginBottom: 40 }}>
          A curated digital grimoire for your Magic: The Gathering collection.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <Link href="/login" className="btn btn-primary">
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-ghost">
            Create account
          </Link>
        </div>
      </section>
    </main>
  );
}
