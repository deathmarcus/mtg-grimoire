import { exportHref } from "@/lib/export";
import { t, type Locale } from "@/lib/i18n";

type Props = {
  type: "collection" | "wishlist" | "deck";
  deckId?: string;
  locale: Locale;
};

export function ExportButtons({ type, deckId, locale }: Props) {
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <a
        href={exportHref(type, "csv", deckId)}
        className="btn btn-ghost btn-sm"
        download
      >
        {t("action.exportCsv", locale)}
      </a>
      <a
        href={exportHref(type, "json", deckId)}
        className="btn btn-ghost btn-sm"
        download
      >
        {t("action.exportJson", locale)}
      </a>
    </span>
  );
}
