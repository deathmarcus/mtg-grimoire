
export type DeckImportRow = {
  quantity: number;
  name: string;
  setCode: string;
  collectorNumber: string;
  isCommander: boolean;
  board: "MAIN" | "SIDE";
};

export type DeckImportResult = {
  rows: DeckImportRow[];
  errors: string[];
  detectedCommanderName: string | null;
};

const TRAILING_MARKERS = /(\s+\*[^*]+\*)+$/g;
const MOXFIELD_LINE_RE = /^(\d+)\s+(.+?)\s+\(([^)]+)\)\s+(\S+)$/;

function isArenaFormat(text: string): boolean {
  return /^(Deck|Sideboard)\s*$/m.test(text);
}

function parseMoxfieldWithCommander(text: string): DeckImportResult {
  const rows: DeckImportRow[] = [];
  const errors: string[] = [];
  let detectedCommanderName: string | null = null;
  let inCommanderSection = false;
  let currentBoard: "MAIN" | "SIDE" = "MAIN";
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;

    if (raw.startsWith("//")) {
      const lower = raw.toLowerCase();
      inCommanderSection = lower.includes("commander");
      currentBoard = lower.includes("sideboard") ? "SIDE" : "MAIN";
      continue;
    }

    const hasCmdrMarker = /\*CMDR\*/i.test(raw);
    const cleaned = raw.replace(TRAILING_MARKERS, "").trim();

    const m = cleaned.match(MOXFIELD_LINE_RE);
    if (!m) {
      errors.push(`Line ${i + 1}: could not parse "${cleaned}"`);
      continue;
    }

    const isCommander = hasCmdrMarker || inCommanderSection;
    const name = m[2].trim();

    if (isCommander && detectedCommanderName === null) {
      detectedCommanderName = name;
    }

    rows.push({
      quantity: Number(m[1]),
      name,
      setCode: m[3],
      collectorNumber: m[4],
      isCommander,
      board: currentBoard,
    });
  }

  return { rows, errors, detectedCommanderName };
}

function parseArenaWithBoards(text: string): DeckImportResult {
  const rows: DeckImportRow[] = [];
  let currentBoard: "MAIN" | "SIDE" = "MAIN";
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (trimmed === "Deck") { currentBoard = "MAIN"; continue; }
    if (trimmed === "Sideboard") { currentBoard = "SIDE"; continue; }
    if (trimmed.startsWith("//")) continue;

    const m = trimmed.match(MOXFIELD_LINE_RE);
    if (!m) continue;

    rows.push({
      quantity: Number(m[1]),
      name: m[2].trim(),
      setCode: m[3],
      collectorNumber: m[4],
      isCommander: false,
      board: currentBoard,
    });
  }

  return { rows, errors: [], detectedCommanderName: null };
}

export function parseDeckImport(text: string): DeckImportResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { rows: [], errors: ["Input is empty"], detectedCommanderName: null };
  }

  const firstLine = trimmed.split(/\r?\n/)[0];

  if (firstLine.includes("Quantity,") || firstLine.includes("Name,")) {
    // Archidekt CSV — no commander support, no board tracking needed
    // Fall through to Moxfield parser which will report errors for CSV lines
    // (Archidekt support is out of scope for deck import)
    return parseMoxfieldWithCommander(trimmed);
  }

  if (isArenaFormat(trimmed)) {
    return parseArenaWithBoards(trimmed);
  }

  return parseMoxfieldWithCommander(trimmed);
}
