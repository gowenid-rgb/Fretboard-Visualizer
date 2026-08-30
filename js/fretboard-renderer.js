// Draws the long horizontal fretboard and renders overlay note dots onto it.

import { NUM_STRINGS, FRET_COUNT, NOTE_NAMES, noteAt } from './music-theory.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const FRET_WIDTH = 46;
const STRING_GAP = 34;
const MARGIN_LEFT = 46;
const MARGIN_TOP = 24;
const MARGIN_BOTTOM = 26;
const MARGIN_RIGHT = 20;

const SINGLE_INLAYS = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
const DOUBLE_INLAYS = new Set([12]);

const NOTE_RADIUS = 10;
const ROOT_COLOR = '#a5352a';
const PAPER = '#f6f2e4';
const INK = '#21242c';

function el(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function fretX(fret) {
  if (fret === 0) return MARGIN_LEFT - 16;
  return MARGIN_LEFT + fret * FRET_WIDTH - FRET_WIDTH / 2;
}

function stringY(stringIndex) {
  return MARGIN_TOP + stringIndex * STRING_GAP;
}

/** Builds the static fretboard (strings/frets/inlays) inside `container` and returns handles for rendering overlays. */
export function initFretboard(container) {
  const width = MARGIN_LEFT + FRET_COUNT * FRET_WIDTH + MARGIN_RIGHT;
  const height = MARGIN_TOP + (NUM_STRINGS - 1) * STRING_GAP + MARGIN_BOTTOM;

  const svg = el('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width: '100%',
    role: 'img',
    'aria-label': 'Guitar fretboard',
  });
  svg.classList.add('fretboard-svg');

  const boardTop = stringY(0);
  const boardBottom = stringY(NUM_STRINGS - 1);

  // Inlay markers (drawn first, underneath everything).
  for (let f = 1; f <= FRET_COUNT; f++) {
    const x = fretX(f);
    if (DOUBLE_INLAYS.has(f)) {
      svg.appendChild(el('circle', { cx: x, cy: (boardTop + boardBottom) / 2 - STRING_GAP, r: 5, class: 'inlay' }));
      svg.appendChild(el('circle', { cx: x, cy: (boardTop + boardBottom) / 2 + STRING_GAP, r: 5, class: 'inlay' }));
    } else if (SINGLE_INLAYS.has(f)) {
      svg.appendChild(el('circle', { cx: x, cy: (boardTop + boardBottom) / 2, r: 5, class: 'inlay' }));
    }
  }

  // Strings (horizontal), thicker for lower strings.
  for (let s = 0; s < NUM_STRINGS; s++) {
    const y = stringY(s);
    svg.appendChild(
      el('line', {
        x1: MARGIN_LEFT - 26,
        y1: y,
        x2: width - MARGIN_RIGHT,
        y2: y,
        class: 'string-line',
        'stroke-width': 1 + (NUM_STRINGS - s) * 0.25,
      })
    );
  }

  // Frets (vertical), fret 0 is the thick nut.
  for (let f = 0; f <= FRET_COUNT; f++) {
    const x = MARGIN_LEFT + f * FRET_WIDTH;
    svg.appendChild(
      el('line', {
        x1: x,
        y1: boardTop,
        x2: x,
        y2: boardBottom,
        class: f === 0 ? 'nut-line' : 'fret-line',
      })
    );
  }

  // Fret number labels.
  for (let f = 1; f <= FRET_COUNT; f++) {
    if (!SINGLE_INLAYS.has(f) && !DOUBLE_INLAYS.has(f)) continue;
    const label = el('text', {
      x: fretX(f),
      y: boardBottom + 18,
      class: 'fret-label',
      'text-anchor': 'middle',
    });
    label.textContent = String(f);
    svg.appendChild(label);
  }

  const noteLayer = el('g', { class: 'note-layer' });
  svg.appendChild(noteLayer);

  container.innerHTML = '';
  container.appendChild(svg);

  return { svg, noteLayer };
}

/**
 * Renders every active overlay's notes onto the board as hollow,
 * ink-outlined noteheads (paper-colored fill, overlay-colored stroke) —
 * a root note is always a solid red disc regardless of overlay color. A
 * note shared by multiple overlays draws one concentric ring per overlay
 * so every contributor stays visible.
 */
export function renderOverlays(board, overlays) {
  board.noteLayer.innerHTML = '';

  // Group notes by string/fret so overlapping overlays share one marker.
  const byPosition = new Map();
  for (const overlay of overlays) {
    for (const note of overlay.notes) {
      const key = `${note.string}:${note.fret}`;
      if (!byPosition.has(key)) byPosition.set(key, []);
      byPosition.get(key).push({ ...note, color: overlay.color });
    }
  }

  for (const [key, entries] of byPosition) {
    const [stringIndex, fret] = key.split(':').map(Number);
    const cx = fretX(fret);
    const cy = stringY(stringIndex);
    const pc = noteAt(stringIndex, fret);
    const noteName = NOTE_NAMES[pc];

    if (entries.length === 1 && entries[0].isRoot) {
      board.noteLayer.appendChild(
        el('circle', { cx, cy, r: NOTE_RADIUS, fill: ROOT_COLOR, stroke: ROOT_COLOR, 'stroke-width': 1.5 })
      );
    } else {
      board.noteLayer.appendChild(el('circle', { cx, cy, r: NOTE_RADIUS, fill: PAPER, stroke: 'none' }));
      entries.forEach((entry, i) => {
        const r = Math.max(NOTE_RADIUS - i * 3, 3);
        board.noteLayer.appendChild(
          el('circle', {
            cx,
            cy,
            r,
            fill: 'none',
            stroke: entry.isRoot ? ROOT_COLOR : entry.color,
            'stroke-width': 1.5,
          })
        );
      });
    }

    const textColor = entries.length === 1 && entries[0].isRoot ? PAPER : INK;
    const text = el('text', { x: cx, y: cy + 4, class: 'note-text', fill: textColor, 'text-anchor': 'middle' });
    text.textContent = noteName;
    board.noteLayer.appendChild(text);
  }
}
