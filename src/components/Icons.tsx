type Props = { size?: number; className?: string };

const svgProps = (size: number, className?: string) =>
  ({
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  });

export function IconDashboard({ size = 16, className }: Props) {
  return (
    <svg {...svgProps(size, className)}>
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  );
}

export function IconCollection({ size = 16, className }: Props) {
  return (
    <svg {...svgProps(size, className)}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

export function IconFolders({ size = 16, className }: Props) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function IconWishlist({ size = 16, className }: Props) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export function IconPlus({ size = 16, className }: Props) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconImport({ size = 16, className }: Props) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

export function IconSearch({ size = 16, className }: Props) {
  return (
    <svg {...svgProps(size, className)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

export function IconSignOut({ size = 16, className }: Props) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function IconGrid({ size = 16, className }: Props) {
  return (
    <svg {...svgProps(size, className)}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

export function IconList({ size = 16, className }: Props) {
  return (
    <svg {...svgProps(size, className)}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </svg>
  );
}

export function IconArrow({ size = 16, className }: Props) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

export function IconEdit({ size = 16, className }: Props) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

export function IconTrash({ size = 16, className }: Props) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function IconStats({ size = 16, className }: Props) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M3 3v18h18" />
      <path d="m7 14 3-3 4 4 5-5" />
    </svg>
  );
}

export function IconDecks({ size = 16, className }: Props) {
  return (
    <svg {...svgProps(size, className)}>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
  );
}

export function IconArrowUp({ size = 16, className }: Props) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

export function IconArrowDown({ size = 16, className }: Props) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  );
}

export function IconTrendUp({ size = 16, className }: Props) {
  return (
    <svg {...svgProps(size, className)}>
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="14 7 21 7 21 14" />
    </svg>
  );
}
