import { describe, it, expect } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import fs from 'node:fs';
import path from 'node:path';
import { defaultSwordParams, type GuardStyle, type PommelStyle } from '../three/SwordGenerator';

describe('JSON Schema validation', () => {
  it('default export payload matches schema', () => {
    const schemaPath = path.resolve(__dirname, '../../schema/sword.schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
    const validate = ajv.compile(schema);

    const model = defaultSwordParams();
    const materials = {
      blade: {
        color: '#b9c6ff',
        metalness: 0.8,
        roughness: 0.25,
        clearcoat: 0.0,
        clearcoatRoughness: 0.5,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.02,
        bumpNoiseScale: 8,
        bumpSeed: 1337,
      },
      guard: {
        color: '#8892b0',
        metalness: 0.6,
        roughness: 0.45,
        clearcoat: 0.0,
        clearcoatRoughness: 0.5,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.02,
        bumpNoiseScale: 8,
        bumpSeed: 1337,
      },
      handle: {
        color: '#5a6b78',
        metalness: 0.1,
        roughness: 0.85,
        clearcoat: 0.0,
        clearcoatRoughness: 0.6,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.02,
        bumpNoiseScale: 8,
        bumpSeed: 1337,
      },
      pommel: {
        color: '#9aa4b2',
        metalness: 0.75,
        roughness: 0.35,
        clearcoat: 0.0,
        clearcoatRoughness: 0.5,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.02,
        bumpNoiseScale: 8,
        bumpSeed: 1337,
      },
      scabbard: {
        color: '#3a2c1c',
        metalness: 0.2,
        roughness: 0.65,
        clearcoat: 0.05,
        clearcoatRoughness: 0.7,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.015,
        bumpNoiseScale: 9,
        bumpSeed: 1337,
      },
      tassel: {
        color: '#7c3f1d',
        metalness: 0.05,
        roughness: 0.8,
        clearcoat: 0.0,
        clearcoatRoughness: 0.7,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.01,
        bumpNoiseScale: 10,
        bumpSeed: 777,
        sheen: 0.35,
        sheenColor: '#d8a273',
      },
    };
    const render = {
      exposure: 1.0,
      bgColor: '#0f1115',
      bgBrightness: 0.0,
      ambient: 0.4,
      keyIntensity: 2.0,
      keyAz: 40,
      keyEl: 40,
      rimIntensity: 0.5,
      rimAz: -135,
      rimEl: 20,
      rimColor: '#ffffff',
      envMapIntensity: 1.0,
    };
    const payload = { $schema: 'schema/sword.schema.json', version: 5, model, materials, render };
    const ok = validate(payload);
    if (!ok) console.error(validate.errors);
    expect(ok).toBe(true);
  });

  it('accepts material variants', () => {
    const schemaPath = path.resolve(__dirname, '../../schema/sword.schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
    const validate = ajv.compile(schema);

    const model = defaultSwordParams();
    const baseMaterial = {
      color: '#b9c6ff',
      metalness: 0.8,
      roughness: 0.25,
      clearcoat: 0.0,
      clearcoatRoughness: 0.5,
      preset: 'None',
      bumpEnabled: false,
      bumpScale: 0.02,
      bumpNoiseScale: 8,
      bumpSeed: 1337,
    };
    const materials: any = {
      blade: baseMaterial,
      guard: baseMaterial,
      handle: baseMaterial,
      pommel: baseMaterial,
      scabbard: baseMaterial,
      tassel: baseMaterial,
      variants: [
        {
          id: 'variant-test',
          name: 'Gilt Trim',
          description: 'Gold guard and pommel with polished blade',
          parts: {
            blade: { ...baseMaterial, color: '#e8efff', metalness: 1.0, roughness: 0.18 },
            guard: { ...baseMaterial, color: '#c9a12c', metalness: 1.0, roughness: 0.22 },
            pommel: { ...baseMaterial, color: '#c9a12c', metalness: 1.0, roughness: 0.22 },
            scabbard: { ...baseMaterial, color: '#3a2c1c', roughness: 0.6 },
            tassel: { ...baseMaterial, color: '#7c3f1d', roughness: 0.78 },
          },
        },
      ],
    };
    const render = {
      exposure: 1.0,
      bgColor: '#0f1115',
      bgBrightness: 0.0,
      ambient: 0.4,
      keyIntensity: 2.0,
      keyAz: 40,
      keyEl: 40,
      rimIntensity: 0.5,
      rimAz: -135,
      rimEl: 20,
      rimColor: '#ffffff',
      envMapIntensity: 1.0,
    };
    const payload = { $schema: 'schema/sword.schema.json', version: 5, model, materials, render };
    const ok = validate(payload);
    if (!ok) console.error(validate.errors);
    expect(ok).toBe(true);
  });

  it('accepts fullerMode="none" with fullers disabled', () => {
    const schemaPath = path.resolve(__dirname, '../../schema/sword.schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
    const validate = ajv.compile(schema);

    const model = defaultSwordParams();
    (model.blade as any).fullerMode = 'none';
    (model.blade as any).fullerEnabled = false;
    const materials = {
      blade: {
        color: '#b9c6ff',
        metalness: 0.8,
        roughness: 0.25,
        clearcoat: 0.0,
        clearcoatRoughness: 0.5,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.02,
        bumpNoiseScale: 8,
        bumpSeed: 1337,
      },
      guard: {
        color: '#8892b0',
        metalness: 0.6,
        roughness: 0.45,
        clearcoat: 0.0,
        clearcoatRoughness: 0.5,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.02,
        bumpNoiseScale: 8,
        bumpSeed: 1337,
      },
      handle: {
        color: '#5a6b78',
        metalness: 0.1,
        roughness: 0.85,
        clearcoat: 0.0,
        clearcoatRoughness: 0.6,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.02,
        bumpNoiseScale: 8,
        bumpSeed: 1337,
      },
      pommel: {
        color: '#9aa4b2',
        metalness: 0.75,
        roughness: 0.35,
        clearcoat: 0.0,
        clearcoatRoughness: 0.5,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.02,
        bumpNoiseScale: 8,
        bumpSeed: 1337,
      },
      scabbard: {
        color: '#3a2c1c',
        metalness: 0.2,
        roughness: 0.65,
        clearcoat: 0.05,
        clearcoatRoughness: 0.7,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.015,
        bumpNoiseScale: 9,
        bumpSeed: 1337,
      },
      tassel: {
        color: '#7c3f1d',
        metalness: 0.05,
        roughness: 0.8,
        clearcoat: 0.0,
        clearcoatRoughness: 0.7,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.01,
        bumpNoiseScale: 10,
        bumpSeed: 777,
        sheen: 0.35,
        sheenColor: '#d8a273',
      },
    };
    const render = {
      exposure: 1.0,
      bgColor: '#0f1115',
      bgBrightness: 0.0,
      ambient: 0.4,
      keyIntensity: 2.0,
      keyAz: 40,
      keyEl: 40,
      rimIntensity: 0.5,
      rimAz: -135,
      rimEl: 20,
      rimColor: '#ffffff',
      envMapIntensity: 1.0,
    };
    const payload = { $schema: 'schema/sword.schema.json', version: 5, model, materials, render };
    const ok = validate(payload);
    if (!ok) console.error(validate.errors);
    expect(ok).toBe(true);
  });
  it('accepts thicknessProfile points on blade', () => {
    const schemaPath = path.resolve(__dirname, '../../schema/sword.schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
    const validate = ajv.compile(schema);

    const model = defaultSwordParams();
    (model.blade as any).thicknessProfile = {
      points: [
        [0, 1],
        [0.6, 0.8],
        [1, 0.5],
      ],
    };
    (model.blade as any).curveProfile = {
      mode: 'absolute',
      scale: 1,
      points: [
        [0, 0],
        [0.5, 0.1],
        [1, 0.2],
      ],
    };
    (model.blade as any).widthProfile = {
      mode: 'scale',
      points: [
        [0, 1],
        [0.5, 0.8],
        [1, 1.2],
      ],
    };
    const materials = {
      blade: {
        color: '#b9c6ff',
        metalness: 0.8,
        roughness: 0.25,
        clearcoat: 0.0,
        clearcoatRoughness: 0.5,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.02,
        bumpNoiseScale: 8,
        bumpSeed: 1337,
      },
      guard: {
        color: '#8892b0',
        metalness: 0.6,
        roughness: 0.45,
        clearcoat: 0.0,
        clearcoatRoughness: 0.5,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.02,
        bumpNoiseScale: 8,
        bumpSeed: 1337,
      },
      handle: {
        color: '#5a6b78',
        metalness: 0.1,
        roughness: 0.85,
        clearcoat: 0.0,
        clearcoatRoughness: 0.6,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.02,
        bumpNoiseScale: 8,
        bumpSeed: 1337,
      },
      pommel: {
        color: '#9aa4b2',
        metalness: 0.75,
        roughness: 0.35,
        clearcoat: 0.0,
        clearcoatRoughness: 0.5,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.02,
        bumpNoiseScale: 8,
        bumpSeed: 1337,
      },
      scabbard: {
        color: '#3a2c1c',
        metalness: 0.2,
        roughness: 0.65,
        clearcoat: 0.05,
        clearcoatRoughness: 0.7,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.015,
        bumpNoiseScale: 9,
        bumpSeed: 1337,
      },
      tassel: {
        color: '#7c3f1d',
        metalness: 0.05,
        roughness: 0.8,
        clearcoat: 0.0,
        clearcoatRoughness: 0.7,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.01,
        bumpNoiseScale: 10,
        bumpSeed: 777,
        sheen: 0.35,
        sheenColor: '#d8a273',
      },
    };
    const render = {
      exposure: 1.0,
      bgColor: '#0f1115',
      bgBrightness: 0.0,
      ambient: 0.4,
      keyIntensity: 2.0,
      keyAz: 40,
      keyEl: 40,
      rimIntensity: 0.5,
      rimAz: -135,
      rimEl: 20,
      rimColor: '#ffffff',
      envMapIntensity: 1.0,
    };
    const payload = { $schema: 'schema/sword.schema.json', version: 5, model, materials, render };
    const ok = validate(payload);
    if (!ok) console.error(validate.errors);
    expect(ok).toBe(true);
  });

  it('accepts advanced fullers and waviness fields', () => {
    const schemaPath = path.resolve(__dirname, '../../schema/sword.schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
    const validate = ajv.compile(schema);

    const model = defaultSwordParams();
    model.blade.waviness = {
      amplitude: 0.02,
      frequency: 5,
      mode: 'both',
      taper: 1.2,
      offset: 0.01,
      phase: Math.PI / 2,
    };
    model.blade.hollowGrind = { enabled: true, mix: 0.7, depth: 0.5, radius: 0.8, bias: 0.1 };
    model.blade.fullers = [
      {
        side: 'both',
        offsetFromSpine: 0,
        width: 0.05,
        depth: 0.01,
        inset: 0.006,
        start: 0.1,
        end: 0.7,
        profile: 'u',
        mode: 'overlay',
        taper: 0.2,
      },
      {
        side: 'right',
        offsetFromSpine: 0.04,
        width: 0.03,
        depth: 0.015,
        inset: 0.01,
        start: 0.2,
        end: 0.6,
        profile: 'v',
        mode: 'carve',
        taper: 0.1,
      },
    ] as any;
    model.guard.style = 'shell';
    (model.guard as any).shellCoverage = 0.8;
    (model.guard as any).shellThickness = 1.1;
    (model.guard as any).shellFlare = 1.2;
    (model.guard as any).langets = {
      enabled: true,
      length: 0.15,
      width: 0.05,
      thickness: 0.012,
      chamfer: 0.1,
    };
    (model.guard as any).pasDaneCount = 2;
    (model.guard as any).pasDaneRadius = 0.06;
    (model.guard as any).pasDaneThickness = 0.01;
    (model.guard as any).pasDaneOffsetY = -0.015;
    model.handle.wrapStyle = 'hineri' as any;
    (model.handle as any).rayskin = { enabled: true, scale: 0.01, intensity: 0.6 };
    (model.handle as any).menukiPreset = 'katana';
    model.pommel.style = 'fishtail';
    (model.pommel as any).peenVisible = true;
    (model.pommel as any).peenSize = 0.02;
    (model.pommel as any).peenShape = 'block';
    const materials = {
      blade: {
        color: '#b9c6ff',
        metalness: 0.8,
        roughness: 0.25,
        clearcoat: 0.0,
        clearcoatRoughness: 0.5,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.02,
        bumpNoiseScale: 8,
        bumpSeed: 1337,
      },
      guard: {
        color: '#8892b0',
        metalness: 0.6,
        roughness: 0.45,
        clearcoat: 0.0,
        clearcoatRoughness: 0.5,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.02,
        bumpNoiseScale: 8,
        bumpSeed: 1337,
      },
      handle: {
        color: '#5a6b78',
        metalness: 0.1,
        roughness: 0.85,
        clearcoat: 0.0,
        clearcoatRoughness: 0.6,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.02,
        bumpNoiseScale: 8,
        bumpSeed: 1337,
      },
      pommel: {
        color: '#9aa4b2',
        metalness: 0.75,
        roughness: 0.35,
        clearcoat: 0.0,
        clearcoatRoughness: 0.5,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.02,
        bumpNoiseScale: 8,
        bumpSeed: 1337,
      },
      scabbard: {
        color: '#3a2c1c',
        metalness: 0.2,
        roughness: 0.65,
        clearcoat: 0.05,
        clearcoatRoughness: 0.7,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.015,
        bumpNoiseScale: 9,
        bumpSeed: 1337,
      },
      tassel: {
        color: '#7c3f1d',
        metalness: 0.05,
        roughness: 0.8,
        clearcoat: 0.0,
        clearcoatRoughness: 0.7,
        preset: 'None',
        bumpEnabled: false,
        bumpScale: 0.01,
        bumpNoiseScale: 10,
        bumpSeed: 777,
        sheen: 0.35,
        sheenColor: '#d8a273',
      },
    };
    const render = {
      exposure: 1.0,
      bgColor: '#0f1115',
      bgBrightness: 0.0,
      ambient: 0.4,
      keyIntensity: 2.0,
      keyAz: 40,
      keyEl: 40,
      rimIntensity: 0.5,
      rimAz: -135,
      rimEl: 20,
      rimColor: '#ffffff',
      envMapIntensity: 1.0,
    };
    const payload = { $schema: 'schema/sword.schema.json', version: 5, model, materials, render };
    const ok = validate(payload);
    if (!ok) console.error(validate.errors);
    expect(ok).toBe(true);
  });

  it('accepts guard, handle, and pommel style combinations', () => {
    const schemaPath = path.resolve(__dirname, '../../schema/sword.schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
    const validate = ajv.compile(schema);

    const guardStyles: GuardStyle[] = [
      'bar',
      'winged',
      'claw',
      'disk',
      'basket',
      'knucklebow',
      'swept',
      'shell',
    ];
    const wrapStyles = ['none', 'crisscross', 'hineri', 'katate', 'wire'] as const;
    const pommelStyles: PommelStyle[] = [
      'orb',
      'disk',
      'spike',
      'wheel',
      'scentStopper',
      'ring',
      'crown',
      'fishtail',
    ];

    const baseMaterial = {
      color: '#b9c6ff',
      metalness: 0.8,
      roughness: 0.25,
      clearcoat: 0.0,
      clearcoatRoughness: 0.5,
      preset: 'None',
      bumpEnabled: false,
      bumpScale: 0.02,
      bumpNoiseScale: 8,
      bumpSeed: 1337,
    };
    const makeMaterials = () => ({
      blade: { ...baseMaterial },
      guard: { ...baseMaterial },
      handle: { ...baseMaterial },
      pommel: { ...baseMaterial },
      scabbard: { ...baseMaterial },
      tassel: { ...baseMaterial },
    });
    const render = {
      exposure: 1.0,
      bgColor: '#0f1115',
      bgBrightness: 0.0,
      ambient: 0.4,
      keyIntensity: 2.0,
      keyAz: 40,
      keyEl: 40,
      rimIntensity: 0.5,
      rimAz: -135,
      rimEl: 20,
      rimColor: '#ffffff',
    };

    for (const guardStyle of guardStyles) {
      for (const wrapStyle of wrapStyles) {
        for (const pommelStyle of pommelStyles) {
          const model = defaultSwordParams();
          model.guard.style = guardStyle;
          model.handle.wrapStyle = wrapStyle as typeof model.handle.wrapStyle;
          model.handle.wrapEnabled = wrapStyle !== 'none';
          model.pommel.style = pommelStyle;

          const materials = makeMaterials();
          const payload = {
            $schema: 'schema/sword.schema.json',
            version: 5,
            model,
            materials,
            render,
          };
          const ok = validate(payload);
          if (!ok) {
            console.error(
              'Schema validation failed for',
              { guardStyle, wrapStyle, pommelStyle },
              validate.errors
            );
          }
          expect(ok).toBe(true);
        }
      }
    }
  });
});
