import type { SwordParams } from '../three/SwordGenerator';

type UIHelpers = {
  addGroup: (parent: HTMLElement, title: string) => HTMLElement;
  slider: (
    parent: HTMLElement,
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
    onChange: (v: number) => void,
    rerender: () => void,
    tooltip?: string,
    fieldOverride?: string
  ) => any;
};

type GoalSlidersOpts = {
  container: HTMLElement;
  state: SwordParams;
  helpers: UIHelpers;
  rerender: () => void;
  syncUi: () => void;
};

// Linearly interpolate between two values based on t in [0, 1]
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Inverse lerp: given value in [a, b] range, return t in [0, 1]
const invLerp = (a: number, b: number, v: number) =>
  Math.abs(b - a) < 1e-10 ? 0.5 : Math.max(0, Math.min(1, (v - a) / (b - a)));

// Each goal slider maps to a set of parameter fields with [min, max] ranges.
// The slider value t goes from 0 (left label) to 1 (right label).

type ParamMapping = {
  get: (s: SwordParams) => number;
  set: (s: SwordParams, v: number) => void;
  range: [number, number]; // [value at t=0, value at t=1]
  weight?: number; // importance weight for inverse computation (default 1)
};

// Cut (0) ↔ Thrust (1)
// Cut-optimized: wide, curved blade with more mass forward
// Thrust-optimized: narrow, straight blade with point emphasis
const cutThrustMappings: ParamMapping[] = [
  {
    get: (s) => s.blade.baseWidth,
    set: (s, v) => (s.blade.baseWidth = v),
    range: [0.35, 0.12], // wide for cut, narrow for thrust
    weight: 2,
  },
  {
    get: (s) => s.blade.tipWidth,
    set: (s, v) => (s.blade.tipWidth = v),
    range: [0.12, 0.02], // wider tip for cut, sharper for thrust
    weight: 1.5,
  },
  {
    get: (s) => s.blade.curvature,
    set: (s, v) => (s.blade.curvature = v),
    range: [0.25, 0.0], // curved for cut, straight for thrust
    weight: 2,
  },
  {
    get: (s) => s.blade.length,
    set: (s, v) => (s.blade.length = v),
    range: [2.5, 3.5], // shorter/wider for cut, longer for thrust
    weight: 1,
  },
  {
    get: (s) => s.blade.tipBulge ?? 0.2,
    set: (s, v) => (s.blade.tipBulge = v),
    range: [0.4, 0.1], // bulgy tip for cut, sleek for thrust
    weight: 0.8,
  },
];

// Agility (0) ↔ Authority (1)
// Agile: light, thin blade, short handle
// Authoritative: thick, heavy blade, long handle, massive guard
const agilityAuthorityMappings: ParamMapping[] = [
  {
    get: (s) => s.blade.thickness,
    set: (s, v) => (s.blade.thickness = v),
    range: [0.04, 0.12], // thin for agility, thick for authority
    weight: 2,
  },
  {
    get: (s) => s.blade.length,
    set: (s, v) => (s.blade.length = v),
    range: [2.0, 4.5], // short for agility, long for authority
    weight: 1.5,
  },
  {
    get: (s) => s.guard.width,
    set: (s, v) => (s.guard.width = v),
    range: [0.6, 2.0], // small guard for agility, large for authority
    weight: 1.5,
  },
  {
    get: (s) => s.guard.thickness,
    set: (s, v) => (s.guard.thickness = v),
    range: [0.1, 0.35], // thin guard for agility, thick for authority
    weight: 1,
  },
  {
    get: (s) => s.handle.length,
    set: (s, v) => (s.handle.length = v),
    range: [0.6, 1.5], // short handle for agility, long for authority
    weight: 1,
  },
  {
    get: (s) => s.pommel.size,
    set: (s, v) => (s.pommel.size = v),
    range: [0.1, 0.24], // small pommel for agility, large for authority
    weight: 0.8,
  },
];

