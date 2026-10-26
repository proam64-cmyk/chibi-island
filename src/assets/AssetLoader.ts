import { FileLoader, LoadingManager, TextureLoader } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { EventBus, GameEvents } from '../core/EventBus';
import { type AssetEntry, validateManifest } from './AssetManifest';
import { dataUrlToArrayBuffer, glbImagesToDataUris } from './glbImages';

/** Loads the manifest with real byte progress and readable errors. Missing optional assets don't stop the game. */
export class AssetLoader {
  readonly gltf = new Map<string, GLTF>();
  readonly failed: string[] = [];
  private readonly manager = new LoadingManager();
  private readonly gltfLoader: GLTFLoader;

  constructor(private bus: EventBus<GameEvents>) {
    this.gltfLoader = new GLTFLoader(this.manager);
    this.gltfLoader.setMeshoptDecoder(MeshoptDecoder); // EXT_meshopt_compression (see tools/optimize-*.mjs MESHOPT=1)
    // Decode textures through <img> + data: URIs (see glbImages.ts).
    this.gltfLoader.register((parser) => {
      parser.textureLoader = new TextureLoader(parser.options.manager);
      return { name: 'chibi_img_element_textures' };
    });
  }

  async loadAll(entries: AssetEntry[]): Promise<void> {
    const problems = validateManifest(entries);
    if (problems.length) throw new Error('Manifiesto de assets inválido:\n' + problems.join('\n'));
    const progress = new Map<string, { loaded: number; total: number }>();
    const report = (label: string) => {
      let loaded = 0, total = 0;
      for (const p of progress.values()) { loaded += p.loaded; total += p.total; }
      this.bus.emit('assets:progress', { loaded, total, label });
    };
    await Promise.all(entries.map(async (e) => {
      progress.set(e.id, { loaded: 0, total: 1 });
      try {
        const buf = await this.fetchBuffer(e.url, (loaded, total) => { progress.set(e.id, { loaded, total: Math.max(total, loaded, 1) }); report(e.label); });
        const gltf = await this.gltfLoader.parseAsync(glbImagesToDataUris(buf), '');
        this.gltf.set(e.id, gltf);
        const p = progress.get(e.id)!; progress.set(e.id, { loaded: p.total, total: p.total }); report(e.label);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.failed.push(e.id);
        progress.set(e.id, { loaded: 1, total: 1 }); report(e.label);
        this.bus.emit('assets:error', { id: e.id, url: e.url, message });
        if (e.required) throw err;
      }
    }));
    this.bus.emit('assets:done', { failed: [...this.failed] });
  }

  private fetchBuffer(url: string, onProgress: (loaded: number, total: number) => void): Promise<ArrayBuffer> {
    if (url.startsWith('data:')) {
      const buf = dataUrlToArrayBuffer(url);
      onProgress(buf.byteLength, buf.byteLength);
      return Promise.resolve(buf);
    }
    const loader = new FileLoader(this.manager);
    loader.setResponseType('arraybuffer');
    return new Promise((resolve, reject) => {
      loader.load(url, (data) => resolve(data as ArrayBuffer), (ev) => onProgress(ev.loaded, ev.total), (err) => reject(err instanceof Error ? err : new Error(`No se pudo descargar ${url}`)));
    });
  }
}
