import { describe, it, expect } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import fs from 'node:fs'
import path from 'node:path'
import { defaultSwordParams } from '../three/SwordGenerator'

describe('JSON Schema validation', () => {
  it('default export payload matches schema', () => {
    const schemaPath = path.resolve(__dirname, '../../schema/sword.schema.json')
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'))
    const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true })
    const validate = ajv.compile(schema)

    const model = defaultSwordParams()
    const materials = {
      blade: { color: '#b9c6ff', metalness: 0.8, roughness: 0.25, clearcoat: 0.0, clearcoatRoughness: 0.5, preset: 'None', bumpEnabled: false, bumpScale: 0.02, bumpNoiseScale: 8, bumpSeed: 1337 },
      guard: { color: '#8892b0', metalness: 0.6, roughness: 0.45, clearcoat: 0.0, clearcoatRoughness: 0.5, preset: 'None', bumpEnabled: false, bumpScale: 0.02, bumpNoiseScale: 8, bumpSeed: 1337 },
      handle:{ color: '#5a6b78', metalness: 0.1, roughness: 0.85, clearcoat: 0.0, clearcoatRoughness: 0.6, preset: 'None', bumpEnabled: false, bumpScale: 0.02, bumpNoiseScale: 8, bumpSeed: 1337 },
      pommel:{ color: '#9aa4b2', metalness: 0.75, roughness: 0.35, clearcoat: 0.0, clearcoatRoughness: 0.5, preset: 'None', bumpEnabled: false, bumpScale: 0.02, bumpNoiseScale: 8, bumpSeed: 1337 }
    }
    const render = { exposure: 1.0, bgColor: '#0f1115', bgBrightness: 0.0, ambient: 0.4, keyIntensity: 2.0, keyAz: 40, keyEl: 40, rimIntensity: 0.5, rimAz: -135, rimEl: 20, rimColor: '#ffffff' }
    const payload = { $schema: 'schema/sword.schema.json', version: 2, model, materials, render }
    const ok = validate(payload)
    if (!ok) console.error(validate.errors)
    expect(ok).toBe(true)
  })
})

  it('accepts thicknessProfile points on blade', () => {
    const schemaPath = path.resolve(__dirname, '../../schema/sword.schema.json')
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'))
    const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true })
    const validate = ajv.compile(schema)

    const model = defaultSwordParams()
    ;(model.blade as any).thicknessProfile = { points: [[0,1],[0.6,0.8],[1,0.5]] }
    const materials = {
      blade: { color: '#b9c6ff', metalness: 0.8, roughness: 0.25, clearcoat: 0.0, clearcoatRoughness: 0.5, preset: 'None', bumpEnabled: false, bumpScale: 0.02, bumpNoiseScale: 8, bumpSeed: 1337 },
      guard: { color: '#8892b0', metalness: 0.6, roughness: 0.45, clearcoat: 0.0, clearcoatRoughness: 0.5, preset: 'None', bumpEnabled: false, bumpScale: 0.02, bumpNoiseScale: 8, bumpSeed: 1337 },
      handle:{ color: '#5a6b78', metalness: 0.1, roughness: 0.85, clearcoat: 0.0, clearcoatRoughness: 0.6, preset: 'None', bumpEnabled: false, bumpScale: 0.02, bumpNoiseScale: 8, bumpSeed: 1337 },
      pommel:{ color: '#9aa4b2', metalness: 0.75, roughness: 0.35, clearcoat: 0.0, clearcoatRoughness: 0.5, preset: 'None', bumpEnabled: false, bumpScale: 0.02, bumpNoiseScale: 8, bumpSeed: 1337 }
    }
    const render = { exposure: 1.0, bgColor: '#0f1115', bgBrightness: 0.0, ambient: 0.4, keyIntensity: 2.0, keyAz: 40, keyEl: 40, rimIntensity: 0.5, rimAz: -135, rimEl: 20, rimColor: '#ffffff' }
    const payload = { $schema: 'schema/sword.schema.json', version: 2, model, materials, render }
    const ok = validate(payload)
    if (!ok) console.error(validate.errors)
    expect(ok).toBe(true)
  })
