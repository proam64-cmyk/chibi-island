// Quantize + meshopt a GLB without touching textures or materials (smaller download, same look).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [inp, out] = process.argv.slice(2);
const doc = await io.read(inp);
await doc.transform(quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(out, doc);
