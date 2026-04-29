import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { addCollectionItem } from "../actions";
import { IconSearch } from "@/components/Icons";

type SearchParams = Promise<{ q?: string; pick?: string; added?: string }>;

export default async function AddCardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const { q, pick, added } = await searchParams;

  const collections = await prisma.collection.findMany({
    where: { userId: user.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, isDefault: true },
  });
  const defaultId = collections.find((c) => c.isDefault)?.id ?? collections[0]?.id;

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
    const res = await addCollectionItem(formData);
    if ("ok" in res && res.ok) redirect("/collection/new?added=1");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Add to grimoire</div>
        <h1
          style={{
            fontFamily: "var(--font-crimson-pro), Georgia, serif",
            fontSize: 24,
            fontWeight: 500,
          }}
        >
          New card
        </h1>
      </div>

      {added === "1" && (
        <div className="chip pos">Card added. Search again to add another.</div>
      )}

      <form
        method="GET"
        className="panel"
        style={{ overflow: "hidden" }}
      >
        <div
          className="panel-head"
          style={{ gap: 8 }}
        >
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
                  pathname: "/collection/new",
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
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: 10,
              }}
            >
              <label className="auth-label">
                <span>Folder</span>
                <select name="collectionId" defaultValue={defaultId} className="grimoire-input">
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="auth-label">
                <span>Quantity</span>
                <input type="number" name="quantity" defaultValue={1} min={1} required className="grimoire-input" />
              </label>
              <label className="auth-label">
                <span>Finish</span>
                <select name="foil" defaultValue="NORMAL" className="grimoire-input">
                  <option value="NORMAL">Normal</option>
                  <option value="FOIL" disabled={!picked.foilAvailable}>Foil</option>
                  <option value="ETCHED" disabled={!picked.etchedAvailable}>Etched</option>
                </select>
              </label>
              <label className="auth-label">
                <span>Condition</span>
                <select name="condition" defaultValue="NM" className="grimoire-input">
                  {["NM", "LP", "MP", "HP", "DMG"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="auth-label">
                <span>Language</span>
                <input type="text" name="language" defaultValue="en" className="grimoire-input" />
              </label>
            </div>

            <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
              Add to collection
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
