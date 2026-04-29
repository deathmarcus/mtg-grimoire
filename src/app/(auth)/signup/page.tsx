import Link from "next/link";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { SubmitButton } from "@/components/SubmitButton";

const signupSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export default function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  async function signupAction(formData: FormData) {
    "use server";

    const parsed = signupSchema.safeParse({
      name: formData.get("name") || undefined,
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) redirect("/signup?error=invalid");

    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (existing) redirect("/signup?error=exists");

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
        collections: {
          create: { name: "Mi colección", isDefault: true, sortOrder: 0 },
        },
      },
    });

    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  }

  return <ResolvedForm searchParams={searchParams} action={signupAction} />;
}

async function ResolvedForm({
  searchParams,
  action,
}: {
  searchParams: Promise<{ error?: string }>;
  action: (formData: FormData) => Promise<void>;
}) {
  const { error } = await searchParams;

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
        Create account
      </h1>
      <p style={{ color: "var(--ink-2)", fontSize: 14, marginBottom: 32 }}>
        Begin your grimoire.
      </p>

      {error === "invalid" && (
        <p role="alert" className="auth-error" style={{ marginBottom: 20 }}>
          Please check your input.
        </p>
      )}
      {error === "exists" && (
        <p role="alert" className="auth-error" style={{ marginBottom: 20 }}>
          An account with that email already exists.
        </p>
      )}

      <form
        action={action}
        style={{ display: "flex", flexDirection: "column", gap: 20 }}
      >
        <label className="auth-label">
          <span>Name (optional)</span>
          <input
            type="text"
            name="name"
            autoComplete="name"
            className="grimoire-input"
          />
        </label>
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
          <span>Password (min 8)</span>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="grimoire-input"
          />
        </label>

        <SubmitButton pendingLabel="Creating…">Create account</SubmitButton>
      </form>

      <p style={{ marginTop: 32, fontSize: 13, color: "var(--ink-2)" }}>
        Already have one?{" "}
        <Link href="/login" style={{ color: "var(--accent)" }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
