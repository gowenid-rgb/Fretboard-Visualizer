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
 * Traces exactly `notesPerString` consecutive formula degrees per string,
 * finding the nearest eligible fret on the next string to form realistic
 * diagonal box shapes rather than clipping to a rigid vertical floor.
 */
function buildStrictBox(degree, anchor, pitchClasses, rootPc, notesPerString, perString) {
  const notes = [];
  let prevStringStartFret = anchor;

  for (let s = 0; s < NUM_STRINGS; s++) {
    const stringDegrees = [];
    for (let n = 0; n < notesPerString; n++) {
      stringDegrees.push((degree + s * notesPerString + n) % pitchClasses.length);
    }

    let firstFret = -1;
    let minDiff = Infinity;
    const firstPc = pitchClasses[stringDegrees[0]];
    
    for (const f of perString[s]) {
      if (noteAt(s, f) === firstPc) {
        const diff = Math.abs(f - prevStringStartFret);
        if (diff < minDiff) {
          minDiff = diff;
          firstFret = f;
        }
      }
    }

    if (firstFret === -1) return null;

    const stringNotes = [{ string: s, fret: firstFret, isRoot: firstPc === rootPc }];
    let lastFret = firstFret;

    for (let n = 1; n < notesPerString; n++) {
      const pc = pitchClasses[stringDegrees[n]];
      let nextFret = -1;
      for (const f of perString[s]) {
        if (f > lastFret && noteAt(s, f) === pc) {
          nextFret = f;
          break;
        }
      }
      if (nextFret === -1) return null;
      stringNotes.push({ string: s, fret: nextFret, isRoot: pc === rootPc });
      lastFret = nextFret;
    }

    notes.push(...stringNotes);
    prevStringStartFret = firstFret;
  }
  return notes;
}



/**
 * 7 positions, one per scale degree, in strictly ascending neck order.
 * Position N starts on the Nth scale degree (Position 1 = root), matching
 * the "position 2 starts one note above the root" convention from the spec.
 * Used for 7-note scales/modes, which build clean 3-notes-per-string boxes.
 * Pentatonic scales use generatePentatonicPositions instead — a generic
 * "walk the fretboard" algorithm doesn't reproduce the specific hand-shapes
 * players actually use for pentatonic boxes.
 */
export function generateScalePositions(rootPc, formula) {
  const pitchClasses = formulaToPitchClasses(rootPc, formula);
  const perString = eligibleFretsPerString(pitchClasses);
  const positions = [];
  let prevAnchor = -1;
  for (let degree = 0; degree < formula.length; degree++) {
    const pc = pitchClasses[degree];
    const anchor = nextAnchor(perString[0], pc, prevAnchor);
    if (anchor === null) break;
    
    const notes = buildStrictBox(degree, anchor, pitchClasses, rootPc, 3, perString);
    if (notes === null) break;

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
 * Cycles anchors through the formula's own degrees (root, then the next
 * degree, wrapping and climbing the neck), building a 2-notes-per-string
 * box at each anchor via the same fixed-anchor walkBox used elsewhere.
 * Because the anchor is always the fixed floor for every string, root is
 * guaranteed to be the box's lowest note whenever a position's anchor
 * degree is the root — this is what gives pentatonic Position 1 the
 * classic "root leads on every string that plays it" shape (e.g. both E
 * strings at fret 5 for A minor pentatonic — verified directly against a
 * published fingering chart) without needing any hand-authored shape
 * table: it falls out of the anchor algorithm applied to the scale's own
 * formula, independently, for whichever root and quality is selected.
 * Stops after `maxPositions` or when a box would run off the fretboard.
 */
function generateCyclicBoxPositions(rootPc, formula, maxPositions) {
  const pitchClasses = formulaToPitchClasses(rootPc, formula);
  const perString = eligibleFretsPerString(pitchClasses);
  const positions = [];
  let prevAnchor = -1;
  let degree = 0;
  for (let i = 0; i < maxPositions; i++) {
    const pc = pitchClasses[degree % formula.length];
    const anchor = nextAnchor(perString[0], pc, prevAnchor);
    if (anchor === null) break;
    const notes = buildStrictBox(degree % formula.length, anchor, pitchClasses, rootPc, 2, perString);
    if (notes === null) break;
    positions.push({
      label: `Position ${positions.length + 1} (starts on ${INTERVAL_NAMES[formula[degree % formula.length]]})`,
      startFret: anchor,
      notes,
    });
    prevAnchor = anchor;
    degree++;
  }
  return { positions, perString };
}

/**
 * Exactly 5 positions (the standard pentatonic "5 shapes" convention),
 * generated independently for whichever root/quality is selected — not
 * derived from a relative key. This guarantees Major and Minor Pentatonic
 * each get their own root-leading Position 1 (root can't be the same note
 * for both unless the roots themselves match, so their absolute fret
 * ranges naturally differ — as they must, since e.g. C Major Pentatonic
 * and C Minor Pentatonic share only the root and 5th).
 */
export function generatePentatonicPositions(rootPc, formula) {
  return generateCyclicBoxPositions(rootPc, formula, 5).positions;
}

/**
 * Cyclic positions through the chord tones (2 notes/string cap), continuing
 * past one lap of the formula until the fretboard runs out. For a 4-note
 * 7th-chord arpeggio this naturally yields several positions, matching the
 * "7 Position System" shown in the reference chart.
 */
export function generateArpeggioPositions(rootPc, formula) {
  // Safety cap of 24 iterations so a malformed formula can't spin forever.
  const { positions, perString } = generateCyclicBoxPositions(rootPc, formula, 24);

  // Highly symmetric qualities (e.g. augmented triads only have 4 distinct
  // pitch-class sets total) can anchor root position so high up the neck
  // that no full 2-note-per-string box fits at all. Rather than leave the
  // quality with zero usable positions, fall back to a 1-note-per-string
  // reading of the same anchor so there's always at least one honest,
  // root-anchored position to show.
  if (positions.length === 0) {
    const rootAnchor = nextAnchor(perString[0], rootPc, -1);
    if (rootAnchor !== null) {
      const notes = buildStrictBox(0, rootAnchor, pitchClasses, rootPc, 1, perString);
      if (notes !== null) {
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
