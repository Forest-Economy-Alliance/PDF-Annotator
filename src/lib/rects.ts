/**
 * `Range.getClientRects()` frequently splits a single visual line into
 * several adjacent rects (one per text span crossed). Merge rects that
 * share a line — vertically overlapping by more than half their height —
 * into one bounding rect per line, so highlights and exported rects stay
 * clean.
 */
export function mergeLineRects(rects: DOMRect[]): DOMRect[] {
  const sorted = [...rects]
    .filter((r) => r.width > 0 && r.height > 0)
    .sort((a, b) => a.top - b.top || a.left - b.left);

  const merged: DOMRect[] = [];
  for (const rect of sorted) {
    const last = merged[merged.length - 1];
    if (last) {
      const overlap = Math.min(last.bottom, rect.bottom) - Math.max(last.top, rect.top);
      const minHeight = Math.min(last.height, rect.height);
      if (overlap > minHeight * 0.5) {
        const left = Math.min(last.left, rect.left);
        const top = Math.min(last.top, rect.top);
        const right = Math.max(last.right, rect.right);
        const bottom = Math.max(last.bottom, rect.bottom);
        merged[merged.length - 1] = new DOMRect(left, top, right - left, bottom - top);
        continue;
      }
    }
    merged.push(rect);
  }
  return merged;
}
