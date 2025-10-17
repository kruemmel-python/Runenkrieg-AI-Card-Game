const WORKGROUP_SIZE = 64;
const WILSON_COMPONENTS = 5;
const CHESS_COMPONENTS = 2;

const WILSON_SHADER = `
@group(0) @binding(0) var<storage, read> wins: array<f32>;
@group(0) @binding(1) var<storage, read> totals: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;
const Z: f32 = 1.96;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    let length = arrayLength(&wins);
    if (idx >= length) {
        return;
    }
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
    if (idx >= length) {
        return;
    }
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

let devicePromise: Promise<GPUDevice | null> | null = null;
let wilsonPipelinePromise: Promise<GPUComputePipeline | null> | null = null;
let chessPipelinePromise: Promise<GPUComputePipeline | null> | null = null;

async function getDevice(): Promise<GPUDevice | null> {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
        return null;
    }
    if (!devicePromise) {
        devicePromise = (async () => {
            try {
                const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
                if (!adapter) {
                    return null;
                }
                return await adapter.requestDevice();
            } catch (error) {
                console.warn('GPU initialisation failed, falling back to CPU.', error);
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
                    compute: {
                        module: device.createShaderModule({ code: WILSON_SHADER }),
                        entryPoint: 'main',
                    },
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
                    compute: {
                        module: device.createShaderModule({ code: CHESS_SHADER }),
                        entryPoint: 'main',
                    },
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
    const buffer = device.createBuffer({
        size: array.byteLength,
        usage,
        mappedAtCreation: false,
    });
    device.queue.writeBuffer(buffer, 0, array.buffer, array.byteOffset, array.byteLength);
    return buffer;
}

async function readBuffer(device: GPUDevice, source: GPUBuffer, size: number): Promise<Float32Array> {
    const readBuffer = device.createBuffer({
        size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

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

export async function computeWilsonStatsGpu(
    wins: Float32Array,
    totals: Float32Array
): Promise<Float32Array | null> {
    if (wins.length === 0 || wins.length !== totals.length) {
        return null;
    }
    const device = await getDevice();
    if (!device) {
        return null;
    }
    const pipeline = await getWilsonPipeline(device);
    if (!pipeline) {
        return null;
    }

    const outputSize = wins.length * WILSON_COMPONENTS * 4;
    const winsBuffer = createBuffer(device, wins, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    const totalsBuffer = createBuffer(device, totals, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    const outputBuffer = device.createBuffer({
        size: outputSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

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
    if (wins.length === 0 || wins.length !== losses.length || wins.length !== draws.length) {
        return null;
    }
    const device = await getDevice();
    if (!device) {
        return null;
    }
    const pipeline = await getChessPipeline(device);
    if (!pipeline) {
        return null;
    }

    const outputSize = wins.length * CHESS_COMPONENTS * 4;
    const winsBuffer = createBuffer(device, wins, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    const lossesBuffer = createBuffer(device, losses, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    const drawsBuffer = createBuffer(device, draws, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    const outputBuffer = device.createBuffer({
        size: outputSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

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
