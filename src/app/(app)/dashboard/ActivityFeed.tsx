import {
  IconPlus,
  IconImport,
  IconWishlist,
  IconTrash,
} from "@/components/Icons";
import type {
  ActivityEntry,
  AddPayload,
  DeletePayload,
  ImportPayload,
  WishlistAddPayload,
} from "@/lib/activity";

function formatRelative(date: Date, now = new Date()): string {
  const diff = now.getTime() - date.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 4) return `${w}w ago`;
  return date.toISOString().slice(0, 10);
}

type Props = { entries: ActivityEntry[] };

export function ActivityFeed({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Recent activity</div>
        </div>
        <div className="panel-body">
          <p style={{ color: "var(--ink-2)", fontSize: 13 }}>
            No activity yet. Add a card or import a CSV to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">Recent activity</div>
      </div>
      <div>
        {entries.map((e) => (
          <ActivityRow key={e.id} entry={e} />
        ))}
      </div>
    </div>
  );
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const { icon, body, color } = describeActivity(entry);
  return (
    <div
      style={{
        padding: "12px 18px",
        borderBottom: "1px solid var(--line-soft)",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        fontSize: 13,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "var(--bg-2)",
          border: "1px solid var(--line)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          color,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ color: "var(--ink-0)" }}>{body}</div>
        <div
          style={{
            color: "var(--ink-3)",
            fontFamily: "var(--font-jetbrains-mono), monospace",
            fontSize: 10,
            marginTop: 3,
          }}
        >
          {formatRelative(entry.createdAt)}
        </div>
      </div>
    </div>
  );
}

type Described = { icon: React.ReactNode; body: React.ReactNode; color: string };

function describeActivity(entry: ActivityEntry): Described {
  switch (entry.type) {
    case "add": {
      const p = entry.payload as AddPayload;
      return {
        icon: <IconPlus size={12} />,
        color: "var(--accent)",
        body: (
          <>
            Añadiste{" "}
            <span style={{ color: "var(--accent)" }}>{p.cardName}</span>
            {p.quantity > 1 ? ` ×${p.quantity}` : ""}
          </>
        ),
      };
    }
    case "delete": {
      const p = entry.payload as DeletePayload;
      return {
        icon: <IconTrash size={12} />,
        color: "var(--neg)",
        body: (
          <>
            Eliminaste{" "}
            <span style={{ color: "var(--ink-1)" }}>{p.cardName}</span>
            {p.quantity > 1 ? ` ×${p.quantity}` : ""}
          </>
        ),
      };
    }
    case "import": {
      const p = entry.payload as ImportPayload;
      const verb = p.replaced ? "Reemplazaste" : "Importaste";
      return {
        icon: <IconImport size={12} />,
        color: "var(--accent)",
        body: (
          <>
            {verb} {p.total} cartas a{" "}
            <span style={{ color: "var(--accent)" }}>{p.collectionName}</span>
          </>
        ),
      };
    }
    case "wishlist_add": {
      const p = entry.payload as WishlistAddPayload;
      return {
        icon: <IconWishlist size={12} />,
        color: "var(--accent)",
        body: (
          <>
            Agregaste{" "}
            <span style={{ color: "var(--accent)" }}>{p.cardName}</span> a la
            wishlist
          </>
        ),
      };
    }
  }
}
