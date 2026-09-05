/**
 * Utility functions for user data formatting and cleaning.
 */

/**
 * Extracts and cleans a user's full name, removing university registration numbers,
 * student IDs, roll numbers, and redundant formatting characters.
 * 
 * Example:
 * - "HAARDIK PAHLAJANI 24BCG10051" -> "HAARDIK PAHLAJANI"
 * - "HAARDIK PAHLAJANI (24BCG10051)" -> "HAARDIK PAHLAJANI"
 * - "24BCG10051 - HAARDIK PAHLAJANI" -> "HAARDIK PAHLAJANI"
 * - "haardik.24bcg10051" -> "Haardik"
 * - "haardik.pahlajani.24bcg10051" -> "Haardik Pahlajani"
 */
export function cleanFullName(name?: string | null, knownRegNo?: string | null): string {
  if (!name || typeof name !== 'string') return 'Club Member';

  let cleaned = name;

  // 1. If a known registration number is supplied, remove it explicitly (case-insensitive)
  if (knownRegNo && knownRegNo.trim()) {
    const escaped = knownRegNo.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactRegex = new RegExp(`[\\s({\\[\\]})\\-–—•_/:|~]*\\b${escaped}\\b[\\s({\\[\\]})\\-–—•_/:|~]*`, 'gi');
    cleaned = cleaned.replace(exactRegex, ' ');
  }

  // 2. Remove standard university registration number patterns (e.g., 24BCG10051, 23BCE1001, 22BAI10001)
  cleaned = cleaned.replace(/[\s({\[\]})\-–—•_\/:|~]*\b\d{2}[a-zA-Z]{2,5}\d{3,6}\b[\s({\[\]})\-–—•_\/:|~]*/gi, ' ');

  // 3. Remove standalone numeric roll numbers or student IDs (5 to 12 digits)
  cleaned = cleaned.replace(/[\s({\[\]})\-–—•_\/:|~]*\b\d{5,12}\b[\s({\[\]})\-–—•_\/:|~]*/g, ' ');

  // 4. If name was derived from email format (e.g., "haardik.pahlajani" or "first_last"), clean dots & underscores
  if (cleaned.includes('.') || cleaned.includes('_')) {
    cleaned = cleaned.replace(/[._]/g, ' ');
  }

  // 5. Clean up any trailing/leading symbols, hyphens, colons, brackets, or commas
  cleaned = cleaned
    .replace(/^[\s\-–—•_\/:|~,()[\]{}#*+.]+/, '')
    .replace(/[\s\-–—•_\/:|~,()[\]{}#*+.]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 6. If cleaned string became completely empty, fallback to original trimmed or 'Club Member'
  if (!cleaned) {
    return name.trim() || 'Club Member';
  }

  // 7. Title case conversion if string was completely lowercase (e.g., from email prefix)
  if (cleaned === cleaned.toLowerCase() && !/[A-Z]/.test(cleaned)) {
    cleaned = cleaned
      .split(' ')
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
      .join(' ');
  }

  return cleaned;
}
