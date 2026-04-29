import Link from "next/link";
import { requireUser } from "@/lib/session";
import { NewDeckForm } from "./NewDeckForm";

export default async function NewDeckPage() {
  await requireUser();

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="eyebrow">
            <Link href="/decks" style={{ color: "var(--ink-3)" }}>
              Decks
            </Link>{" "}
            / New
          </div>
          <h1
            style={{ fontFamily: "var(--font-display)", fontSize: 22, margin: 0 }}
          >
            New Deck
          </h1>
        </div>
      </div>

      <div className="page-body" style={{ maxWidth: 560 }}>
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Deck details</div>
          </div>
          <div className="panel-body">
            <NewDeckForm />
          </div>
        </div>
      </div>
    </div>
  );
}
