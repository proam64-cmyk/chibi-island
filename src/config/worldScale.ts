/** World units are meters. Values from PHASE_0 §5 (decision D1). */
export const worldScale = {
  reiHeight: 1.4,
  capsuleRadius: 0.28,
  speed: { walk: 2.2, run: 4.5, sprint: 6.5 },
  jumpVelocity: 4.6,
  gravity: 13,
  /** rad/s when turning toward the move direction. */
  turnRate: 12,
  seaLevel: 0,
} as const;
