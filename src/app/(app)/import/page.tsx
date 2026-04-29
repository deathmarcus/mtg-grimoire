import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ImportClient } from "./ImportClient";
import { getRecentImports } from "./actions";
import { t, type Locale } from "@/lib/i18n";

const FORMAT_DISPLAY: Record<string, string> = {
  manabox: "Manabox CSV",
  moxfield: "Moxfield TXT",
  arena: "Arena TXT",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function ImportPage() {
  const user = await requireUser();
  const [dbUser, collections, recentImports] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { locale: true },
    }),
    prisma.collection.findMany({
      where: { userId: user.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, isDefault: true },
    }),
    getRecentImports(user.id, 5),
  ]);
  const defaultId = collections.find((c) => c.isDefault)?.id ?? collections[0]?.id;
  const locale = (dbUser?.locale ?? "es") as Locale;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Bulk intake</div>
        <h1
          style={{
            fontFamily: "var(--font-crimson-pro), Georgia, serif",
            fontSize: 24,
            fontWeight: 500,
          }}
        >
          {t("page.import.title", locale)}
        </h1>
        <p style={{ color: "var(--ink-2)", fontSize: 13, lineHeight: 1.6, marginTop: 8, maxWidth: 520 }}>
          {t("page.import.description", locale)}
        </p>
      </div>
      <ImportClient
        collections={collections.map((c) => ({ id: c.id, name: c.name }))}
        defaultCollectionId={defaultId ?? ""}
      />

      {/* Recent imports history */}
      {recentImports.length > 0 && (
        <div className="panel" style={{ marginTop: 8 }}>
          <div className="panel-head">
            <div className="panel-title">{t("page.import.recentImports", locale)}</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("label.date", locale)}</th>
                  <th>{t("label.file", locale)}</th>
                  <th>{t("page.import.format", locale)}</th>
                  <th className="num">{t("page.import.cards", locale)}</th>
                  <th className="num">{t("page.import.new", locale)}</th>
                  <th className="num">{t("page.import.merged", locale)}</th>
                </tr>
              </thead>
              <tbody>
                {recentImports.map((log) => (
                  <tr key={log.id}>
                    <td className="mono" style={{ fontSize: 11, color: "var(--ink-2)", whiteSpace: "nowrap" }}>
                      {formatDate(log.createdAt)}
                    </td>
                    <td
                      style={{
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: 12,
                      }}
                    >
                      {log.filename}
                    </td>
                    <td>
                      <span className="chip" style={{ fontSize: 10 }}>
                        {FORMAT_DISPLAY[log.format] ?? log.format}
                      </span>
                    </td>
                    <td className="num mono" style={{ fontSize: 12 }}>{log.cardCount}</td>
                    <td className="num mono" style={{ fontSize: 12, color: "var(--pos)" }}>{log.newCount}</td>
                    <td className="num mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>{log.mergedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
