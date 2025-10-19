/* services/gpuAcceleration.ts
 * WebGPU-Compute für Wilson- und Schach-Stats – erweitert um gezielte Adapter-Wahl
 */

const WORKGROUP_SIZE = 64;
const WILSON_COMPONENTS = 5;
const CHESS_COMPONENTS = 2;

// ------------------------------
// Öffentliche API für die Adapter-Wahl
// ------------------------------

type GpuAdapterMode = 'auto' | 'dgpu' | 'igpu';
type GpuAdapterHint = {
  /** 'dgpu' (Standard), 'igpu' oder 'auto' */
  mode?: GpuAdapterMode;
  /** Optional: Teil-String des gewünschten GPU-Namens, z. B. "RX 6500M" */
  nameHint?: string;
};

let adapterHint: GpuAdapterHint = { mode: 'dgpu' };
export function setGpuAdapterHint(hint: GpuAdapterHint) {
  adapterHint = { ...adapterHint, ...hint };
  // Beim nächsten getDevice() wird mit neuem Hint aufgebaut.
  devicePromise = null;
  cachedAdapterInfo = null;
}

export function getGpuAdapterHint(): GpuAdapterHint {
  return { ...adapterHint };
}

type SelectedInfo = {
  name?: string;
  vendor?: string;
  architecture?: string;
  description?: string;
  modeUsed: GpuAdapterMode;
  powerPreferenceChosen?: 'high-performance' | 'low-power' | 'unknown';
};

let cachedAdapterInfo: SelectedInfo | null = null;
export function getSelectedAdapterInfo(): SelectedInfo | null {
  return cachedAdapterInfo ? { ...cachedAdapterInfo } : null;
}

export function resetGpuDevice() {
  try {
    devicePromise = null;
    wilsonPipelinePromise = null;
    chessPipelinePromise = null;
  } catch {}
}

// ------------------------------
// WGSL Shader
// ------------------------------

const WILSON_SHADER = `
@group(0) @binding(0) var<storage, read> wins: array<f32>;
@group(0) @binding(1) var<storage, read> totals: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;
const Z: f32 = 1.96;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    let length = arrayLength(&wins);
    if (idx >= length) { return; }

    let total = totals[idx];
    let baseIndex = idx * ${WILSON_COMPONENTS}u;
    if (total <= 0.0) {
        output[baseIndex] = 0.0;
        output[baseIndex + 1u] = 0.0;
        output[baseIndex + 2u] = 1.0;
        output[baseIndex + 3u] = 1.0;
        output[baseIndex + 4u] = 0.0;
        return;
    }

    let winsValue = wins[idx];
    let pHat = winsValue / total;
    let zSquared = Z * Z;
    let denominator = 1.0 + zSquared / total;
    let center = pHat + zSquared / (2.0 * total);
    let margin = Z * sqrt((pHat * (1.0 - pHat)) / total + zSquared / (4.0 * total * total));
    let lower = max(0.0, (center - margin) / denominator);
    let upper = min(1.0, (center + margin) / denominator);
    let width = upper - lower;
    let winRate = winsValue / total;
    let evidence = 0.7 * lower + 0.3 * (1.0 - min(0.5, width));

    output[baseIndex] = winRate;
    output[baseIndex + 1u] = lower;
    output[baseIndex + 2u] = upper;
    output[baseIndex + 3u] = width;
    output[baseIndex + 4u] = evidence;
}
`;

const CHESS_SHADER = `
@group(0) @binding(0) var<storage, read> wins: array<f32>;
@group(0) @binding(1) var<storage, read> losses: array<f32>;
@group(0) @binding(2) var<storage, read> draws: array<f32>;
@group(0) @binding(3) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    let length = arrayLength(&wins);
    if (idx >= length) { return; }

    let w = wins[idx];
    let l = losses[idx];
    let d = draws[idx];
    let total = w + l + d;
    let baseIndex = idx * ${CHESS_COMPONENTS}u;

    if (total <= 0.0) {
        output[baseIndex] = 0.0;
        output[baseIndex + 1u] = 0.0;
        return;
    }

    let expected = (w + d * 0.5) / total;
    let samplesPlus = total + 1.0;
    let confidence = min(1.0, (log(samplesPlus) / log(10.0)) / 2.0);

    output[baseIndex] = expected;
    output[baseIndex + 1u] = confidence;
}
`;

// ------------------------------
// Pipeline + Device Caching
// ------------------------------

let devicePromise: Promise<GPUDevice | null> | null = null;
let wilsonPipelinePromise: Promise<GPUComputePipeline | null> | null = null;
let chessPipelinePromise: Promise<GPUComputePipeline | null> | null = null;

// ------------------------------
// Adapter-Auswahl (dGPU/iGPU Name/Heuristik)
// ------------------------------

