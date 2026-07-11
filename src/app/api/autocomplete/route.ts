import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { autocompleteQuerySchema, buildAutocompleteQuery } from "@/lib/autocomplete";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Generous per-user ceiling: at 200ms client debounce a fast typer fires at
// most ~5 req/s, so 30 requests / 10s comfortably covers normal use while
// still blocking a scripted sweep of the ~114k-row catalog. Keyed by userId
// (auth is required) with IP folded in as a secondary key so one compromised
// session can't be used to fan out requests from many IPs unnoticed.
const RATE_LIMIT = { limit: 30, windowMs: 10_000 };

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request.headers);
  const rateCheck = checkRateLimit(`autocomplete:${userId}:${ip}`, RATE_LIMIT);
  if (!rateCheck.allowed) {
    return Response.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rateCheck.retryAfterMs / 1000)) },
      }
    );
  }

  const params = new URL(request.url).searchParams;
  const parsed = autocompleteQuerySchema.safeParse({ q: params.get("q") ?? "" });
  if (!parsed.success) {
    return Response.json({ error: "Invalid q" }, { status: 400 });
  }

  const rows = await prisma.$queryRaw<{ name: string }[]>(
    buildAutocompleteQuery(parsed.data.q)
  );

  return Response.json({ results: rows.map((r) => r.name) });
}