// Elegant (0) ↔ Brutal (1)
// Elegant: refined proportions, fullers, gentle curves, orb pommel
// Brutal: thick, blunt, serrated, crude shapes
const elegantBrutalMappings: ParamMapping[] = [
  {
    get: (s) => s.blade.serrationAmplitude ?? 0,
    set: (s, v) => {
      s.blade.serrationAmplitude = v;
      if (v > 0.002 && (!s.blade.serrationFrequency || s.blade.serrationFrequency < 4)) {
        s.blade.serrationFrequency = 12;
      }
    },
    range: [0.0, 0.025], // no serration for elegant, aggressive for brutal
    weight: 2,
  },
  {
    get: (s) => (s.blade.fullerEnabled ? s.blade.fullerDepth : 0),
    set: (s, v) => {
      if (v > 0.005) {
        s.blade.fullerEnabled = true;
        s.blade.fullerDepth = v;
        if (!s.blade.fullerLength) s.blade.fullerLength = 0.7;
      } else {
        s.blade.fullerEnabled = false;
        s.blade.fullerDepth = 0;
      }
    },
    range: [0.025, 0.0], // fullers for elegant, none for brutal
    weight: 1.5,
  },
  {
    get: (s) => s.blade.thickness,
    set: (s, v) => (s.blade.thickness = v),
    range: [0.05, 0.12], // thin and refined vs thick and heavy
    weight: 1,
  },
  {
    get: (s) => s.guard.curve ?? 0,
    set: (s, v) => (s.guard.curve = v),
    range: [0.4, 0.05], // elegant curved guard vs flat brutal guard
    weight: 1,
  },
  {
    get: (s) => s.pommel.shapeMorph ?? 0.2,
    set: (s, v) => (s.pommel.shapeMorph = v),
    range: [0.15, 0.6], // smooth orb vs angular
    weight: 0.8,
  },
];

// Compute slider value (0-1) from current state by inverse-mapping
function computeSliderValue(state: SwordParams, mappings: ParamMapping[]): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const m of mappings) {
    const current = m.get(state);
    const t = invLerp(m.range[0], m.range[1], current);
    const w = m.weight ?? 1;
    weightedSum += t * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
}

// Apply slider value to all mapped parameters
function applySliderValue(state: SwordParams, mappings: ParamMapping[], t: number) {
  for (const m of mappings) {
    const v = lerp(m.range[0], m.range[1], t);
    m.set(state, v);
  }
}

export function attachGoalSliders(opts: GoalSlidersOpts) {
  const { container, state, helpers, rerender, syncUi } = opts;
  const { addGroup, slider: makeSlider } = helpers;

  const group = addGroup(container, 'Character');

  // Track slider elements for bidirectional sync
  const sliderEls: Array<{ input: HTMLInputElement; compute: () => number }> = [];

  const syncFromState = () => {
    for (const { input, compute } of sliderEls) {
      const v = compute();
      input.value = String(v);
      // Update displayed value label if present
      const row = input.closest('.control-row');
      const valLabel = row?.querySelector('.value') as HTMLSpanElement | null;
      if (valLabel) valLabel.textContent = v.toFixed(2);
    }
  };

  const makeGoalSlider = (
    label: string,
    leftLabel: string,
    rightLabel: string,
    mappings: ParamMapping[],
    tooltip: string
  ) => {
    const initial = computeSliderValue(state, mappings);
    const el = makeSlider(
      group,
      label,
      0,
      1,
      0.01,
      initial,
      (v: number) => {
        applySliderValue(state, mappings, v);
      },
      () => {
        rerender();
        // After the rerender flush, sync all other goal sliders
        requestAnimationFrame(() => {
          syncFromState();
          syncUi();
        });
      },
      tooltip,
      `goal-${label.toLowerCase().replace(/\s+/g, '-')}`
    );

    // Add left/right labels around the slider
    const row = el?.closest?.('.control-row') ?? el;
    if (row) {
      const rangeWrap = row.querySelector('.range-wrap') ?? row.querySelector('input[type="range"]')?.parentElement;
      if (rangeWrap) {
        const left = document.createElement('span');
        left.className = 'goal-label goal-label-left';
        left.textContent = leftLabel;
        const right = document.createElement('span');
        right.className = 'goal-label goal-label-right';
        right.textContent = rightLabel;
        rangeWrap.insertBefore(left, rangeWrap.firstChild);
        rangeWrap.appendChild(right);
      }
    }

    // Find the input element for syncing
    const input = (row?.querySelector?.('input[type="range"]') ?? null) as HTMLInputElement | null;
    if (input) {
      sliderEls.push({ input, compute: () => computeSliderValue(state, mappings) });
    }
  };

  makeGoalSlider(
    'Cut ↔ Thrust',
    'Cut',
    'Thrust',
    cutThrustMappings,
    'Bias toward cutting (wide, curved) or thrusting (narrow, straight).'
  );

  makeGoalSlider(
    'Agility ↔ Authority',
    'Agile',
    'Heavy',
    agilityAuthorityMappings,
    'Bias toward a light, fast blade or a heavy, imposing one.'
  );

  makeGoalSlider(
    'Elegant ↔ Brutal',
    'Refined',
    'Brutal',
    elegantBrutalMappings,
    'Bias toward refined elegance or crude brutality.'
  );

  // Return a sync function the parent can call when state changes externally
  return { syncFromState };
}
