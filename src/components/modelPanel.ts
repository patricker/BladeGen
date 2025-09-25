import type { SwordParams } from '../three/SwordGenerator';

type UIHelpers = {
  addGroup: (parent: HTMLElement, title: string) => HTMLElement;
  addSubheading: (parent: HTMLElement, title: string) => HTMLElement;
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
  select: (
    parent: HTMLElement,
    label: string,
    options: string[],
    value: string,
    onChange: (v: string) => void,
    rerender: () => void,
    tooltip?: string,
    fieldOverride?: string
  ) => any;
  checkbox: (
    parent: HTMLElement,
    label: string,
    value: boolean,
    onChange: (v: boolean) => void,
    rerender: () => void,
    tooltip?: string,
    fieldOverride?: string
  ) => any;
  colorPicker: (
    parent: HTMLElement,
    label: string,
    value: string,
    onChange: (hex: string) => void,
    rerender: () => void,
    tooltip?: string,
    fieldOverride?: string
  ) => any;
  textRow: (
    parent: HTMLElement,
    label: string,
    value: string,
    onChange: (v: string) => void,
    tooltip?: string,
    fieldOverride?: string
  ) => any;
};

export type ModelSections = {
  Blade: HTMLElement;
  Guard: HTMLElement;
  Handle: HTMLElement;
  Pommel: HTMLElement;
  Accessories: HTMLElement;
};

