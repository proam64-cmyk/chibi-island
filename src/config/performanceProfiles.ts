export type QualityProfileId = 'high' | 'medium' | 'low';

export interface QualityProfile {
  id: QualityProfileId;
  maxPixelRatio: number;
  shadowMapSize: number;
  /** Side of the square area around the player that receives real-time shadows (m). */
  shadowArea: number;
  /** Grid cells per 200 m terrain chunk at full detail (power of two, divisible by 8). */
  terrainSegments: number;
  antialias: boolean;
  /** 0..1 multiplier for vegetation density. */
  vegetationDensity: number;
}

export const qualityProfiles: Record<QualityProfileId, QualityProfile> = {
  high: { id: 'high', maxPixelRatio: 2, shadowMapSize: 2048, shadowArea: 60, terrainSegments: 96, antialias: true, vegetationDensity: 1 },
  medium: { id: 'medium', maxPixelRatio: 1.5, shadowMapSize: 2048, shadowArea: 50, terrainSegments: 64, antialias: true, vegetationDensity: 0.7 },
  low: { id: 'low', maxPixelRatio: 1.25, shadowMapSize: 1024, shadowArea: 40, terrainSegments: 64, antialias: false, vegetationDensity: 0.45 },
};

/** Coarse first guess; the player will be able to change it in settings (Phase 10). */
export function detectProfile(nav: { userAgent: string; hardwareConcurrency?: number }): QualityProfileId {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(nav.userAgent);
  if (mobile) return (nav.hardwareConcurrency ?? 4) >= 8 ? 'medium' : 'low';
  return 'high';
}
