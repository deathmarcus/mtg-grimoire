"use client";

import { useEffect, useRef, useState } from "react";

// ── Pool de videos ─────────────────────────────────────────────────────────────
const VIDEO_POOL = [
  "/videos/hero-1.webm",
  "/videos/hero-2.webm",
  "/videos/hero-3.webm",
  "/videos/hero-4.webm",
  "/videos/hero-5.webm",
  "/videos/hero-6.webm",
  "/videos/hero-7.webm",
  "/videos/hero-8.webm",
  "/videos/hero-9.webm",
  "/videos/hero-10.webm",
  "/videos/hero-11.webm",
  "/videos/hero-12.webm",
];
// ── Pool de quotes ─────────────────────────────────────────────────────────────
const QUOTES = [
  "Un grimorio no es una lista. Es la memoria de cada sobre abierto, cada trade, cada top-deck.",
  "Each card is a decision. Each deck is a philosophy. Each collection is a life's work.",
  "El mazo perfecto no existe — pero la búsqueda de él es lo que nos mantiene jugando.",
  "Magic is not about the cards you have. It's about the stories they tell together.",
  "Cada sobre es una promesa. No sabes qué hay adentro, pero sabes que algo cambiará.",
];

// ── Imágenes fallback ──────────────────────────────────────────────────────────
const FALLBACK_CARDS = [
  { src: "/images/hero-card-1.jpg", rotate: -18, x: -55, y: 20 },
  { src: "/images/hero-card-2.jpg", rotate: -6, x: -18, y: 0 },
  { src: "/images/hero-card-3.jpg", rotate: 6, x: 18, y: 10 },
  { src: "/images/hero-card-4.jpg", rotate: 18, x: 55, y: 25 },
];

function pickRandom<T>(arr: T[], exclude?: T): T {
  const pool = exclude !== undefined ? arr.filter((v) => v !== exclude) : arr;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function HeroVideo() {
  // Sin aleatoriedad en el render inicial — evita hydration mismatch
  const [mounted, setMounted] = useState(false);
  const [quote, setQuote] = useState("");
  const [videoFailed, setVideoFailed] = useState(false);

  // Crossfade state
  const refA = useRef<HTMLVideoElement>(null);
  const refB = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState<"a" | "b">("a");
  const [srcA, setSrcA] = useState("");
  const [srcB, setSrcB] = useState("");
  const fadingRef = useRef(false);
  const lastSrcRef = useRef("");

  useEffect(() => {
    // Runs client-side only — safe to use Math.random() here without SSR mismatch
    const initialSrc = pickRandom(VIDEO_POOL);
    lastSrcRef.current = initialSrc;
    /* eslint-disable react-hooks/set-state-in-effect */
    setSrcA(initialSrc);
    setQuote(pickRandom(QUOTES));
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!mounted || !srcA) return;
    refA.current?.play().catch(() => setVideoFailed(true));
  }, [mounted, srcA]);

  function crossfadeTo(nextSrc: string) {
    if (fadingRef.current) return;
    fadingRef.current = true;

    if (active === "a") {
      setSrcB(nextSrc);
      setTimeout(() => {
        refB.current?.play().catch(() => {});
        setActive("b");
        lastSrcRef.current = nextSrc;
        setTimeout(() => {
          refA.current?.pause();
          fadingRef.current = false;
        }, 600);
      }, 50);
    } else {
      setSrcA(nextSrc);
      setTimeout(() => {
        refA.current?.play().catch(() => {});
        setActive("a");
        lastSrcRef.current = nextSrc;
        setTimeout(() => {
          refB.current?.pause();
          fadingRef.current = false;
        }, 600);
      }, 50);
    }
  }

  function handleEnded() {
    crossfadeTo(pickRandom(VIDEO_POOL, lastSrcRef.current));
  }

  // Antes de montar: fondo oscuro puro (sin texto ni video — evita mismatch)
  if (!mounted) return null;

  return (
    <>
      {videoFailed ? (
        <FallbackCards />
      ) : (
        <>
          {/* Video A */}
          {srcA && (
            <video
              ref={refA}
              src={srcA}
              muted
              playsInline
              preload="auto"
              onEnded={handleEnded}
              onError={() => setVideoFailed(true)}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: active === "a" ? 1 : 0,
                transition: "opacity 0.5s ease",
                zIndex: 0,
              }}
            />
          )}

          {/* Video B */}
          {srcB && (
            <video
              ref={refB}
              src={srcB}
              muted
              playsInline
              preload="auto"
              onEnded={handleEnded}
              onError={() => setVideoFailed(true)}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: active === "b" ? 1 : 0,
                transition: "opacity 0.5s ease",
                zIndex: 0,
              }}
            />
          )}
        </>
      )}

      {/* Gradiente de legibilidad — siempre presente */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, oklch(0.08 0.010 45 / 0.55) 0%, transparent 25%, transparent 60%, oklch(0.07 0.010 45 / 0.7) 100%)",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      {/* Quote abajo-izquierda — siempre presente */}
      <blockquote
        style={{
          position: "absolute",
          bottom: 48,
          left: 48,
          right: 48,
          zIndex: 2,
          margin: 0,
          fontFamily: "var(--font-crimson-pro), Georgia, serif",
          fontStyle: "italic",
          fontSize: 19,
          lineHeight: 1.55,
          color: "var(--ink-1)",
          maxWidth: 380,
        }}
      >
        &ldquo;{quote}&rdquo;
      </blockquote>
    </>
  );
}

// ── Fallback: cartas en fan ────────────────────────────────────────────────────
function FallbackCards() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 0,
      }}
    >
      <div style={{ position: "relative", width: 360, height: 420 }}>
        {FALLBACK_CARDS.map((card, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 200,
              height: 280,
              transform: `translate(calc(-50% + ${card.x * 1.8}px), calc(-50% + ${card.y * 1.8}px)) rotate(${card.rotate}deg)`,
              borderRadius: 10,
              overflow: "hidden",
              boxShadow: "0 10px 36px oklch(0 0 0 / 0.6)",
              background: "var(--bg-2)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={card.src}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