export function attachModelPanel(opts: {
  sections: ModelSections;
  state: SwordParams;
  defaults: SwordParams;
  helpers: UIHelpers;
  rerender: () => void;
}) {
  const { sections, state, defaults, helpers, rerender } = opts;
  const { addGroup, addSubheading, slider, select, checkbox } = helpers;

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  // Blade helpers
  const ensureHollow = () => {
    if (!state.blade.hollowGrind) {
      state.blade.hollowGrind = {
        enabled: false,
        mix: 0.65,
        depth: 0.45,
        radius: 0.6,
        bias: 0,
      } as any;
    }
    return state.blade.hollowGrind as any;
  };
  const ensureFullerFaces = () => {
    if (!(state.blade as any).fullerFaces) {
      (state.blade as any).fullerFaces = { left: [], right: [] };
    }
    return (state.blade as any).fullerFaces as { left?: any[]; right?: any[] };
  };
  const cleanupFullerFaces = () => {
    const faces = (state.blade as any).fullerFaces as { left?: any[]; right?: any[] } | undefined;
    if (!faces) return;
    const prune = (side: 'left' | 'right') => {
      if (!faces[side]) return;
      faces[side] = faces[side]!.filter((slot) => !!slot);
      if (!faces[side]?.length) delete faces[side];
    };
    prune('left');
    prune('right');
    if (!faces.left && !faces.right) {
      delete (state.blade as any).fullerFaces;
      state.blade.fullerEnabled = false;
    }
  };
  const ensureFullerSlot = (side: 'left' | 'right', index: number) => {
    const faces = ensureFullerFaces();
    const arr = faces[side] ?? (faces[side] = []);
    if (!arr[index]) {
      const base = state.blade.baseWidth || defaults.blade.baseWidth;
      const defaultWidth =
        state.blade.fullerWidth && state.blade.fullerWidth > 0
          ? state.blade.fullerWidth
          : base * 0.3;
      const defaultOffset = (side === 'left' ? -1 : 1) * base * 0.12;
      arr[index] = { width: defaultWidth, offsetFromSpine: defaultOffset, taper: 0 };
    }
    return arr[index]!;
  };

  // Blade controls
  // Basic dimensions
  const bBasics = addGroup(sections.Blade, 'Length & Width');
  slider(
    bBasics,
    'Blade Length',
    0.3,
    6.0,
    0.01,
    state.blade.length,
    (v) => (state.blade.length = v),
    rerender,
    'Overall blade length along Y; longer shifts balance forward.'
  );
  slider(
    bBasics,
    'Base Width',
    0.02,
    0.6,
    0.001,
    state.blade.baseWidth,
    (v) => (state.blade.baseWidth = v),
    rerender,
    'Blade width near the guard (scene units).'
  );
  slider(
    bBasics,
    'Tip Width',
    0.0,
    0.5,
    0.001,
    state.blade.tipWidth,
    (v) => (state.blade.tipWidth = v),
    rerender,
    'Blade width at the tip (scene units).'
  );
  // Serrations
  const bSerr = addGroup(sections.Blade, 'Serrations');
  select(
    bSerr,
    'Serration Pattern',
    ['sine', 'saw', 'scallop', 'random'],
    (state.blade as any).serrationPattern ?? 'sine',
    (v) => {
      (state.blade as any).serrationPattern = v as any;
    },
    rerender,
    'Pattern used for serrations along edges.'
  );
  slider(
    bSerr,
    'Serration Seed',
    0,
    999999,
    1,
    (state.blade as any).serrationSeed ?? 1337,
    (v) => {
      (state.blade as any).serrationSeed = Math.round(v);
    },
    rerender,
    'Seed value for random serration pattern.'
  );

  // Fullers (and per-side layout)
  const bFuller = addGroup(sections.Blade, 'Fullers');
  select(
    bFuller,
    'Fuller Mode',
    ['none', 'overlay', 'carve'],
    (state.blade as any).fullerMode ?? 'overlay',
    (v) => {
      (state.blade as any).fullerMode = v as any;
      if (v === 'none') {
        state.blade.fullerEnabled = false;
        if ((state.blade as any).fullerFaces) delete (state.blade as any).fullerFaces;
        if ((state.blade as any).fullers) delete (state.blade as any).fullers;
      } else {
        state.blade.fullerEnabled = true;
      }
    },
    rerender,
    'none: disable; overlay: visual ribbons; carve: geometry reduces thickness.'
  );
  select(
    bFuller,
    'Fuller Profile',
    ['u', 'v', 'flat'],
    (state.blade as any).fullerProfile ?? 'u',
    (v) => {
      (state.blade as any).fullerProfile = v as any;
    },
    rerender,
    'Cross-section profile for carved fuller.'
  );
  slider(
    bFuller,
    'Fuller Width',
    0,
    0.6,
    0.001,
    (state.blade as any).fullerWidth ?? 0,
    (v) => {
      (state.blade as any).fullerWidth = v;
    },
    rerender,
    'Groove width across the blade face (scene units). 0 = auto.'
  );
  slider(
    bFuller,
    'Fuller Inset',
    0,
    0.2,
    0.001,
    (state.blade as any).fullerInset ?? state.blade.fullerDepth ?? 0,
    (v) => {
      (state.blade as any).fullerInset = v;
    },
    rerender,
    'Groove depth inside thickness when carving. Defaults to Fuller Depth.'
  );
  const fullerLayout = addSubheading(bFuller, 'Fuller Layout (Per Side)');
  const buildFullerControls = (side: 'left' | 'right', index: number) => {
    const labelPrefix = side === 'left' ? 'Left' : 'Right';
    const slot = (state.blade as any).fullerFaces?.[side]?.[index] ?? null;
    const enabled = !!slot;
    checkbox(
      fullerLayout,
      `${labelPrefix} Fuller ${index + 1}`,
      enabled,
      (v) => {
        const faces = ensureFullerFaces();
        const arr = faces[side] ?? (faces[side] = []);
        if (v) {
          ensureFullerSlot(side, index);
        } else {
          arr[index] = undefined as any;
          cleanupFullerFaces();
        }
      },
      rerender,
      'Enable this slot for the side'
    );
    const fldW = slider(
      fullerLayout,
      `${labelPrefix} F${index + 1} Width`,
      0,
      1,
      0.001,
      slot?.width ?? 0,
      (v) => {
        ensureFullerSlot(side, index).width = v;
      },
      rerender
    );
    const fldO = slider(
      fullerLayout,
      `${labelPrefix} F${index + 1} Offset`,
      -1,
      1,
      0.001,
      slot?.offsetFromSpine ?? 0,
      (v) => {
        ensureFullerSlot(side, index).offsetFromSpine = v;
      },
      rerender
    );
    const fldT = slider(
      fullerLayout,
      `${labelPrefix} F${index + 1} Taper`,
      0,
      1,
      0.001,
      slot?.taper ?? 0,
      (v) => {
        ensureFullerSlot(side, index).taper = v;
      },
      rerender
    );
    // Store field ids so other logic can sync by registry
    void fldW;
    void fldO;
    void fldT;
  };
  // Build up to three per side
  for (let i = 0; i < 3; i++) {
    buildFullerControls('left', i);
    buildFullerControls('right', i);
  }

  // Cross-section & Thickness
  const bXsec = addGroup(sections.Blade, 'Cross-section & Thickness');
  select(
    bXsec,
    'Cross-section',
    ['flat', 'lenticular', 'diamond', 'hexagonal', 'triangular', 'tSpine', 'compound'],
    (state.blade.crossSection ?? 'flat') as string,
    (v) => (state.blade.crossSection = v as any),
    rerender,
    'Transverse profile family.'
  );
  slider(
    bXsec,
    'Thickness',
    0.01,
    0.5,
    0.001,
    state.blade.thickness,
    (v) => (state.blade.thickness = v),
    rerender
  );
  slider(
    bXsec,
    'Left Thickness',
    0.003,
    0.5,
    0.001,
    state.blade.thicknessLeft ?? state.blade.thickness,
    (v) => (state.blade.thicknessLeft = v),
    rerender,
    'Per-edge Z thickness override (left).'
  );
  slider(
    bXsec,
    'Right Thickness',
    0.003,
    0.5,
    0.001,
    state.blade.thicknessRight ?? state.blade.thickness,
    (v) => (state.blade.thicknessRight = v),
    rerender,
    'Per-edge Z thickness override (right).'
  );
  slider(
    bXsec,
    'Bevel',
    0,
    1,
    0.01,
    state.blade.bevel ?? 0.5,
    (v) => (state.blade.bevel = v),
    rerender,
    'Cross-section sharpness control.'
  );

  // Hollow grind
  const bHollow = addGroup(sections.Blade, 'Hollow Grind');
  checkbox(
    bHollow,
    'Enable Hollow',
    ensureHollow().enabled,
    (v) => {
      ensureHollow().enabled = v;
    },
    rerender
  );
  slider(
    bHollow,
    'Hollow Mix',
    0,
    1,
    0.01,
    ensureHollow().mix,
    (v) => (ensureHollow().mix = v),
    rerender
  );
  slider(
    bHollow,
    'Hollow Depth',
    0,
    1,
    0.01,
    ensureHollow().depth,
    (v) => (ensureHollow().depth = v),
    rerender
  );
  slider(
    bHollow,
    'Hollow Radius',
    0.05,
    2.0,
    0.01,
    ensureHollow().radius,
    (v) => (ensureHollow().radius = v),
    rerender
  );
  slider(
    bHollow,
    'Hollow Bias',
    -1,
    1,
    0.01,
    ensureHollow().bias ?? 0,
    (v) => (ensureHollow().bias = v),
    rerender
  );

  // Thickness taper (use thicknessProfile for advanced; basic bevel provided above)

  // Ricasso & False Edge
  const bEdge = addGroup(sections.Blade, 'Ricasso & False Edge');
  slider(
    bEdge,
    'Ricasso Length',
    0,
    0.3,
    0.001,
    state.blade.ricassoLength ?? 0,
    (v) => (state.blade.ricassoLength = v),
    rerender
  );
  slider(
    bEdge,
    'False Edge %',
    0,
    100,
    1,
    Math.round((state.blade.falseEdgeLength ?? 0) * 100),
    (v) => (state.blade.falseEdgeLength = (v as number) / 100),
    rerender,
    'False edge (swedge) length fraction from the tip.'
  );
  slider(
    bEdge,
    'False Edge Depth',
    0,
    0.2,
    0.001,
    state.blade.falseEdgeDepth ?? 0,
    (v) => (state.blade.falseEdgeDepth = v),
    rerender,
    'Spine bevel reduction amount when false edge is active.'
  );

  // Curvature & Tip
  const bCurv = addGroup(sections.Blade, 'Curvature & Tip');
  slider(
    bCurv,
    'Curvature',
    -1,
    1,
    0.001,
    state.blade.curvature,
    (v) => (state.blade.curvature = v),
    rerender
  );
  select(
    bCurv,
    'Sori Profile',
    ['torii', 'koshi', 'saki'],
    (state.blade.soriProfile ?? 'torii') as string,
    (v) => (state.blade.soriProfile = v as any),
    rerender,
    'Curvature distribution along the blade.'
  );
  slider(
    bCurv,
    'Sori Bias',
    0.3,
    3.0,
    0.01,
    state.blade.soriBias ?? 0.8,
    (v) => (state.blade.soriBias = v),
    rerender
  );
  slider(
    bCurv,
    'Kissaki Length',
    0,
    0.35,
    0.005,
    state.blade.kissakiLength ?? 0,
    (v) => (state.blade.kissakiLength = v),
    rerender
  );
  slider(
    bCurv,
    'Kissaki Round',
    0,
    1,
    0.01,
    state.blade.kissakiRoundness ?? 0.5,
    (v) => (state.blade.kissakiRoundness = v),
    rerender
  );
  slider(
    bCurv,
    'Tip Ramp %',
    0,
    95,
    1,
    Math.round((state.blade.tipRampStart ?? 0) * 100),
    (v) => {
      state.blade.tipRampStart = clamp((v as number) / 100, 0, 0.98);
    },
    rerender
  );
  select(
    bCurv,
    'Tip Shape',
    ['pointed', 'rounded', 'leaf', 'clip', 'tanto', 'spear', 'sheepsfoot'],
    (state.blade.tipShape ?? 'pointed') as string,
    (v) => (state.blade.tipShape = v as any),
    rerender,
    'High-level tip shaping.'
  );
  slider(
    bCurv,
    'Tip Bulge',
    0,
    1,
    0.01,
    state.blade.tipBulge ?? 0,
    (v) => (state.blade.tipBulge = v),
    rerender,
    "Extra mid-blade bulge for 'leaf' tips."
  );
  slider(
    bCurv,
    'Base Angle',
    -0.35,
    0.35,
    0.001,
    state.blade.baseAngle ?? 0,
    (v) => (state.blade.baseAngle = v),
    rerender,
    'Initial tangent angle at base (radians).'
  );
  slider(
    bCurv,
    'Twist Angle',
    -37.6991,
    37.6991,
    0.01,
    state.blade.twistAngle ?? 0,
    (v) => (state.blade.twistAngle = v),
    rerender,
    'Total twist around +Y in radians (±12π).'
  );
  select(
    bCurv,
    'Edge Type',
    ['double', 'single'],
    (state.blade.edgeType ?? 'double') as string,
    (v) => (state.blade.edgeType = v as any),
    rerender
  );

  // Hamon
  const bHamon = addGroup(sections.Blade, 'Hamon');
  checkbox(
    bHamon,
    'Hamon Enabled',
    state.blade.hamonEnabled ?? false,
    (v) => (state.blade.hamonEnabled = v),
    rerender
  );
  slider(
    bHamon,
    'Hamon Width',
    0.001,
    0.06,
    0.001,
    state.blade.hamonWidth ?? 0.02,
    (v) => (state.blade.hamonWidth = v),
    rerender
  );
  slider(
    bHamon,
    'Hamon Amp',
    0,
    0.03,
    0.001,
    state.blade.hamonAmplitude ?? 0.008,
    (v) => (state.blade.hamonAmplitude = v),
    rerender
  );
  slider(
    bHamon,
    'Hamon Freq',
    0,
    20,
    1,
    state.blade.hamonFrequency ?? 6,
    (v) => (state.blade.hamonFrequency = v),
    rerender
  );
  select(
    bHamon,
    'Hamon Side',
    ['auto', 'left', 'right', 'both'],
    (state.blade.hamonSide ?? 'auto') as string,
    (v) => (state.blade.hamonSide = v as any),
    rerender
  );

  // End blade: asymmetry/chaos
  slider(
    sections.Blade,
    'Asymmetry',
    -1,
    1,
    0.01,
    state.blade.asymmetry ?? 0,
    (v) => (state.blade.asymmetry = v),
    rerender
  );
  slider(
    sections.Blade,
    'Chaos',
    0,
    1,
    0.01,
    state.blade.chaos ?? 0,
    (v) => (state.blade.chaos = v),
    rerender
  );

  // Family presets & advanced waves
  const bFamily = addGroup(sections.Blade, 'Family');
  select(
    bFamily,
    'Blade Family',
    ['straight', 'flamberge', 'kris'],
    ((state.blade as any).family ?? 'straight') as string,
    (v) => ((state.blade as any).family = v as any),
    rerender,
    'High-level silhouette preset.'
  );
  slider(
    bFamily,
    'Kris Waves',
    1,
    21,
    1,
    Math.round(((state.blade as any).krisWaveCount ?? 7) as number),
    (v) => ((state.blade as any).krisWaveCount = Math.round(v) | 1),
    rerender,
    'Odd wave count used when family=kris.'
  );

  // Keep these consistent with original placement
  checkbox(
    bFuller,
    'Enable Fullers',
    state.blade.fullerEnabled ?? false,
    (v) => {
      state.blade.fullerEnabled = v;
      if (!v) {
        if ((state.blade as any).fullerFaces) delete (state.blade as any).fullerFaces;
        if ((state.blade as any).fullers) delete (state.blade as any).fullers;
        (state.blade as any).fullerMode = 'none';
      }
    },
    rerender
  );
  slider(
    bFuller,
    'Fuller Count',
    0,
    3,
    1,
    state.blade.fullerCount ?? 1,
    (v) => (state.blade.fullerCount = Math.round(v)),
    rerender
  );
  slider(
    bFuller,
    'Fuller Depth',
    0,
    0.1,
    0.001,
    state.blade.fullerDepth ?? 0,
    (v) => (state.blade.fullerDepth = v),
    rerender
  );
  slider(
    bFuller,
    'Fuller Length',
    0,
    1,
    0.01,
    state.blade.fullerLength ?? 0,
    (v) => (state.blade.fullerLength = v),
    rerender
  );

  slider(
    bSerr,
    'Serration Left',
    0,
    0.2,
    0.001,
    state.blade.serrationAmplitudeLeft ?? (state.blade as any).serrationAmplitude ?? 0,
    (v) => (state.blade.serrationAmplitudeLeft = v),
    rerender
  );
  slider(
    bSerr,
    'Serration Right',
    0,
    0.2,
    0.001,
    state.blade.serrationAmplitudeRight ?? (state.blade as any).serrationAmplitude ?? 0,
    (v) => (state.blade.serrationAmplitudeRight = v),
    rerender
  );
  slider(
    bSerr,
    'Serration Freq',
    0,
    120,
    1,
    state.blade.serrationFrequency ?? 0,
    (v) => (state.blade.serrationFrequency = v),
    rerender
  );
  slider(
    bSerr,
    'Serration Sharpness',
    0,
    1,
    0.01,
    (state.blade as any).serrationSharpness ?? 0,
    (v) => {
      (state.blade as any).serrationSharpness = v;
    },
    rerender
  );
  slider(
    bSerr,
    'Serration Lean L',
    -1,
    1,
    0.01,
    (state.blade as any).serrationLeanLeft ?? 0,
    (v) => {
      (state.blade as any).serrationLeanLeft = v;
    },
    rerender
  );
  slider(
    bSerr,
    'Serration Lean R',
    -1,
    1,
    0.01,
    (state.blade as any).serrationLeanRight ?? 0,
    (v) => {
      (state.blade as any).serrationLeanRight = v;
    },
    rerender
  );
}

