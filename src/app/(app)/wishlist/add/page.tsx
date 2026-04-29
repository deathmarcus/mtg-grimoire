import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { addWishlistItem } from "../actions";
import { IconSearch } from "@/components/Icons";

type SearchParams = Promise<{ q?: string; pick?: string; added?: string }>;

export default async function AddWishlistPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const { q, pick, added } = await searchParams;

  const existingTags = await prisma.wishlistItem.findMany({
    where: { userId: user.id, tag: { not: null } },
    select: { tag: true },
    distinct: ["tag"],
    orderBy: { tag: "asc" },
  });
  const tagOptions = existingTags.map((t) => t.tag!).filter(Boolean);

  const results =
    q && q.trim().length >= 2
      ? await prisma.card.findMany({
          where: { name: { contains: q.trim(), mode: "insensitive" } },
          orderBy: [{ name: "asc" }, { setCode: "asc" }],
          take: 20,
          select: {
            id: true,
            name: true,
            setCode: true,
            setName: true,
            collectorNumber: true,
            imageSmall: true,
            latestUsd: true,
          },
        })
      : [];

  const picked = pick
    ? await prisma.card.findUnique({ where: { id: pick } })
    : null;

  async function submitAction(formData: FormData) {
    "use server";
    const res = await addWishlistItem(formData);
    if (res && "ok" in res && res.ok) redirect("/wishlist/add?added=1");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Add to wishlist</div>
        <h1
          style={{
            fontFamily: "var(--font-crimson-pro), Georgia, serif",
            fontSize: 24,
            fontWeight: 500,
          }}
        >
          New wish
        </h1>
      </div>

      {added === "1" && (
        <div className="chip pos">Card added to wishlist. Search again to add another.</div>
      )}

      <form method="GET" className="panel" style={{ overflow: "hidden" }}>
        <div className="panel-head" style={{ gap: 8 }}>
          <IconSearch size={14} className="icon" />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search the Scryfall catalog…"
            className="grimoire-input"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-sm">
            Search
          </button>
        </div>
      </form>

      {results.length > 0 && (
        <div className="panel" style={{ overflow: "hidden", padding: 0 }}>
          {results.map((c) => {
            const active = c.id === pick;
            return (
              <Link
                key={c.id}
                href={{
                  pathname: "/wishlist/add",
                  query: { q: q ?? "", pick: c.id },
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 18px",
                  background: active ? "var(--bg-2)" : "transparent",
                  borderBottom: "1px solid var(--line-soft)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                {c.imageSmall && (
                  <Image
                    src={c.imageSmall}
                    alt={c.name}
                    width={48}
                    height={67}
                    style={{ width: 48, height: "auto", borderRadius: 2 }}
                    unoptimized
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-crimson-pro), Georgia, serif",
                      fontSize: 14,
                      color: "var(--ink-0)",
                    }}
                  >
                    {c.name}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>
                    {c.setName} · {c.setCode.toUpperCase()} #{c.collectorNumber}
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>
                  {c.latestUsd ? `$${c.latestUsd.toString()}` : "—"}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {picked && (
        <form action={submitAction} className="panel">
          <input type="hidden" name="cardId" value={picked.id} />
          <div className="panel-head">
            <div>
              <div className="eyebrow">
                {picked.setName} · {picked.setCode.toUpperCase()} #{picked.collectorNumber}
              </div>
              <div className="panel-title" style={{ marginTop: 4 }}>{picked.name}</div>
            </div>
          </div>
          <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 10,
              }}
            >
              <label className="auth-label">
                <span>Quantity wanted</span>
                <input type="number" name="quantityWanted" defaultValue={1} min={1} required className="grimoire-input" />
              </label>
              <label className="auth-label">
                <span>Max price (USD)</span>
                <input type="number" name="maxPriceUsd" step="0.01" min={0} placeholder="No limit" className="grimoire-input" />
              </label>
              <label className="auth-label">
                <span>Priority</span>
                <select name="priority" defaultValue="MEDIUM" className="grimoire-input">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </label>
              <label className="auth-label">
                <span>Tag</span>
                <input type="text" name="tag" list="existing-tags" placeholder="e.g. Deck Atraxa" className="grimoire-input" />
                <datalist id="existing-tags">
                  {tagOptions.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </label>
            </div>

            <label className="auth-label">
              <span>Notes</span>
              <textarea name="notes" rows={2} maxLength={500} placeholder="Optional notes…" className="grimoire-input" style={{ resize: "vertical" }} />
            </label>

            <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
              Add to wishlist
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
