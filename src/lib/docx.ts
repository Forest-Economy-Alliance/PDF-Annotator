import DOMPurify from 'dompurify';
import mammoth from 'mammoth/mammoth.browser.min.js';
import type { NormalizedRect } from '../types';
import { mergeLineRects } from './rects';

const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, tr, blockquote';

/**
 * Convert a .docx to sanitized HTML. A "\n" text node is appended after each block element so the
 * extracted plain text keeps paragraph breaks (whitespace between blocks is collapsed when rendered).
 */
export async function convertDocxToHtml(data: ArrayBuffer): Promise<string> {
  const { value } = await mammoth.convertToHtml({ arrayBuffer: data });
  const container = document.createElement('div');
  container.innerHTML = DOMPurify.sanitize(value);
  container.querySelectorAll(BLOCK_SELECTOR).forEach((el) => el.after(document.createTextNode('\n')));
  return container.innerHTML;
}

/** Plain text of converted HTML. Annotation offsets index into this string. */
export function htmlToText(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container.textContent ?? '';
}

export interface TextSegment {
  node: Text;
  start: number;
  end: number;
}

export function indexTextNodes(root: Node): TextSegment[] {
  const segments: TextSegment[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let pos = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const node = n as Text;
    segments.push({ node, start: pos, end: pos + node.data.length });
    pos += node.data.length;
  }
  return segments;
}

/** Character offsets of a DOM range within `container`'s text, trimmed of surrounding whitespace. */
export function selectionOffsets(
  container: HTMLElement,
  range: Range,
  fullText: string,
): { start: number; end: number } | null {
  const r = range.cloneRange();
  if (!container.contains(r.startContainer)) r.setStart(container, 0);
  if (!container.contains(r.endContainer)) r.setEnd(container, container.childNodes.length);

  const pre = document.createRange();
  pre.selectNodeContents(container);
  pre.setEnd(r.startContainer, r.startOffset);

  let start = pre.toString().length;
  let end = start + r.toString().length;
  while (start < end && /\s/.test(fullText[start])) start++;
  while (end > start && /\s/.test(fullText[end - 1])) end--;
  return end > start ? { start, end } : null;
}

/** Highlight rects (normalized to `wrapper`) for a [start, end) text range. Text-node rects only, one per line. */
export function rectsForOffsets(
  segments: TextSegment[],
  start: number,
  end: number,
  wrapper: HTMLElement,
): NormalizedRect[] {
  const wrapperRect = wrapper.getBoundingClientRect();
  if (wrapperRect.width === 0 || wrapperRect.height === 0) return [];

  const raw: DOMRect[] = [];
  const range = document.createRange();
  for (const seg of segments) {
    if (seg.end <= start || seg.start >= end) continue;
    range.setStart(seg.node, Math.max(start, seg.start) - seg.start);
    range.setEnd(seg.node, Math.min(end, seg.end) - seg.start);
    raw.push(...Array.from(range.getClientRects()));
  }

  return mergeLineRects(raw).map((r) => ({
    x: (r.left - wrapperRect.left) / wrapperRect.width,
    y: (r.top - wrapperRect.top) / wrapperRect.height,
    width: r.width / wrapperRect.width,
    height: r.height / wrapperRect.height,
  }));
}