export function attachGuardControls(opts: {
  sections: ModelSections;
  state: SwordParams;
  helpers: UIHelpers;
  rerender: () => void;
}) {
  const { sections, state, helpers, rerender } = opts;
  const { addGroup, slider, select, checkbox } = helpers;
  const guardExtras = () => ((state.guard as any).extras || []) as any[];
  const findGuardExtra = (kind: string) => guardExtras().find((e: any) => e.kind === kind);
  const hasGuardExtra = (kind: string) => guardExtras().some((e: any) => e.kind === kind);

  // Base guard controls
  slider(
    sections.Guard,
    'Guard Width',
    0.2,
    3.0,
    0.01,
    state.guard.width,
    (v) => (state.guard.width = v),
    rerender
  );
  slider(
    sections.Guard,
    'Guard Thickness',
    0.05,
    0.6,
    0.005,
    state.guard.thickness,
    (v) => (state.guard.thickness = v),
    rerender
  );
  slider(
    sections.Guard,
    'Curve',
    -1,
    1,
    0.01,
    state.guard.curve,
    (v) => (state.guard.curve = v),
    rerender,
    'Bends ornate guards upward/downward.'
  );
  slider(
    sections.Guard,
    'Tilt',
    -1.57,
    1.57,
    0.01,
    state.guard.tilt,
    (v) => (state.guard.tilt = v),
    rerender,
    'Rotates the guard around the blade axis.'
  );
  select(
    sections.Guard,
    'Style',
    ['bar', 'winged', 'claw', 'disk', 'basket', 'knucklebow', 'swept', 'shell'],
    state.guard.style as any,
    (v) => (state.guard.style = v as any),
    rerender
  );

  // Fillet
  const gFillet = addGroup(sections.Guard, 'Fillet');
  slider(
    gFillet,
    'Blend Fillet',
    0,
    1,
    0.01,
    (state.guard as any).guardBlendFillet ?? 0,
    (v) => ((state.guard as any).guardBlendFillet = v),
    rerender,
    'Small bridge piece between blade and guard.'
  );
  select(
    gFillet,
    'Fillet Style',
    ['box', 'smooth'],
    ((state.guard as any).guardBlendFilletStyle ?? 'box') as string,
    (v) => {
      (state.guard as any).guardBlendFilletStyle = v as any;
    },
    rerender,
    'Fillet style between guard and blade.'
  );

  // Shell guard controls (cup/cavalry shell)
  const gShell = addGroup(sections.Guard, 'Shell Guard');
  slider(
    gShell,
    'Shell Coverage',
    0.3,
    1.0,
    0.01,
    (state.guard as any).shellCoverage ?? 0.75,
    (v) => ((state.guard as any).shellCoverage = v),
    rerender,
    'Cup/shell coverage fraction (0.3..1).'
  );
  slider(
    gShell,
    'Shell Thickness',
    0.2,
    1.5,
    0.01,
    (state.guard as any).shellThickness ?? 1.0,
    (v) => ((state.guard as any).shellThickness = v),
    rerender,
    'Additional shell thickness scaling.'
  );
  slider(
    gShell,
    'Shell Flare',
    0.5,
    2.0,
    0.01,
    (state.guard as any).shellFlare ?? 1.0,
    (v) => ((state.guard as any).shellFlare = v),
    rerender,
    'Stretch shell along Z (elongation).'
  );

  // Langets hugging the blade flats
  const gLangets = addGroup(sections.Guard, 'Langets');
  const ensureLangets = () => {
    const g: any = state.guard as any;
    if (!g.langets) g.langets = {};
    return g.langets as any;
  };
  checkbox(
    gLangets,
    'Langets Enabled',
    !!(state.guard as any).langets?.enabled,
    (v) => (ensureLangets().enabled = v),
    rerender,
    'Small flats hugging the blade base.'
  );
  slider(
    gLangets,
    'Langet Length',
    0.02,
    0.4,
    0.001,
    (state.guard as any).langets?.length ?? 0.12,
    (v) => (ensureLangets().length = v),
    rerender
  );
  slider(
    gLangets,
    'Langet Width',
    0.005,
    0.2,
    0.001,
    (state.guard as any).langets?.width ?? 0.04,
    (v) => (ensureLangets().width = v),
    rerender
  );
  slider(
    gLangets,
    'Langet Thick',
    0.002,
    0.08,
    0.001,
    (state.guard as any).langets?.thickness ?? 0.01,
    (v) => (ensureLangets().thickness = v),
    rerender
  );
  slider(
    gLangets,
    'Langet Chamfer',
    0,
    0.5,
    0.01,
    (state.guard as any).langets?.chamfer ?? 0,
    (v) => (ensureLangets().chamfer = v),
    rerender
  );

  // Pas d'âne rings
  const gPas = addGroup(sections.Guard, "Pas d'âne");
  slider(
    gPas,
    "Pas d'âne Count",
    0,
    2,
    1,
    (state.guard as any).pasDaneCount ?? 0,
    (v) => ((state.guard as any).pasDaneCount = Math.round(v)),
    rerender
  );
  slider(
    gPas,
    "Pas d'âne Radius",
    0.01,
    0.15,
    0.001,
    (state.guard as any).pasDaneRadius ?? 0.05,
    (v) => ((state.guard as any).pasDaneRadius = v),
    rerender
  );
  slider(
    gPas,
    "Pas d'âne Thick",
    0.002,
    0.06,
    0.001,
    (state.guard as any).pasDaneThickness ?? 0.01,
    (v) => ((state.guard as any).pasDaneThickness = v),
    rerender
  );
  slider(
    gPas,
    "Pas d'âne OffsetY",
    -0.2,
    0.2,
    0.001,
    (state.guard as any).pasDaneOffsetY ?? 0,
    (v) => ((state.guard as any).pasDaneOffsetY = v),
    rerender
  );

  // Finger guard
  checkbox(
    sections.Guard,
    'Finger Guard',
    hasGuardExtra('fingerGuard'),
    (v) => {
      const arr = guardExtras();
      const without = arr.filter((e) => e.kind !== 'fingerGuard');
      if (v) without.push({ kind: 'fingerGuard', radius: 0.12, thickness: 0.03, offsetY: 0 });
      (state.guard as any).extras = without;
    },
    rerender,
    'Add a small bar under the knuckles.'
  );

  // Side rings
  const gRings = addGroup(sections.Guard, 'Side Rings');
  checkbox(
    gRings,
    'Side Rings',
    hasGuardExtra('sideRing'),
    (v) => {
      const arr = guardExtras();
      const without = arr.filter((e) => e.kind !== 'sideRing');
      if (v) without.push({ kind: 'sideRing', radius: 0.12, thickness: 0.03, offsetY: 0 });
      (state.guard as any).extras = without;
    },
    rerender,
    'Add decorative rings at guard sides.'
  );
  slider(
    gRings,
    'Ring Radius',
    0.01,
    0.4,
    0.001,
    findGuardExtra('sideRing')?.radius ?? 0.12,
    (v) => {
      const arr = guardExtras();
      (state.guard as any).extras = arr.map((e: any) =>
        e.kind === 'sideRing' ? { ...e, radius: v } : e
      );
    },
    rerender,
    'Side ring radius.'
  );
  slider(
    gRings,
    'Ring Thick',
    0.005,
    0.1,
    0.001,
    findGuardExtra('sideRing')?.thickness ?? 0.03,
    (v) => {
      const arr = guardExtras();
      (state.guard as any).extras = arr.map((e: any) =>
        e.kind === 'sideRing' ? { ...e, thickness: v } : e
      );
    },
    rerender,
    'Side ring thickness (rod radius).'
  );
  slider(
    gRings,
    'Ring Offset Y',
    -0.4,
    0.4,
    0.001,
    findGuardExtra('sideRing')?.offsetY ?? 0,
    (v) => {
      const arr = guardExtras();
      (state.guard as any).extras = arr.map((e: any) =>
        e.kind === 'sideRing' ? { ...e, offsetY: v } : e
      );
    },
    rerender,
    'Vertical offset for rings relative to guard center.'
  );

  // Loops
  const gLoops = addGroup(sections.Guard, 'Loops');
  checkbox(
    gLoops,
    'Loops',
    hasGuardExtra('loop'),
    (v) => {
      const arr = guardExtras();
      const without = arr.filter((e) => e.kind !== 'loop');
      if (v) without.push({ kind: 'loop', radius: 0.12, thickness: 0.02, offsetY: 0 });
      (state.guard as any).extras = without;
    },
    rerender,
    'Add loops/brackets for decoration or hand protection.'
  );
  slider(
    gLoops,
    'Loop Radius',
    0.01,
    0.4,
    0.001,
    findGuardExtra('loop')?.radius ?? 0.12,
    (v) => {
      const arr = guardExtras();
      (state.guard as any).extras = arr.map((e: any) =>
        e.kind === 'loop' ? { ...e, radius: v } : e
      );
    },
    rerender,
    'Loop radius.'
  );
  slider(
    gLoops,
    'Loop Thickness',
    0.005,
    0.1,
    0.001,
    findGuardExtra('loop')?.thickness ?? 0.02,
    (v) => {
      const arr = guardExtras();
      (state.guard as any).extras = arr.map((e: any) =>
        e.kind === 'loop' ? { ...e, thickness: v } : e
      );
    },
    rerender,
    'Loop thickness.'
  );
  slider(
    gLoops,
    'Loop OffsetY',
    -0.2,
    0.2,
    0.001,
    findGuardExtra('loop')?.offsetY ?? 0,
    (v) => {
      const arr = guardExtras();
      (state.guard as any).extras = arr.map((e: any) =>
        e.kind === 'loop' ? { ...e, offsetY: v } : e
      );
    },
    rerender,
    'Loop vertical offset.'
  );

  // Misc guard settings
  checkbox(
    sections.Guard,
    'Asymmetric Arms',
    (state.guard as any).asymmetricArms ?? false,
    (v) => ((state.guard as any).asymmetricArms = v),
    rerender,
    'Scale left/right guard arms differently.'
  );
  slider(
    sections.Guard,
    'Arm Asymmetry',
    -1,
    1,
    0.01,
    (state.guard as any).asymmetry ?? 0,
    (v) => ((state.guard as any).asymmetry = v),
    rerender,
    'Negative enlarges left; positive enlarges right.'
  );
  slider(
    sections.Guard,
    'Guard Detail',
    3,
    64,
    1,
    (state.guard as any).curveSegments ?? 12,
    (v) => ((state.guard as any).curveSegments = Math.round(v)),
    rerender,
    'Detail for guard curves.'
  );
  checkbox(
    sections.Guard,
    'Habaki',
    (state.guard as any).habakiEnabled ?? false,
    (v) => ((state.guard as any).habakiEnabled = v),
    rerender,
    'Blade collar above the guard.'
  );
  slider(
    sections.Guard,
    'Habaki Height',
    0.02,
    0.2,
    0.001,
    (state.guard as any).habakiHeight ?? 0.06,
    (v) => ((state.guard as any).habakiHeight = v),
    rerender,
    'Height of the habaki collar.'
  );
  slider(
    sections.Guard,
    'Habaki Margin',
    0.002,
    0.08,
    0.001,
    (state.guard as any).habakiMargin ?? 0.01,
    (v) => ((state.guard as any).habakiMargin = v),
    rerender,
    'Clearance added to blade width/thickness.'
  );
  slider(
    sections.Guard,
    'Guard Height',
    -0.15,
    0.15,
    0.001,
    (state.guard as any).heightOffset ?? 0,
    (v) => ((state.guard as any).heightOffset = v),
    rerender,
    'Vertical offset: top of guard vs blade base.'
  );

  const gQuillon = addGroup(sections.Guard, 'Quillons');
  slider(
    gQuillon,
    'Quillon Count',
    0,
    4,
    2,
    (state.guard as any).quillonCount ?? 0,
    (v) => ((state.guard as any).quillonCount = Math.round(v)),
    rerender,
    'Number of quillons (0, 2, 4).'
  );
  slider(
    gQuillon,
    'Quillon Length',
    0.05,
    1.5,
    0.01,
    (state.guard as any).quillonLength ?? 0.25,
    (v) => ((state.guard as any).quillonLength = v),
    rerender,
    'Length of each quillon.'
  );
  slider(
    gQuillon,
    'Ornamentation',
    0,
    1,
    0.01,
    (state.guard as any).ornamentation ?? 0,
    (v) => ((state.guard as any).ornamentation = v),
    rerender,
    'Richer ends and facets.'
  );
  slider(
    gQuillon,
    'Tip Sharpness',
    0,
    1,
    0.01,
    (state.guard as any).tipSharpness ?? 0.5,
    (v) => ((state.guard as any).tipSharpness = v),
    rerender,
    'Continuous tip shape for wing/claw.'
  );

  const gDisk = addGroup(sections.Guard, 'Disk Cutouts');
  slider(
    gDisk,
    'Cutouts',
    0,
    12,
    1,
    (state.guard as any).cutoutCount ?? 0,
    (v) => ((state.guard as any).cutoutCount = Math.round(v)),
    rerender,
    'Tsuba (disk) radial cutouts.'
  );
  slider(
    gDisk,
    'Cutout Radius',
    0.1,
    0.8,
    0.01,
    (state.guard as any).cutoutRadius ?? 0.5,
    (v) => ((state.guard as any).cutoutRadius = v),
    rerender,
    'Cutout hole radius fraction.'
  );

  const gBasket = addGroup(sections.Guard, 'Basket Guard');
  slider(
    gBasket,
    'Basket Rods',
    4,
    24,
    1,
    (state.guard as any).basketRodCount ?? 12,
    (v) => ((state.guard as any).basketRodCount = Math.round(v)),
    rerender,
    'Number of radial rods in basket.'
  );
  slider(
    gBasket,
    'Basket Rod Thick',
    0.004,
    0.08,
    0.001,
    (state.guard as any).basketRodRadius ?? 0.02,
    (v) => ((state.guard as any).basketRodRadius = v),
    rerender,
    'Rod radius for basket bars.'
  );
  slider(
    gBasket,
    'Basket Rings',
    0,
    2,
    1,
    (state.guard as any).basketRingCount ?? 1,
    (v) => ((state.guard as any).basketRingCount = Math.round(v)),
    rerender,
    'Number of rim rings (0..2).'
  );
  slider(
    gBasket,
    'Ring Thickness',
    0.002,
    0.06,
    0.001,
    (state.guard as any).basketRingThickness ?? 0.012,
    (v) => ((state.guard as any).basketRingThickness = v),
    rerender,
    'Minor radius of rim rings.'
  );
  slider(
    gBasket,
    'Ring Radius +',
    0,
    0.2,
    0.001,
    (state.guard as any).basketRingRadiusAdd ?? 0.0,
    (v) => ((state.guard as any).basketRingRadiusAdd = v),
    rerender,
    'Additional radius added to basket rim rings.'
  );
}

