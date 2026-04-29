import Link from "next/link";
import { IconGrid, IconList } from "@/components/Icons";

export function WishlistViewToggle({
  current,
  buildHref,
}: {
  current: "grid" | "table";
  buildHref: (view: "grid" | "table") => string;
}) {
  return (
    <div className="toggle-group" role="group" aria-label="View mode">
      <Link
        href={buildHref("grid")}
        aria-pressed={current === "grid"}
        aria-label="Grid view"
        className={current === "grid" ? "active" : ""}
      >
        <IconGrid size={14} />
      </Link>
      <Link
        href={buildHref("table")}
        aria-pressed={current === "table"}
        aria-label="Table view"
        className={current === "table" ? "active" : ""}
      >
        <IconList size={14} />
      </Link>
    </div>
  );
}
