/** Serializable card shape passed from server to DeckBuilder client component */
export type ClientDeckCard = {
  id: string; // DeckCard.id
  quantity: number;
  isCommander: boolean;
  board: "MAIN" | "SIDE";
  category: string | null;
  card: {
    id: string; // Card.id (Scryfall UUID)
    name: string;
    typeLine: string;
    manaCost: string;
    cmc: number;
    colors: string[];
    colorIdentity: string[];
    rarity: string;
    setCode: string;
    imageNormal: string | null;
    latestUsd: number | null;
    legalities: unknown;
  };
};

export type DeckLegality = Record<string, boolean>;