export function attachHandleControls(opts: {
  sections: ModelSections;
  state: SwordParams;
  helpers: UIHelpers;
  rerender: () => void;
  syncUi: () => void;
}) {
  const { sections, state, helpers, rerender, syncUi } = opts;
  const { addGroup, slider, select, checkbox } = helpers;
  const handleLayers = () => ((state.handle as any).handleLayers || []) as any[];
  const findHandleLayer = (kind: string, predicate?: (layer: any) => boolean) =>
    handleLayers().find((layer) => layer.kind === kind && (!predicate || predicate(layer)));
  const ringLayers = () => handleLayers().filter((layer) => layer.kind === 'ring');
  const crisscrossLayer = () =>
    findHandleLayer('wrap', (layer) => layer.wrapPattern === 'crisscross');
  const ringLayer = () => ringLayers()[0];
  const menukiLayers = () => ((state.handle as any).menuki || []) as any[];
  const rivetLayers = () => ((state.handle as any).rivets || []) as any[];

  slider(
    sections.Handle,
    'Handle Length',
    0.2,
    2.0,
    0.01,
    state.handle.length,
    (v) => (state.handle.length = v),
    rerender
  );
  slider(
    sections.Handle,
    'Radius Top',
    0.05,
    0.3,
    0.001,
    state.handle.radiusTop,
    (v) => (state.handle.radiusTop = v),
    rerender
  );
  slider(
    sections.Handle,
    'Radius Bottom',
    0.05,
    0.3,
    0.001,
    state.handle.radiusBottom,
    (v) => (state.handle.radiusBottom = v),
    rerender
  );
  checkbox(
    sections.Handle,
    'Ridges',
    state.handle.segmentation,
    (v) => (state.handle.segmentation = v),
    rerender,
    'Adds axial ridges along the grip.'
  );
  slider(
    sections.Handle,
    'Ridge Count',
    0,
    64,
    1,
    state.handle.segmentationCount ?? 8,
    (v) => (state.handle.segmentationCount = Math.round(v)),
    rerender,
    'Number of ridge cycles when Ridges enabled.'
  );

  const hWrap = addGroup(sections.Handle, 'Handle Wrap');
  checkbox(
    hWrap,
    'Wrap Enabled',
    state.handle.wrapEnabled ?? false,
    (v) => (state.handle.wrapEnabled = v),
    rerender,
    'Enable helical wrap deformation for the grip.'
  );
  slider(
    hWrap,
    'Wrap Turns',
    0,
    20,
    1,
    state.handle.wrapTurns ?? 6,
    (v) => (state.handle.wrapTurns = v),
    rerender,
    'Number of helical cycles along the grip.'
  );
  slider(
    hWrap,
    'Wrap Depth',
    0,
    0.05,
    0.001,
    state.handle.wrapDepth ?? 0.015,
    (v) => (state.handle.wrapDepth = v),
    rerender,
    'Radial amplitude of the wrap pattern.'
  );
  slider(
    sections.Handle,
    'Handle Sides',
    8,
    128,
    1,
    state.handle.phiSegments ?? 64,
    (v) => (state.handle.phiSegments = Math.round(v)),
    rerender,
    'Radial tessellation (higher is smoother).'
  );
  checkbox(
    hWrap,
    'Wrap Texture',
    state.handle.wrapTexture ?? false,
    (v) => (state.handle.wrapTexture = v),
    rerender,
    'Procedural diagonal stripe texture on grip.'
  );
  slider(
    hWrap,
    'Wrap Tex Scale',
    1,
    32,
    1,
    state.handle.wrapTexScale ?? 10,
    (v) => (state.handle.wrapTexScale = Math.round(v)),
    rerender,
    'Texture repeat scale.'
  );
  slider(
    hWrap,
    'Wrap Tex Angle',
    -90,
    90,
    1,
    ((state.handle.wrapTexAngle ?? Math.PI / 4) * 180) / Math.PI,
    (v) => (state.handle.wrapTexAngle = (v * Math.PI) / 180),
    rerender,
    'Stripe angle (degrees).'
  );
  select(
    hWrap,
    'Wrap Style',
    ['none', 'crisscross', 'hineri', 'katate', 'wire'],
    state.handle.wrapStyle ?? 'none',
    (v) => {
      state.handle.wrapStyle = v as typeof state.handle.wrapStyle;
    },
    () => rerender(),
    'Adds stylized wrap geometry (hineri/katate/wire).'
  );

  // Rayskin overlay
  const hRayskin = addGroup(sections.Handle, 'Rayskin');
  const ensureRayskin = () => {
    if (!state.handle.rayskin) state.handle.rayskin = {} as any;
    return state.handle.rayskin as any;
  };
  checkbox(
    hRayskin,
    'Rayskin Enabled',
    !!state.handle.rayskin?.enabled,
    (v) => (ensureRayskin().enabled = v),
    rerender,
    'Enable thin rayskin overlay on grip.'
  );
  slider(
    hRayskin,
    'Rayskin Scale',
    0.001,
    0.05,
    0.001,
    state.handle.rayskin?.scale ?? 0.006,
    (v) => (ensureRayskin().scale = v),
    rerender,
    'Thickness offset for rayskin overlay.'
  );
  slider(
    hRayskin,
    'Rayskin Intensity',
    0,
    1,
    0.01,
    state.handle.rayskin?.intensity ?? 0.25,
    (v) => (ensureRayskin().intensity = v),
    rerender,
    'Visual tint strength for rayskin.'
  );

  const wrapPresetRow = document.createElement('div');
  wrapPresetRow.className = 'row full';
  wrapPresetRow.style.alignItems = 'center';
  const wrapPresetLabel = document.createElement('label');
  wrapPresetLabel.textContent = 'Wrap Presets';
  wrapPresetLabel.style.marginRight = '8px';
  wrapPresetLabel.style.fontSize = '12px';
  wrapPresetRow.appendChild(wrapPresetLabel);
  const wrapPresetButtons = document.createElement('div');
  wrapPresetButtons.style.display = 'flex';
  wrapPresetButtons.style.gap = '6px';

  const applyWrapPreset = (preset: 'hineri' | 'katate' | 'wire') => {
    state.handle.wrapEnabled = true;
    state.handle.wrapTexture = preset === 'katate';
    if (preset === 'hineri') {
      state.handle.wrapStyle = 'hineri';
      state.handle.wrapTurns = 8;
      state.handle.wrapDepth = 0.012;
      state.handle.wrapTexScale = 12;
      state.handle.wrapTexAngle = Math.PI / 5;
    } else if (preset === 'katate') {
      state.handle.wrapStyle = 'katate';
      state.handle.wrapTurns = 6;
      state.handle.wrapDepth = 0.013;
      state.handle.wrapTexScale = 16;
      state.handle.wrapTexAngle = Math.PI / 6;
    } else if (preset === 'wire') {
      state.handle.wrapStyle = 'wire';
      state.handle.wrapTurns = 0;
      state.handle.wrapDepth = 0.006;
      state.handle.wrapTexture = false;
    }
    rerender();
    syncUi();
  };

  const makeWrapButton = (label: string, preset: 'hineri' | 'katate' | 'wire') => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.addEventListener('click', () => applyWrapPreset(preset));
    wrapPresetButtons.appendChild(btn);
  };

  makeWrapButton('Hineri-maki', 'hineri');
  makeWrapButton('Katate-maki', 'katate');
  makeWrapButton('Wire Wrap', 'wire');
  wrapPresetRow.appendChild(wrapPresetButtons);
  sections.Handle.appendChild(wrapPresetRow);

  slider(
    sections.Handle,
    'Oval Ratio',
    1,
    1.8,
    0.01,
    state.handle.ovalRatio ?? 1,
    (v) => (state.handle.ovalRatio = v),
    rerender,
    'Wider X vs Z for an oval tsuka.'
  );
  slider(
    sections.Handle,
    'Flare',
    0,
    0.2,
    0.001,
    state.handle.flare ?? 0,
    (v) => (state.handle.flare = v),
    rerender,
    'Extra radius near the pommel.'
  );
  slider(
    sections.Handle,
    'Handle Curvature',
    -0.2,
    0.2,
    0.001,
    state.handle.curvature ?? 0,
    (v) => (state.handle.curvature = v),
    rerender,
    'Slight bend in handle along length.'
  );

  const hTang = addGroup(sections.Handle, 'Tang');
  checkbox(
    hTang,
    'Tang Visible',
    state.handle.tangVisible ?? false,
    (v) => (state.handle.tangVisible = v),
    rerender,
    'Show a rectangular tang through the handle.'
  );
  slider(
    hTang,
    'Tang Width',
    0.005,
    0.2,
    0.001,
    state.handle.tangWidth ?? 0.05,
    (v) => (state.handle.tangWidth = v),
    rerender,
    'Visible tang width.'
  );
  slider(
    hTang,
    'Tang Thickness',
    0.003,
    0.1,
    0.001,
    state.handle.tangThickness ?? 0.02,
    (v) => (state.handle.tangThickness = v),
    rerender,
    'Visible tang thickness.'
  );

  checkbox(
    sections.Handle,
    'Crisscross Wrap Layer',
    !!crisscrossLayer(),
    (v) => {
      const arr = handleLayers();
      const rest = arr.filter((e: any) => !(e.kind === 'wrap' && e.wrapPattern === 'crisscross'));
      if (v) {
        rest.push({
          kind: 'wrap',
          wrapPattern: 'crisscross',
          y0Frac: 0,
          lengthFrac: 1,
          turns: 7,
          depth: 0.012,
        });
      }
      (state.handle as any).handleLayers = rest;
    },
    rerender,
    'Adds two intertwined helices around the grip.'
  );
  slider(
    sections.Handle,
    'Wrap Turns L',
    1,
    20,
    1,
    Math.round(crisscrossLayer()?.turns ?? 7),
    (val) => {
      const arr = handleLayers();
      (state.handle as any).handleLayers = arr.map((e: any) =>
        e.kind === 'wrap' && e.wrapPattern === 'crisscross' ? { ...e, turns: Math.round(val) } : e
      );
    },
    rerender,
    'Number of crisscross turns.'
  );
  slider(
    sections.Handle,
    'Wrap Depth',
    0.001,
    0.05,
    0.001,
    crisscrossLayer()?.depth ?? 0.012,
    (val) => {
      const arr = handleLayers();
      (state.handle as any).handleLayers = arr.map((e: any) =>
        e.kind === 'wrap' && e.wrapPattern === 'crisscross' ? { ...e, depth: val } : e
      );
    },
    rerender,
    'Radial height of the wrap layer.',
    'handle.layer-wrap-depth'
  );
  slider(
    sections.Handle,
    'Wrap Y0 %',
    0,
    100,
    1,
    Math.round((crisscrossLayer()?.y0Frac ?? 0) * 100),
    (val) => {
      const arr = handleLayers();
      (state.handle as any).handleLayers = arr.map((e: any) =>
        e.kind === 'wrap' && e.wrapPattern === 'crisscross' ? { ...e, y0Frac: val / 100 } : e
      );
    },
    rerender,
    'Start position of wrap (percent of handle length).'
  );
  slider(
    sections.Handle,
    'Wrap Len %',
    1,
    100,
    1,
    Math.round((crisscrossLayer()?.lengthFrac ?? 1) * 100),
    (val) => {
      const arr = handleLayers();
      (state.handle as any).handleLayers = arr.map((e: any) =>
        e.kind === 'wrap' && e.wrapPattern === 'crisscross'
          ? { ...e, lengthFrac: Math.max(0.01, val / 100) }
          : e
      );
    },
    rerender,
    'Length of the wrap section (percent of handle).'
  );

  const hRings = addGroup(sections.Handle, 'Handle Rings');
  checkbox(
    hRings,
    'Handle Ring',
    ringLayers().length > 0,
    (v) => {
      const arr = handleLayers();
      const rest = arr.filter((e: any) => e.kind !== 'ring');
      if (v) {
        rest.push({ kind: 'ring', y0Frac: 0.5, radiusAdd: 0.0 });
      }
      (state.handle as any).handleLayers = rest;
    },
    rerender,
    'Add a decorative ring around the grip.'
  );
  slider(
    hRings,
    'Ring Y %',
    0,
    100,
    1,
    Math.round((ringLayer()?.y0Frac ?? 0.5) * 100),
    (val) => {
      const arr = handleLayers();
      (state.handle as any).handleLayers = arr.map((e: any) =>
        e.kind === 'ring' ? { ...e, y0Frac: val / 100 } : e
      );
    },
    rerender,
    'Vertical position of ring.'
  );
  slider(
    hRings,
    'Ring Radius +',
    0,
    0.2,
    0.001,
    ringLayer()?.radiusAdd ?? 0.0,
    (val) => {
      const arr = handleLayers();
      (state.handle as any).handleLayers = arr.map((e: any) =>
        e.kind === 'ring' ? { ...e, radiusAdd: val } : e
      );
    },
    rerender,
    'Additional radius for ring.'
  );
  slider(
    hRings,
    'Rings Count',
    0,
    3,
    1,
    ringLayers().length,
    (val) => {
      const n = Math.max(0, Math.round(val));
      const arr = handleLayers();
      const others = arr.filter((e: any) => e.kind !== 'ring');
      const rings: any[] = [];
      if (n > 0) {
        for (let i = 0; i < n; i++) {
          const t = n === 1 ? 0.5 : (i / (n - 1)) * 0.8 + 0.1;
          rings.push({ kind: 'ring', y0Frac: t, radiusAdd: 0.0 });
        }
      }
      (state.handle as any).handleLayers = [...others, ...rings];
    },
    rerender,
    'Create multiple ring layers, evenly spaced.'
  );

  const hOrn = addGroup(sections.Handle, 'Ornaments');
  select(
    hOrn,
    'Menuki Preset',
    ['none', 'katana', 'paired'],
    state.handle.menukiPreset ?? 'none',
    (v) => (state.handle.menukiPreset = v as any),
    rerender,
    'Auto menuki placement preset.'
  );
  checkbox(
    hOrn,
    'Menuki',
    menukiLayers().length > 0,
    (v) => {
      (state.handle as any).menuki = v ? [{ positionFrac: 0.55, side: 'left', size: 0.02 }] : [];
    },
    rerender,
    'Add a menuki ornament on the grip.'
  );
  checkbox(
    hOrn,
    'Rivets',
    rivetLayers().length > 0,
    (v) => {
      (state.handle as any).rivets = v ? [{ count: 8, ringFrac: 0.3, radius: 0.01 }] : [];
    },
    rerender,
    'Add a ring of rivets.'
  );
  slider(
    hOrn,
    'Rivets Count',
    1,
    32,
    1,
    Math.round(rivetLayers()[0]?.count ?? 8),
    (val) => {
      const arr = rivetLayers();
      (state.handle as any).rivets = arr.map((r: any) => ({ ...r, count: Math.round(val) }));
    },
    rerender,
    'Number of rivets around the ring.'
  );
  slider(
    hOrn,
    'Rivets Y %',
    0,
    100,
    1,
    Math.round((rivetLayers()[0]?.ringFrac ?? 0.3) * 100),
    (val) => {
      const arr = rivetLayers();
      (state.handle as any).rivets = arr.map((r: any) => ({ ...r, ringFrac: val / 100 }));
    },
    rerender,
    'Vertical position of rivets ring.'
  );
  slider(
    hOrn,
    'Rivet Size',
    0.002,
    0.05,
    0.001,
    rivetLayers()[0]?.radius ?? 0.01,
    (val) => {
      const arr = rivetLayers();
      (state.handle as any).rivets = arr.map((r: any) => ({ ...r, radius: val }));
    },
    rerender,
    'Rivet sphere radius.'
  );
}