function nameLooksDiscrete(name: string) {
  const s = name.toLowerCase();
  return (
    s.includes('rtx') ||
    s.includes('gtx') ||
    s.includes('geforce') ||
    s.includes('radeon rx') ||
    s.includes(' rx ') ||
    s.includes('arc ')
  );
}

function nameLooksIntegrated(name: string) {
  const s = name.toLowerCase();
  return (
    s.includes('uhd') ||
    s.includes('iris') ||
    s.includes('intel graphics') ||
    s.includes('radeon(tm) graphics') ||
    s.includes('vega') ||
    s.endsWith(' graphics')
  );
}

async function getAdapterInfoSafe(adapter: GPUAdapter): Promise<Partial<SelectedInfo>> {
  try {
    const anyAdapter: any = adapter as any;
    if (anyAdapter?.requestAdapterInfo) {
      const info = await anyAdapter.requestAdapterInfo();
      return {
        vendor: info.vendor,
        architecture: info.architecture,
        description: info.description,
        name: info.description ?? undefined,
      };
    }
  } catch {
    // Privacy-Blocker etc. – ignorieren
  }
  return { name: undefined, description: undefined, vendor: undefined, architecture: undefined };
}

async function pickBestAdapterByHint(
  hint: GpuAdapterHint
): Promise<{ adapter: GPUAdapter | null; pref: 'high-performance' | 'low-power' | 'unknown'; info?: SelectedInfo }> {
  const haveGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
  if (!haveGPU) return { adapter: null, pref: 'unknown' };

  const [hi, lo] = await Promise.all([
    navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }),
    navigator.gpu.requestAdapter({ powerPreference: 'low-power' }),
  ]);

  const candidates: Array<{ a: GPUAdapter; pref: 'high-performance' | 'low-power' }> = [];
  if (hi) candidates.push({ a: hi, pref: 'high-performance' });
  if (lo) candidates.push({ a: lo, pref: 'low-power' });

  if (candidates.length === 0) return { adapter: null, pref: 'unknown' };

  const enriched = await Promise.all(
    candidates.map(async (c) => {
      const info = await getAdapterInfoSafe(c.a);
      const name = (info.name || info.description || '').trim();
      return { ...c, info, name };
    })
  );

  const mode: GpuAdapterMode = hint.mode ?? 'dgpu';
  const nameHint = (hint.nameHint ?? '').toLowerCase().trim();

  // 1) Name-Hint harter Treffer
  if (nameHint) {
    const exact = enriched.find((e) => (e.name ?? '').toLowerCase().includes(nameHint));
    if (exact) {
      return {
        adapter: exact.a,
        pref: exact.pref,
        info: { ...exact.info, name: exact.name, modeUsed: mode, powerPreferenceChosen: exact.pref },
      };
    }
  }

  // 2) Modus-Heuristik
  if (mode === 'dgpu') {
    const discrete = enriched.find((e) => e.name && nameLooksDiscrete(e.name));
    if (discrete) {
      return {
        adapter: discrete.a,
        pref: discrete.pref,
        info: { ...discrete.info, name: discrete.name, modeUsed: mode, powerPreferenceChosen: discrete.pref },
      };
    }
    const hiPref = enriched.find((e) => e.pref === 'high-performance') ?? enriched[0];
    return {
      adapter: hiPref.a,
      pref: hiPref.pref,
      info: { ...hiPref.info, name: hiPref.name, modeUsed: mode, powerPreferenceChosen: hiPref.pref },
    };
  }

  if (mode === 'igpu') {
    const integrated = enriched.find((e) => e.name && nameLooksIntegrated(e.name));
    if (integrated) {
      return {
        adapter: integrated.a,
        pref: integrated.pref,
        info: { ...integrated.info, name: integrated.name, modeUsed: mode, powerPreferenceChosen: integrated.pref },
      };
    }
    const loPref = enriched.find((e) => e.pref === 'low-power') ?? enriched[0];
    return {
      adapter: loPref.a,
      pref: loPref.pref,
      info: { ...loPref.info, name: loPref.name, modeUsed: mode, powerPreferenceChosen: loPref.pref },
    };
  }

  // auto → bevorzugt high-performance
  const hiPref = enriched.find((e) => e.pref === 'high-performance') ?? enriched[0];
  return {
    adapter: hiPref.a,
    pref: hiPref.pref,
    info: { ...hiPref.info, name: hiPref.name, modeUsed: mode, powerPreferenceChosen: hiPref.pref },
  };
}

// ------------------------------
// Device & Pipelines
// ------------------------------

