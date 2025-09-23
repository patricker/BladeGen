export type Part = 'blade' | 'guard' | 'handle' | 'pommel' | 'scabbard' | 'tassel';

export const PARTS: Part[] = ['blade', 'guard', 'handle', 'pommel', 'scabbard', 'tassel'];

export type MatExt = {
  color: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  preset: string;
  bumpEnabled: boolean;
  bumpScale: number;
  bumpNoiseScale: number;
  bumpSeed: number;
  emissiveColor?: string;
  emissiveIntensity?: number;
  transmission?: number;
  ior?: number;
  thickness?: number;
  attenuationColor?: string;
  attenuationDistance?: number;
  sheen?: number;
  sheenColor?: string;
  iridescence?: number;
  iridescenceIOR?: number;
  iridescenceThicknessMin?: number;
  iridescenceThicknessMax?: number;
  envMapIntensity?: number;
  anisotropy?: number;
  anisotropyRotation?: number;
  map?: string;
  normalMap?: string;
  roughnessMap?: string;
  metalnessMap?: string;
  aoMap?: string;
  bumpMap?: string;
  displacementMap?: string;
  alphaMap?: string;
  clearcoatNormalMap?: string;
};

export type MaterialVariant = {
  id: string;
  name: string;
  description?: string;
  parts: Partial<Record<Part, MatExt>>;
};