export function attachPommelControls(opts: {
  sections: ModelSections;
  state: SwordParams;
  helpers: UIHelpers;
  rerender: () => void;
}) {
  const { sections, state, helpers, rerender } = opts;
  const { slider, select } = helpers;

  select(
    sections.Pommel,
    'Style',
    ['orb', 'disk', 'spike', 'wheel', 'scentStopper', 'ring', 'crown', 'fishtail'],
    state.pommel.style,
    (v) => (state.pommel.style = v as typeof state.pommel.style),
    rerender
  );
  slider(
    sections.Pommel,
    'Pommel Size',
    0.05,
    0.5,
    0.001,
    state.pommel.size,
    (v) => (state.pommel.size = v),
    rerender
  );
  slider(
    sections.Pommel,
    'Elongation',
    0.5,
    2.0,
    0.01,
    state.pommel.elongation,
    (v) => (state.pommel.elongation = v),
    rerender
  );
  slider(
    sections.Pommel,
    'Morph',
    0,
    1,
    0.01,
    state.pommel.shapeMorph,
    (v) => (state.pommel.shapeMorph = v),
    rerender
  );
  slider(
    sections.Pommel,
    'Offset X',
    -0.3,
    0.3,
    0.001,
    state.pommel.offsetX ?? 0,
    (v) => (state.pommel.offsetX = v),
    rerender,
    'Offset pommel sideways.'
  );
  slider(
    sections.Pommel,
    'Offset Y',
    -0.3,
    0.3,
    0.001,
    state.pommel.offsetY ?? 0,
    (v) => (state.pommel.offsetY = v),
    rerender,
    'Offset pommel up/down.'
  );
  slider(
    sections.Pommel,
    'Facet Count',
    6,
    64,
    1,
    state.pommel.facetCount ?? 32,
    (v) => (state.pommel.facetCount = Math.round(v)),
    rerender,
    'Radial facets (lower is more gem-like).'
  );
  slider(
    sections.Pommel,
    'Wheel Face Bevel',
    0,
    1,
    0.01,
    (state.pommel as any).wheelFaceBevel ?? 0,
    (v) => ((state.pommel as any).wheelFaceBevel = v),
    rerender,
    'Visual bevel for wheel-style pommel.'
  );
  slider(
    sections.Pommel,
    'Spike Length',
    0.5,
    2.0,
    0.01,
    state.pommel.spikeLength ?? 1.0,
    (v) => (state.pommel.spikeLength = v),
    rerender,
    'Spike length for spike style.'
  );
  slider(
    sections.Pommel,
    'Balance',
    0,
    1,
    0.01,
    (state.pommel as any).balance ?? 0,
    (v) => ((state.pommel as any).balance = v),
    rerender,
    'Interpolate pommel size toward blade-balanced target.'
  );
  slider(
    sections.Pommel,
    'Ring Inner R',
    0.01,
    0.6,
    0.001,
    (state.pommel as any).ringInnerRadius ?? 0.08,
    (v) => ((state.pommel as any).ringInnerRadius = v),
    rerender,
    'Inner radius for ring style.'
  );
  slider(
    sections.Pommel,
    'Crown Spikes',
    5,
    24,
    1,
    (state.pommel as any).crownSpikes ?? 8,
    (v) => ((state.pommel as any).crownSpikes = Math.round(v)),
    rerender,
    'Number of spikes for crown style.'
  );
  slider(
    sections.Pommel,
    'Crown Sharp',
    0,
    1,
    0.01,
    (state.pommel as any).crownSharpness ?? 0.6,
    (v) => ((state.pommel as any).crownSharpness = v),
    rerender,
    'Sharpness for crown style.'
  );
  // Peen
  checkbox(
    sections.Pommel,
    'Peen Visible',
    (state.pommel as any).peenVisible ?? false,
    (v) => ((state.pommel as any).peenVisible = v),
    rerender,
    'Show hammer peen or peen block.'
  );
  slider(
    sections.Pommel,
    'Peen Size',
    0.005,
    0.1,
    0.001,
    (state.pommel as any).peenSize ?? 0.02,
    (v) => ((state.pommel as any).peenSize = v),
    rerender
  );
  select(
    sections.Pommel,
    'Peen Shape',
    ['dome', 'block'],
    ((state.pommel as any).peenShape ?? 'dome') as string,
    (v) => ((state.pommel as any).peenShape = v as any),
    rerender
  );
}

