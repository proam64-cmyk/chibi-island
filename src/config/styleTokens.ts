/**
 * STYLE_BIBLE v1.1 as code. Every color, light and camera value used by the game
 * must come from here, so a visual change always shows up as a diff of this file.
 */
export const palette = {
  sky: { zenith: '#4FA8F0', horizon: '#BFE6FF' },
  cloud: { light: '#FFFFFF', shadow: '#C9D6F2' },
  water: { deep: '#0B5FA8', mid: '#1E9BD7', shallow: '#3FD6D0', foam: '#F4FBFF' },
  sand: { dry: '#F3DDB0', wet: '#D9BC8A' },
  grass: { lit: '#6CC25A', shade: '#3E8C4A' },
  foliage: { highlight: '#A6E06A' },
  sakura: { light: '#F7B6D2', deep: '#E98BB5' },
  rock: { lit: '#8A8F9C', shade: '#5B6070' },
  snow: { lit: '#F4F8FF', shade: '#B8C8EE' },
  asphalt: '#4A4E58',
  roadline: { white: '#F2F2E6', yellow: '#F2C14E' },
  paving: { warm: '#C9B79C' },
  wood: { warm: '#9A6A43' },
  roof: { slate: '#4B5A7A', red: '#8C3B3B' },
  lantern: { glow: '#FF9A3C' },
  accent: { neon: '#FF4FA3' },
  shadowTint: '#3A3F6B',
  rei: { hair: '#8C0ABD', hairShadow: '#350C53', skin: '#FBD9C9' },
} as const;

export const lighting = {
  sun: { color: '#FFF4E0', intensity: 2.5, elevationDeg: 52, azimuthDeg: 135 },
  hemi: { sky: '#BFE6FF', ground: '#8FBF6A', intensity: 0.9 },
  exposure: 1.0,
  fog: { color: '#BFE6FF', density: 0.0009 },
} as const;

export const shadows = {
  bias: -0.0005,
  normalBias: 0.02,
} as const;

export const toon = {
  /** Gradient ramps (0–255): 3 tones for characters, 4 for environment. */
  rampCharacter: [118, 196, 255],
  rampEnvironment: [105, 160, 212, 255],
  /** Buildings (2026-10-25, user reported grey stains): brighter shade bands, and shaded walls keep their own
   *  colour instead of taking the green/blue tint of the sky/grass light (anime facades never go grey). */
  rampBuilding: [150, 196, 232, 255],
  buildingShadeFloor: 0.66,
  buildingNeutralShade: 0.75,
  rimCharacter: 0.35,
  rimEnvironment: 0.18,
  rimBuilding: 0.1,
  normalScaleCharacter: 0.5,
  outlineCharacter: { width: 0.006, color: '#2A0B3D' },
} as const;

export const cameraTokens = {
  fovDeg: 50,
  near: 0.1,
  far: 2500,
  distance: { default: 5.5, min: 2.5, max: 9 },
  lookAtHeight: 1.1,
  pitchDeg: { default: 18, min: -10, max: 70 },
  /** Seconds for the camera to settle on its target (critically damped). */
  followDamping: 0.12,
  collisionRadius: 0.25,
  /** Seconds without camera input before the camera eases back behind a moving character. */
  recenterDelay: 1.5,
} as const;
