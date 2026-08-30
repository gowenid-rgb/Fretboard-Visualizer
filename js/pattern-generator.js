// Turns (root, quality, position) into concrete fret-dot data.
// All positions are derived algorithmically from interval formulas so any
// root/quality combination works without hand-authored shape data.

import {
  NUM_STRINGS,
  FRET_COUNT,
  noteAt,
  formulaToPitchClasses,
} from './music-theory.js';

const INTERVAL_NAMES = {
  0: 'Root', 1: 'b2', 2: '2nd', 3: 'b3', 4: '3rd', 5: '4th',
  6: 'b5', 7: '5th', 8: 'b6/#5', 9: '6th', 10: 'b7', 11: '7th',
};

/** Every fret (0..FRET_COUNT) per string whose note is one of pitchClasses. */
function eligibleFretsPerString(pitchClasses) {
  const pcSet = new Set(pitchClasses);
  const perString = [];
  for (let s = 0; s < NUM_STRINGS; s++) {
    const frets = [];
    for (let f = 0; f <= FRET_COUNT; f++) {
      if (pcSet.has(noteAt(s, f))) frets.push(f);
    }
    perString.push(frets);
  }
  return perString;
}

/** Smallest fret > afterFret (inclusive of 0 when afterFret is -1) on string 0 matching pc. */
function nextAnchor(perString0, pc, afterFret) {
  for (const f of perString0) {
    if (f > afterFret && noteAt(0, f) === pc) return f;
  }
  return null;
}

/**
 * For every string, independently take up to `cap` of that string's
 * eligible frets at-or-above the anchor fret. Using the same fixed anchor
 * for every string (rather than cascading it forward string-by-string)
 * guarantees two things at once: no note anywhere in the shape sits below
 * the anchor — so "Position N starts on the Nth degree" is literally true
 * — and each string independently grabs its nearest eligible notes, which
 * keeps the shape as tight as the scale's own note spacing allows instead
 * of compounding drift when the anchor's exact fret isn't itself eligible
 * on a later string (the failure mode that made sparser scales like
 * pentatonics balloon into unrealistically wide, non-CAGED-sized boxes).
 */
function walkBox(perString, anchor, cap, rootPc) {
  const notes = [];
  for (let s = 0; s < NUM_STRINGS; s++) {
    const candidates = perString[s].filter((f) => f >= anchor);
    const picked = candidates.slice(0, cap);
    for (const f of picked) {
      notes.push({ string: s, fret: f, isRoot: noteAt(s, f) === rootPc });
    }
  }
  return notes;
}

/** True if every string got its full complement of notes (box wasn't cut off by the edge of the fretboard). */
function isCompleteBox(notes, cap) {
  const perStringCount = new Array(NUM_STRINGS).fill(0);
  for (const n of notes) perStringCount[n.string]++;
  return perStringCount.every((count) => count === cap);
}

/**
 * 7 positions, one per scale degree, in strictly ascending neck order.
 * Position N starts on the Nth scale degree (Position 1 = root), matching
 * the "position 2 starts one note above the root" convention from the spec.
 *
 * `notesPerString` defaults to 3 (3NPS boxes, used for 7-note scales/modes).
 * Pentatonic scales pass 2 to produce CAGED-style 2-note-per-string boxes
 * instead (5 positions rather than 7, matching the CAGED reference chart).
 */
export function generateScalePositions(rootPc, formula, notesPerString = 3) {
  const pitchClasses = formulaToPitchClasses(rootPc, formula);
  const perString = eligibleFretsPerString(pitchClasses);
  const positions = [];
  let prevAnchor = -1;
  for (let degree = 0; degree < formula.length; degree++) {
    const pc = pitchClasses[degree];
    const anchor = nextAnchor(perString[0], pc, prevAnchor);
    if (anchor === null) break;
    const notes = walkBox(perString, anchor, notesPerString, rootPc);
    // Once a box runs off the edge of the fretboard, every later (higher)
    // position would too — stop rather than show a half-cut-off shape.
    if (!isCompleteBox(notes, notesPerString)) break;
    positions.push({
      label: `Position ${positions.length + 1} (starts on ${INTERVAL_NAMES[formula[degree]]})`,
      startFret: anchor,
      notes,
    });
    prevAnchor = anchor;
  }
  return positions;
}

