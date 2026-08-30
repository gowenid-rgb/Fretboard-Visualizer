// Core music-theory data: note names, tuning, and interval formulas.
// Everything downstream (pattern-generator.js) derives fret positions
// from these formulas, so any root/quality combination "just works".

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Standard tuning, string 6 (low E) to string 1 (high E), as pitch classes.
export const STANDARD_TUNING = [
  NOTE_NAMES.indexOf('E'),
  NOTE_NAMES.indexOf('A'),
  NOTE_NAMES.indexOf('D'),
  NOTE_NAMES.indexOf('G'),
  NOTE_NAMES.indexOf('B'),
  NOTE_NAMES.indexOf('E'),
];

export const NUM_STRINGS = STANDARD_TUNING.length;
// 24 frets gives enough room for all 7 diatonic 3NPS positions and the
// cyclic arpeggio positions to fully resolve for every root note.
export const FRET_COUNT = 24;

export const SCALE_FORMULAS = {
  'Major (Ionian)': [0, 2, 4, 5, 7, 9, 11],
  'Dorian': [0, 2, 3, 5, 7, 9, 10],
  'Phrygian': [0, 1, 3, 5, 7, 8, 10],
  'Lydian': [0, 2, 4, 6, 7, 9, 11],
  'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'Aeolian (Natural Minor)': [0, 2, 3, 5, 7, 8, 10],
  'Locrian': [0, 1, 3, 5, 6, 8, 10],
  'Major Pentatonic': [0, 2, 4, 7, 9],
  'Minor Pentatonic': [0, 3, 5, 7, 10],
};

export const ARPEGGIO_FORMULAS = {
  'Major 7': [0, 4, 7, 11],
  'Dominant 7': [0, 4, 7, 10],
  'Minor 7': [0, 3, 7, 10],
  'Minor 7b5': [0, 3, 6, 10],
  'Diminished 7': [0, 3, 6, 9],
  'Major Triad': [0, 4, 7],
  'Minor Triad': [0, 3, 7],
  'Augmented Triad': [0, 4, 8],
  'Diminished Triad': [0, 3, 6],
};

// Chords reuse the same interval sets as arpeggios (same tones, different
// on-neck grouping strategy in pattern-generator.js).
export const CHORD_FORMULAS = ARPEGGIO_FORMULAS;

export const DEGREE_LABELS = {
  0: 'R', 1: 'b2', 2: '2', 3: 'b3', 4: '3', 5: '4',
  6: 'b5', 7: '5', 8: 'b6', 9: '6', 10: 'b7', 11: '7',
};

/** Pitch class (0-11) sounding on a given string index (0=low E..5=high E) and fret. */
export function noteAt(stringIndex, fret) {
  return (STANDARD_TUNING[stringIndex] + fret) % 12;
}

/** Pitch classes belonging to a root + interval formula. */
export function formulaToPitchClasses(rootPc, formula) {
  return formula.map((interval) => (rootPc + interval) % 12);
}
