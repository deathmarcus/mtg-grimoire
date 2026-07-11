"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { computeTooltipPosition, type TooltipPosition } from "@/lib/tooltip-position";

const HOVER_DELAY_MS = 150;
const TOOLTIP_WIDTH = 260;
const TOOLTIP_HEIGHT = Math.round((TOOLTIP_WIDTH * 680) / 488);
const VIEWPORT_MARGIN = 12;

type Props = {
  imageUrl?: string | null;
  cardName: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function CardHoverPreview({ imageUrl, cardName, children, className, style }: Props) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [isTouch] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(hover: none)").matches,
  );
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
    setLoaded(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    window.addEventListener("scroll", close, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [visible, close]);

  useEffect(() => () => close(), [close]);

  if (!imageUrl) return <>{children}</>;

  function handleMouseEnter() {
    if (isTouch) return;
    timeoutRef.current = setTimeout(() => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition(
        computeTooltipPosition(
          rect,
          { width: TOOLTIP_WIDTH, height: TOOLTIP_HEIGHT },
          { width: window.innerWidth, height: window.innerHeight },
          VIEWPORT_MARGIN,
        ),
      );
      setVisible(true);
    }, HOVER_DELAY_MS);
  }

  return (
    <span
      ref={wrapperRef}
      className={className}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={close}
    >
      {children}
      {visible &&
        position &&
        createPortal(
          <div
            className="card-hover-tooltip"
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: TOOLTIP_WIDTH,
              aspectRatio: "488 / 680",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- lazy-loaded on first hover; next/image adds no value for a one-off floating preview */}
            <img
              src={imageUrl}
              alt={cardName}
              loading="eager"
              onLoad={() => setLoaded(true)}
              style={{
                width: "100%",
                height: "100%",
                display: "block",
                borderRadius: "var(--r-lg)",
                opacity: loaded ? 1 : 0,
                transition: "opacity 120ms",
              }}
            />
          </div>,
          document.body,
        )}
    </span>
  );
}
