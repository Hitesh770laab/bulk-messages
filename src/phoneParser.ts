import type { Contact } from "./types";

export function normalizePhoneNumber(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  let clean = raw.replace(/[^\d+]/g, "");
  if (clean.startsWith("00")) clean = `+${clean.slice(2)}`;
  const digits = clean.replace(/\D/g, "");

  // Default 10 digits to +91
  if (digits.length === 10) return `+91${digits}`;
  // 12 digits starting with 91
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  // Standard E.164 lengths (8 to 15 digits)
  if (digits.length >= 8 && digits.length <= 15) return clean.startsWith("+") ? clean : `+${digits}`;
  return null;
}

export function parsePastedNumbers(text: string): { contacts: Contact[]; invalidCount: number; duplicateCount: number } {
  const lines = text.split(/[\r\n]+/);
  const seen = new Set<string>();
  const contacts: Contact[] = [];
  let invalidCount = 0;
  let duplicateCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle comma, semicolon, colon, pipe, or dash separated entries
    // e.g., "9876543210, John Doe" or "John Doe: 9876543210" or just "9876543210"
    let rawPhone = "";
    let rawName = "";

    const parts = line.split(/[,;\t|:]+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length === 1) {
      rawPhone = parts[0];
    } else {
      // Find which part has the most digits
      const digitsCount0 = parts[0].replace(/\D/g, "").length;
      const digitsCount1 = parts[1].replace(/\D/g, "").length;
      if (digitsCount0 >= 7) {
        rawPhone = parts[0];
        rawName = parts.slice(1).join(" ");
      } else if (digitsCount1 >= 7) {
        rawName = parts[0];
        rawPhone = parts[1];
      } else {
        rawPhone = parts[0];
      }
    }

    const normalized = normalizePhoneNumber(rawPhone);
    if (!normalized) {
      invalidCount++;
      continue;
    }

    if (seen.has(normalized)) {
      duplicateCount++;
      continue;
    }

    seen.add(normalized);
    const name = rawName || `Recipient ${contacts.length + 1}`;

    contacts.push({
      id: `paste-${Date.now()}-${contacts.length + 1}-${normalized.slice(-4)}`,
      name,
      phone: normalized,
      source: "Quick paste",
      consent: "opted_in",
      createdAt: new Date().toISOString(),
      tags: ["Direct Upload"]
    });
  }

  return { contacts, invalidCount, duplicateCount };
}
