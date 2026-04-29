import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { SubmitButton } from "@/components/SubmitButton";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  async function credentialsAction(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const callbackUrl = String(formData.get("callbackUrl") ?? "/dashboard");

    try {
      await signIn("credentials", { email, password, redirectTo: callbackUrl });
    } catch (err) {
      if ((err as Error)?.message === "NEXT_REDIRECT") throw err;
      redirect(`/login?error=invalid`);
    }
  }

  async function googleAction() {
    "use server";
    await signIn("google", { redirectTo: "/dashboard" });
  }

  return (
    <ResolvedForm
      searchParams={searchParams}
      credentialsAction={credentialsAction}
      googleAction={googleAction}
    />
  );
}

async function ResolvedForm({
  searchParams,
  credentialsAction,
  googleAction,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
  credentialsAction: (formData: FormData) => Promise<void>;
  googleAction: () => Promise<void>;
}) {
  const { callbackUrl, error } = await searchParams;

  return (
    <div>
      <h1
        style={{
          fontFamily: "var(--font-crimson-pro), Georgia, serif",
          fontSize: 28,
          fontWeight: 500,
          marginBottom: 6,
        }}
      >
        Sign in
      </h1>
      <p style={{ color: "var(--ink-2)", fontSize: 14, marginBottom: 32 }}>
        Enter the grimoire.
      </p>

      {error === "invalid" && (
        <p role="alert" className="auth-error" style={{ marginBottom: 20 }}>
          Invalid email or password.
        </p>
      )}

      <form
        action={credentialsAction}
        style={{ display: "flex", flexDirection: "column", gap: 20 }}
      >
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/dashboard"} />
        <label className="auth-label">
          <span>Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="grimoire-input"
          />
        </label>
        <label className="auth-label">
          <span>Password</span>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="current-password"
            className="grimoire-input"
          />
        </label>

        <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
      </form>

      <form action={googleAction} style={{ marginTop: 12 }}>
        <SubmitButton variant="surface" fullWidth pendingLabel="Redirecting…">
          Continue with Google
        </SubmitButton>
      </form>

      <p style={{ marginTop: 32, fontSize: 13, color: "var(--ink-2)" }}>
        No account?{" "}
        <Link href="/signup" style={{ color: "var(--accent)" }}>
          Create one
        </Link>
      </p>
    </div>
  );
}