/**
 * Cyclic positions through the chord tones (2 notes/string cap), continuing
 * past one lap of the formula until the fretboard runs out. For a 4-note
 * 7th-chord arpeggio this naturally yields several positions, matching the
 * "7 Position System" shown in the reference chart.
 */
export function generateArpeggioPositions(rootPc, formula) {
  const pitchClasses = formulaToPitchClasses(rootPc, formula);
  const perString = eligibleFretsPerString(pitchClasses);
  const positions = [];
  let prevAnchor = -1;
  let degree = 0;
  // Safety cap so a malformed formula can't spin forever.
  for (let i = 0; i < 24; i++) {
    const pc = pitchClasses[degree % formula.length];
    const anchor = nextAnchor(perString[0], pc, prevAnchor);
    if (anchor === null) break;
    const notes = walkBox(perString, anchor, 2, rootPc);
    if (!isCompleteBox(notes, 2)) break;
    positions.push({
      label: `Position ${positions.length + 1} (starts on ${INTERVAL_NAMES[formula[degree % formula.length]]})`,
      startFret: anchor,
      notes,
    });
    prevAnchor = anchor;
    degree++;
  }

  // Highly symmetric qualities (e.g. augmented triads only have 4 distinct
  // pitch-class sets total) can anchor root position so high up the neck
  // that no full 2-note-per-string box fits at all. Rather than leave the
  // quality with zero usable positions, fall back to a 1-note-per-string
  // reading of the same anchor so there's always at least one honest,
  // root-anchored position to show.
  if (positions.length === 0) {
    const rootAnchor = nextAnchor(perString[0], rootPc, -1);
    if (rootAnchor !== null) {
      const notes = walkBox(perString, rootAnchor, 1, rootPc);
      if (isCompleteBox(notes, 1)) {
        positions.push({ label: 'Position 1 (starts on Root)', startFret: rootAnchor, notes });
      }
    }
  }

  return positions;
}

const INVERSION_NAMES = ['Root Position', '1st Inversion', '2nd Inversion', '3rd Inversion'];

/**
 * Slides a small fret window across the neck; within each window picks the
 * lowest eligible fret per string (muting strings with none) to form a
 * compact, playable chord grip. Voicings are labeled by inversion (which
 * chord tone sits in the bass).
 */
export function generateChordVoicings(rootPc, formula) {
  const pitchClasses = formulaToPitchClasses(rootPc, formula);
  const perString = eligibleFretsPerString(pitchClasses);
  const WINDOW = 4;
  const minTones = Math.min(3, pitchClasses.length);
  const raw = [];

  for (let w = 0; w <= FRET_COUNT - WINDOW; w++) {
    const strings = perString.map((frets) => {
      const inWindow = frets.filter((f) => f >= w && f <= w + WINDOW);
      return inWindow.length > 0 ? inWindow[0] : null;
    });
    const playedStrings = strings.filter((f) => f !== null).length;
    const tonesUsed = new Set(
      strings.map((f, s) => (f !== null ? noteAt(s, f) : null)).filter((pc) => pc !== null)
    );
    if (playedStrings < 4 || tonesUsed.size < minTones || !tonesUsed.has(rootPc)) continue;

    const bassStringIndex = strings.findIndex((f) => f !== null);
    const bassPc = noteAt(bassStringIndex, strings[bassStringIndex]);
    const bassDegreeIndex = pitchClasses.indexOf(bassPc);
    const inversionLabel = INVERSION_NAMES[bassDegreeIndex] ?? `${INTERVAL_NAMES[(bassPc - rootPc + 12) % 12]} in bass`;

    raw.push({ startFret: w, strings, inversionLabel });
  }

  // Collapse consecutive windows that produced the identical shape.
  const deduped = [];
  for (const v of raw) {
    const prev = deduped[deduped.length - 1];
    if (prev && JSON.stringify(prev.strings) === JSON.stringify(v.strings)) continue;
    deduped.push(v);
  }

  return deduped.map((v, i) => ({
    label: `Voicing ${i + 1} — ${v.inversionLabel} (fret ${v.startFret})`,
    startFret: v.startFret,
    notes: v.strings
      .map((f, s) => (f === null ? null : { string: s, fret: f, isRoot: noteAt(s, f) === rootPc }))
      .filter((n) => n !== null),
  }));
}
