/**
 * Strips basic ASS/VTT tags from a subtitle cue and splits into visible lines.
 */
export function parseCueLines(rawText: string): string[] {
  return rawText
    .replace(/\{\\[^}]*\}/g, '')
    .replace(/<[^>]+>/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