export function attachAccessoryControls(opts: {
  sections: ModelSections;
  state: SwordParams;
  defaults: SwordParams;
  helpers: UIHelpers;
  rerender: () => void;
}) {
  const { sections, state, defaults, helpers, rerender } = opts;
  const { addGroup, slider, checkbox, select } = helpers;

  const ensureAccessories = (): NonNullable<SwordParams['accessories']> => {
    if (!state.accessories) {
      state.accessories = JSON.parse(JSON.stringify(defaults.accessories));
    }
    if (!state.accessories.scabbard) {
      state.accessories.scabbard = JSON.parse(JSON.stringify(defaults.accessories.scabbard));
    }
    if (!state.accessories.tassel) {
      state.accessories.tassel = JSON.parse(JSON.stringify(defaults.accessories.tassel));
    }
    return state.accessories;
  };
  const getScabbard = () => ensureAccessories().scabbard;
  const getTassel = () => ensureAccessories().tassel;

  const scabbard = getScabbard();
  const tassel = getTassel();

  const accScab = addGroup(sections.Accessories, 'Scabbard');
  checkbox(
    accScab,
    'Scabbard Enabled',
    scabbard.enabled,
    (v) => {
      getScabbard().enabled = v;
    },
    rerender,
    'Toggle the scabbard sheath.'
  );
  slider(
    accScab,
    'Scabbard Margin',
    0.005,
    0.2,
    0.001,
    scabbard.bodyMargin,
    (v) => {
      getScabbard().bodyMargin = v;
    },
    rerender,
    'Additional clearance added around blade width.'
  );
  slider(
    accScab,
    'Scabbard Thickness',
    0.05,
    0.6,
    0.005,
    scabbard.bodyThickness,
    (v) => {
      getScabbard().bodyThickness = v;
    },
    rerender,
    'Overall sheath thickness.'
  );
  slider(
    accScab,
    'Scabbard Tip %',
    0,
    50,
    1,
    Math.round(scabbard.tipExtension * 100),
    (v) => {
      getScabbard().tipExtension = v / 100;
    },
    rerender,
    'Extension past the blade tip (% of blade length).'
  );
  slider(
    accScab,
    'Throat Length %',
    0,
    50,
    1,
    Math.round(scabbard.throatLength * 100),
    (v) => {
      getScabbard().throatLength = v / 100;
    },
    rerender,
    'Length of the throat collar (% of blade length).'
  );
  slider(
    accScab,
    'Throat Scale',
    1,
    2.5,
    0.01,
    scabbard.throatScale,
    (v) => {
      getScabbard().throatScale = v;
    },
    rerender,
    'Scales the mouth/throat collar.'
  );
  slider(
    accScab,
    'Locket Offset %',
    0,
    90,
    1,
    Math.round(scabbard.locketOffset * 100),
    (v) => {
      getScabbard().locketOffset = v / 100;
    },
    rerender,
    'Distance from mouth to start the locket band.'
  );
  slider(
    accScab,
    'Locket Length %',
    0,
    60,
    1,
    Math.round(scabbard.locketLength * 100),
    (v) => {
      getScabbard().locketLength = v / 100;
    },
    rerender,
    'Length of the locket band swell.'
  );
  slider(
    accScab,
    'Locket Scale',
    1,
    2,
    0.01,
    scabbard.locketScale,
    (v) => {
      getScabbard().locketScale = v;
    },
    rerender,
    'Scale multiplier for the locket swell.'
  );
  slider(
    accScab,
    'Chape Length %',
    5,
    70,
    1,
    Math.round(scabbard.chapeLength * 100),
    (v) => {
      getScabbard().chapeLength = v / 100;
    },
    rerender,
    'Length tapered into the chape tip.'
  );
  slider(
    accScab,
    'Chape Scale',
    0.1,
    1,
    0.01,
    scabbard.chapeScale,
    (v) => {
      getScabbard().chapeScale = v;
    },
    rerender,
    'Width/thickness multiplier at the chape tip.'
  );
  slider(
    accScab,
    'Scabbard Roundness',
    0,
    1,
    0.01,
    scabbard.bodyRoundness,
    (v) => {
      getScabbard().bodyRoundness = v;
    },
    rerender,
    'Blend between flat faces and rounded scabbard cross-section.'
  );
  slider(
    accScab,
    'Scabbard Offset X',
    -0.4,
    0.4,
    0.005,
    scabbard.offsetX,
    (v) => {
      getScabbard().offsetX = v;
    },
    rerender,
    'Slide the scabbard sideways (scene units).'
  );
  slider(
    accScab,
    'Scabbard Offset Z',
    -0.3,
    0.3,
    0.005,
    scabbard.offsetZ,
    (v) => {
      getScabbard().offsetZ = v;
    },
    rerender,
    'Offset the scabbard toward/away from camera.'
  );
  slider(
    accScab,
    'Scabbard Hang °',
    -90,
    90,
    1,
    Math.round((scabbard.hangAngle * 180) / Math.PI),
    (v) => {
      getScabbard().hangAngle = (v / 180) * Math.PI;
    },
    rerender,
    'Rotate the scabbard around Z to simulate a hanging cant.'
  );

  const accTassel = addGroup(sections.Accessories, 'Tassel');
  checkbox(
    accTassel,
    'Tassel Enabled',
    tassel.enabled,
    (v) => {
      getTassel().enabled = v;
    },
    rerender,
    'Toggle tassel / sword knot.'
  );
  select(
    accTassel,
    'Tassel Attach',
    ['guard', 'scabbard'],
    tassel.attachTo,
    (v) => {
      getTassel().attachTo = v as 'guard' | 'scabbard';
    },
    rerender,
    'Anchor the tassel to the guard or scabbard.'
  );
  slider(
    accTassel,
    'Tassel Anchor %',
    0,
    100,
    1,
    Math.round(tassel.anchorOffset * 100),
    (v) => {
      getTassel().anchorOffset = v / 100;
    },
    rerender,
    'Position along the scabbard when attached there.'
  );
  slider(
    accTassel,
    'Tassel Length %',
    10,
    250,
    1,
    Math.round(tassel.length * 100),
    (v) => {
      getTassel().length = v / 100;
    },
    rerender,
    'Rope length as % of blade length.'
  );
  slider(
    accTassel,
    'Tassel Droop',
    0,
    1,
    0.01,
    tassel.droop,
    (v) => {
      getTassel().droop = v;
    },
    rerender,
    'Vertical sag of the tassel.'
  );
  slider(
    accTassel,
    'Tassel Sway',
    -1,
    1,
    0.01,
    tassel.sway,
    (v) => {
      getTassel().sway = v;
    },
    rerender,
    'Sideways sway (negative = left, positive = right).'
  );
  slider(
    accTassel,
    'Tassel Thickness',
    0.002,
    0.12,
    0.001,
    tassel.thickness,
    (v) => {
      getTassel().thickness = v;
    },
    rerender,
    'Rope diameter.'
  );
  slider(
    accTassel,
    'Tuft Radius',
    0.005,
    0.3,
    0.001,
    tassel.tuftSize,
    (v) => {
      getTassel().tuftSize = v;
    },
    rerender,
    'Radius of the tassel fringe bundle.'
  );
  slider(
    accTassel,
    'Tuft Length',
    0.01,
    0.6,
    0.005,
    tassel.tuftLength,
    (v) => {
      getTassel().tuftLength = v;
    },
    rerender,
    'Length of the tassel fringe.'
  );
  slider(
    accTassel,
    'Tassel Strands',
    1,
    32,
    1,
    tassel.strands,
    (v) => {
      getTassel().strands = Math.max(1, Math.round(v));
    },
    rerender,
    'Number of strands in the tassel fringe.'
  );
}
