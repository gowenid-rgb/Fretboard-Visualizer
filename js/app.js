import { NOTE_NAMES, SCALE_FORMULAS, ARPEGGIO_FORMULAS, CHORD_FORMULAS } from './music-theory.js';
import { generateScalePositions, generateArpeggioPositions, generateChordVoicings } from './pattern-generator.js';
import { initFretboard, renderOverlays } from './fretboard-renderer.js';

const FORMULA_SETS = {
  scale: SCALE_FORMULAS,
  arpeggio: ARPEGGIO_FORMULAS,
  chord: CHORD_FORMULAS,
};

const GENERATORS = {
  scale: generateScalePositions,
  arpeggio: generateArpeggioPositions,
  chord: generateChordVoicings,
};

// Muted inks (as if marked in different colored pencils on the page) —
// root notes always render in the fixed manuscript red regardless of
// which of these an overlay is assigned.
const OVERLAY_COLORS = ['#3a5a6b', '#8a6d3f', '#5c3a5c', '#3f5d43', '#a15c2e', '#556070', '#7a3b4a'];

// Pentatonic scales use CAGED-style 2-note-per-string boxes instead of 3NPS.
const CAGED_SCALES = new Set(['Major Pentatonic', 'Minor Pentatonic']);

const rootSelect = document.getElementById('root-select');
const typeSelect = document.getElementById('type-select');
const qualitySelect = document.getElementById('quality-select');
const positionSelect = document.getElementById('position-select');
const addBtn = document.getElementById('add-overlay-btn');
const clearBtn = document.getElementById('clear-btn');
const chipsContainer = document.getElementById('overlay-chips');
const fretboardContainer = document.getElementById('fretboard-container');

const board = initFretboard(fretboardContainer);

/** @type {{id:number, label:string, color:string, notes:object[]}[]} */
const overlays = [];
let nextOverlayId = 1;
let currentPositions = [];

function populateRoots() {
  rootSelect.innerHTML = NOTE_NAMES.map((n, i) => `<option value="${i}">${n}</option>`).join('');
}

function populateQualities() {
  const formulas = FORMULA_SETS[typeSelect.value];
  qualitySelect.innerHTML = Object.keys(formulas)
    .map((name) => `<option value="${name}">${name}</option>`)
    .join('');
}

function populatePositions() {
  const rootPc = Number(rootSelect.value);
  const formulas = FORMULA_SETS[typeSelect.value];
  const formula = formulas[qualitySelect.value];
  const generate = GENERATORS[typeSelect.value];
  currentPositions =
    typeSelect.value === 'scale' && CAGED_SCALES.has(qualitySelect.value)
      ? generate(rootPc, formula, 2)
      : generate(rootPc, formula);

  if (currentPositions.length === 0) {
    positionSelect.innerHTML = '<option value="">No positions available</option>';
    return;
  }
  positionSelect.innerHTML = currentPositions
    .map((p, i) => `<option value="${i}">${p.label}</option>`)
    .join('');
}

function nextColor() {
  return OVERLAY_COLORS[overlays.length % OVERLAY_COLORS.length];
}

function renderChips() {
  chipsContainer.innerHTML = overlays
    .map(
      (o) => `
      <span class="chip" data-id="${o.id}">
        <span class="swatch" style="background:${o.color}"></span>
        ${o.label}
        <button type="button" data-remove="${o.id}" aria-label="Remove overlay">✕</button>
      </span>`
    )
    .join('');
}

function render() {
  renderOverlays(board, overlays);
  renderChips();
}

typeSelect.addEventListener('change', () => {
  populateQualities();
  populatePositions();
});

qualitySelect.addEventListener('change', populatePositions);
rootSelect.addEventListener('change', populatePositions);

addBtn.addEventListener('click', () => {
  const idx = Number(positionSelect.value);
  const position = currentPositions[idx];
  if (!position) return;

  const rootName = NOTE_NAMES[Number(rootSelect.value)];
  overlays.push({
    id: nextOverlayId++,
    label: `${rootName} ${qualitySelect.value} — ${position.label}`,
    color: nextColor(),
    notes: position.notes,
  });
  render();
});

clearBtn.addEventListener('click', () => {
  overlays.length = 0;
  render();
});

chipsContainer.addEventListener('click', (e) => {
  const id = e.target.getAttribute('data-remove');
  if (!id) return;
  const idx = overlays.findIndex((o) => o.id === Number(id));
  if (idx !== -1) overlays.splice(idx, 1);
  render();
});

populateRoots();
populateQualities();
populatePositions();
render();
