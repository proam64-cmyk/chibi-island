export interface System {
  readonly name: string;
  update(dt: number, elapsed: number): void;
  dispose?(): void;
}
