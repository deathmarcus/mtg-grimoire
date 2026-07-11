import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { getPublicDeckBySlug } from "@/lib/public-deck";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const deck = await getPublicDeckBySlug(slug);
  // Private/missing decks never get an OG image — mirrors the page's own
  // notFound() so a deck made private again stops being previewable too.
  if (!deck) notFound();

  const name = deck.name;
  const format = deck.format || "";
  const art = deck.coverImage;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#1c1712",
          color: "#f0e6d2",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {art && (
          <img
            src={art}
            alt=""
            width={480}
            height={630}
            style={{ objectFit: "cover", opacity: 0.55 }}
          />
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 60px",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 24,
              textTransform: "uppercase",
              letterSpacing: 4,
              color: "#c9a95f",
              marginBottom: 16,
            }}
          >
            {format || "Grimoire Deck"}
          </div>
          <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1 }}>{name}</div>
          <div style={{ fontSize: 22, color: "#a99b7f", marginTop: 24 }}>
            Grimoire — MTG Collector
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
