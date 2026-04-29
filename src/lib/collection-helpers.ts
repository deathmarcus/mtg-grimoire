export function slugifyCollectionName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

const MAX_NAME_LENGTH = 50;

export function validateCollectionName(input: string): ValidationResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "El nombre es obligatorio" };
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Máximo ${MAX_NAME_LENGTH} caracteres` };
  }
  if (slugifyCollectionName(trimmed).length === 0) {
    return { ok: false, error: "El nombre debe contener letras o números" };
  }
  return { ok: true, value: trimmed };
}