async function getDevice(): Promise<GPUDevice | null> {
  const haveGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
  if (!haveGPU) return null;

  if (!devicePromise) {
    devicePromise = (async () => {
      try {
        const picked = await pickBestAdapterByHint(adapterHint);
        if (!picked.adapter) return null;

        const device = await picked.adapter.requestDevice();
        cachedAdapterInfo = picked.info ?? {
          modeUsed: adapterHint.mode ?? 'dgpu',
          powerPreferenceChosen: picked.pref,
        };
        return device;
      } catch (err) {
        console.warn('GPU initialisation failed, falling back to CPU.', err);
        cachedAdapterInfo = null;
        return null;
      }
    })();
  }
  return devicePromise;
}

async function getWilsonPipeline(device: GPUDevice): Promise<GPUComputePipeline | null> {
  if (!wilsonPipelinePromise) {
    wilsonPipelinePromise = (async () => {
      try {
        return device.createComputePipeline({
          layout: 'auto',
          compute: { module: device.createShaderModule({ code: WILSON_SHADER }), entryPoint: 'main' },
        });
      } catch (error) {
        console.warn('Failed to create GPU pipeline for Wilson statistics.', error);
        return null;
      }
    })();
  }
  return wilsonPipelinePromise;
}

async function getChessPipeline(device: GPUDevice): Promise<GPUComputePipeline | null> {
  if (!chessPipelinePromise) {
    chessPipelinePromise = (async () => {
      try {
        return device.createComputePipeline({
          layout: 'auto',
          compute: { module: device.createShaderModule({ code: CHESS_SHADER }), entryPoint: 'main' },
        });
      } catch (error) {
        console.warn('Failed to create GPU pipeline for chess statistics.', error);
        return null;
      }
    })();
  }
  return chessPipelinePromise;
}

function createBuffer(device: GPUDevice, array: Float32Array, usage: GPUBufferUsageFlags): GPUBuffer {
  const buffer = device.createBuffer({ size: array.byteLength, usage, mappedAtCreation: false });
  device.queue.writeBuffer(buffer, 0, array.buffer, array.byteOffset, array.byteLength);
  return buffer;
}

async function readBuffer(device: GPUDevice, source: GPUBuffer, size: number): Promise<Float32Array> {
  const readBuffer = device.createBuffer({ size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(source, 0, readBuffer, 0, size);
  device.queue.submit([encoder.finish()]);
  await device.queue.onSubmittedWorkDone();
  await readBuffer.mapAsync(GPUMapMode.READ);
  const copy = new Float32Array(readBuffer.getMappedRange().slice(0));
  readBuffer.unmap();
  readBuffer.destroy();
  return copy;
}

// ------------------------------
// Öffentliche Compute-Funktionen
// ------------------------------

export async function computeWilsonStatsGpu(
  wins: Float32Array,
  totals: Float32Array
): Promise<Float32Array | null> {
  if (wins.length === 0 || wins.length !== totals.length) return null;
  const device = await getDevice();
  if (!device) return null;

  const pipeline = await getWilsonPipeline(device);
  if (!pipeline) return null;

  const outputSize = wins.length * WILSON_COMPONENTS * 4;
  const winsBuffer = createBuffer(device, wins, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
  const totalsBuffer = createBuffer(device, totals, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
  const outputBuffer = device.createBuffer({ size: outputSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: winsBuffer } },
      { binding: 1, resource: { buffer: totalsBuffer } },
      { binding: 2, resource: { buffer: outputBuffer } },
    ],
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(wins.length / WORKGROUP_SIZE));
  pass.end();

  device.queue.submit([encoder.finish()]);
  await device.queue.onSubmittedWorkDone();

  const result = await readBuffer(device, outputBuffer, outputSize);

  winsBuffer.destroy();
  totalsBuffer.destroy();
  outputBuffer.destroy();

  return result;
}

export async function computeChessMoveStatsGpu(
  wins: Float32Array,
  losses: Float32Array,
  draws: Float32Array
): Promise<Float32Array | null> {
  if (wins.length === 0 || wins.length !== losses.length || wins.length !== draws.length) return null;
  const device = await getDevice();
  if (!device) return null;

  const pipeline = await getChessPipeline(device);
  if (!pipeline) return null;

  const outputSize = wins.length * CHESS_COMPONENTS * 4;
  const winsBuffer = createBuffer(device, wins, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
  const lossesBuffer = createBuffer(device, losses, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
  const drawsBuffer = createBuffer(device, draws, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
  const outputBuffer = device.createBuffer({ size: outputSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: winsBuffer } },
      { binding: 1, resource: { buffer: lossesBuffer } },
      { binding: 2, resource: { buffer: drawsBuffer } },
      { binding: 3, resource: { buffer: outputBuffer } },
    ],
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(wins.length / WORKGROUP_SIZE));
  pass.end();

  device.queue.submit([encoder.finish()]);
  await device.queue.onSubmittedWorkDone();

  const result = await readBuffer(device, outputBuffer, outputSize);

  winsBuffer.destroy();
  lossesBuffer.destroy();
  drawsBuffer.destroy();
  outputBuffer.destroy();

  return result;
}
