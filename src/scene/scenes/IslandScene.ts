import { FogExp2, Group, Scene } from 'three';
import { lighting } from '../../config/styleTokens';
import type { QualityProfile } from '../../config/performanceProfiles';
import { createSky } from '../../render/Sky';
import { Lighting } from '../../render/Lighting';
import { StylizedOcean } from '../../world/ocean/StylizedOcean';
import { buildIslandTerrain, type TerrainBuildStats } from '../../world/island/IslandTerrain';
import { DistrictMarkers } from '../../world/island/DistrictMarkers';
import { beachiness, coastDistance, groundHeight, roadRaster, sandAmount } from '../../world/island/islandHeight';
import { districts, islandBounds, stadiumPlacement } from '../../config/islandPlan';
import { buildings } from '../../config/buildings';
import { toToonMaterial } from '../../render/materials/ToonMaterial';
import type { Mesh } from 'three';
import { placeBuilding } from '../../world/buildings/placeBuilding';
import type { PhysicsWorld } from '../../physics/PhysicsWorld';
import { createRoadNetwork } from '../../world/roads/RoadNetwork';
import { sampleRoad } from '../../world/roads/roadRaster';
import { scatterVegetation } from '../../world/vegetation/scatter';
import { Vegetation } from '../../world/vegetation/Vegetation';
import { islandHeight } from '../../world/island/islandHeight';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Phase 2 scene: island terrain, stylized ocean and debug district markers. */
export class IslandScene {
  readonly scene = new Scene();
  readonly sky = createSky();
  readonly lighting: Lighting;
  readonly markers = new DistrictMarkers();
  readonly ocean = new StylizedOcean();
  /** Walkable ground (terrain with roads cut in, plus bridge decks). */
  readonly heightAt = (x: number, z: number) => groundHeight(x, z);
  vegetation: Vegetation | null = null;
  /** Solid objects (Hito A). Set before addBuildings / addVegetation. */
  physics: PhysicsWorld | null = null;
  terrain: Group | null = null;
  stats: TerrainBuildStats | null = null;

  constructor(private profile: QualityProfile) {
    this.scene.fog = new FogExp2(lighting.fog.color, lighting.fog.density);
    this.scene.add(this.sky, this.ocean.mesh, this.markers.group);
    this.lighting = new Lighting(this.scene, profile);
  }

  async build(onProgress?: (done: number, total: number) => void): Promise<void> {
    const { group, stats } = await buildIslandTerrain(this.profile.terrainSegments, onProgress);
    this.terrain = group; this.stats = stats;
    this.scene.add(group, createRoadNetwork(roadRaster()));
  }

  /** Places the baseball stadium model on its plateau (toon materials, shadows). */
  addStadium(gltf: GLTF): void {
    const sp = stadiumPlacement;
    const root = gltf.scene;
    root.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.material = toToonMaterial(Array.isArray(m.material) ? m.material[0] : m.material, 'environment');
      m.castShadow = true; m.receiveShadow = true;
    });
    root.position.set(sp.x, islandHeight(sp.x, sp.z), sp.z);
    root.rotation.y = sp.rotationY;
    root.name = 'Stadium';
    this.scene.add(root);
  }

  /** Places the buildings of config/buildings.ts whose GLB loaded (toon, shadows, front toward the district center). */
  addBuildings(get: (assetId: string) => GLTF | undefined): number {
    let placed = 0;
    for (const b of buildings) {
      const gltf = get(b.asset), d = districts.find((q) => q.id === b.district);
      if (!gltf || !d) continue;
      const x = d.x + b.dx, z = d.z + b.dz;
      const src = b.node ? gltf.scene.getObjectByName(b.node) : gltf.scene;
      if (!src) { console.warn('[buildings] node not found', b.node); continue; }
      // Sunk by the thickness of Meshy's stone base (≈ 12 cm) so it sits flush with the grass instead of showing a grey ledge.
      const root = placeBuilding(src, x, islandHeight(x, z) - (b.baseSink ?? 0.12), z, Math.atan2((b.faceX ?? d.x) - x, (b.faceZ ?? d.z) - z));
      root.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        m.material = toToonMaterial(Array.isArray(m.material) ? m.material[0] : m.material, 'building');
        m.castShadow = true; m.receiveShadow = true;
      });
      root.name = b.id;
      this.scene.add(root);
      this.physics?.addTrimesh(root);
      placed++;
    }
    return placed;
  }

  /** Scatters palms, sakura, round trees and bushes (call after the vegetation GLBs are loaded). */
  addVegetation(assets: { palm?: GLTF; sakura?: GLTF }): void {
    const r = roadRaster();
    const placements = scatterVegetation({
      height: islandHeight, coast: coastDistance, beach: beachiness, sand: sandAmount,
      road: (x, z) => { const s = sampleRoad(r, x, z); return s.bridge ? 1 : s.weight; },
      bounds: islandBounds, density: this.profile.vegetationDensity,
    });
    this.vegetation = new Vegetation(placements, assets);
    // Tree trunks are solid (bushes are not): palm 0.3 m, sakura 0.35 m, round tree 0.32 m × instance scale.
    if (this.physics) for (const [type, r] of [['palm', 0.3], ['sakura', 0.35], ['tree', 0.32]] as const)
      for (const it of placements[type]) this.physics.addCylinder(it.x, it.y, it.z, r * it.scale, 3.5);
    this.scene.add(this.vegetation.group);
  }
}

