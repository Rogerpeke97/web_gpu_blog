const positionAttributeNum  = 0;
const colorAttributeNum     = 1;
const transformBindingNum   = 0;
const bindGroupIndex        = 0;
const colorLocation         = 0;

const shader = `
struct FragmentData {
    [[builtin(position)]] position: vec4<f32>;
    [[location(${colorLocation})]] color: vec4<f32>;
};

[[block]]
struct Uniforms {
    modelViewProjectionMatrix: mat4x4<f32>;
};

[[group(${bindGroupIndex}), binding(${transformBindingNum})]] var<uniform> uniforms;

[[stage(vertex)]]
fn main(
    [[location(${positionAttributeNum})]] position: vec4<f32>
    [[location(${colorAttributeNum})]] color: vec4<f32>,
) -> FragmentData {
    FragmentData out;
    out.position = mul(uniforms.modelViewProjectionMatrix[0], position);
    out.color = color;
    return out;
}

[[stage(fragment)]]
fn main(data: FragmentData) -> [[location(0)]] vec4<f32> {
    return data.color;
}
`;

let device, swapChain, verticesBuffer, bindGroupLayout, pipeline, renderPassDescriptor;
let projectionMatrix = mat4.create();
let mappedGroups = [];

const colorOffset = 4 * 4;
const vertexSize = 4 * 8;
const verticesArray = new Float32Array([
    // float4 position, float4 color
    1, -1, 1, 1, 1, 0, 1, 1,
    -1, -1, 1, 1, 0, 0, 1, 1,
    -1, -1, -1, 1, 0, 0, 0, 1,
    1, -1, -1, 1, 1, 0, 0, 1,
    1, -1, 1, 1, 1, 0, 1, 1,
    -1, -1, -1, 1, 0, 0, 0, 1,

    1, 1, 1, 1, 1, 1, 1, 1,
    1, -1, 1, 1, 1, 0, 1, 1,
    1, -1, -1, 1, 1, 0, 0, 1,
    1, 1, -1, 1, 1, 1, 0, 1,
    1, 1, 1, 1, 1, 1, 1, 1,
    1, -1, -1, 1, 1, 0, 0, 1,

    -1, 1, 1, 1, 0, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, -1, 1, 1, 1, 0, 1,
    -1, 1, -1, 1, 0, 1, 0, 1,
    -1, 1, 1, 1, 0, 1, 1, 1,
    1, 1, -1, 1, 1, 1, 0, 1,

    -1, -1, 1, 1, 0, 0, 1, 1,
    -1, 1, 1, 1, 0, 1, 1, 1,
    -1, 1, -1, 1, 0, 1, 0, 1,
    -1, -1, -1, 1, 0, 0, 0, 1,
    -1, -1, 1, 1, 0, 0, 1, 1,
    -1, 1, -1, 1, 0, 1, 0, 1,

    1, 1, 1, 1, 1, 1, 1, 1,
    -1, 1, 1, 1, 0, 1, 1, 1,
    -1, -1, 1, 1, 0, 0, 1, 1,
    -1, -1, 1, 1, 0, 0, 1, 1,
    1, -1, 1, 1, 1, 0, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1,

    1, -1, -1, 1, 1, 0, 0, 1,
    -1, -1, -1, 1, 0, 0, 0, 1,
    -1, 1, -1, 1, 0, 1, 0, 1,
    1, 1, -1, 1, 1, 1, 0, 1,
    1, -1, -1, 1, 1, 0, 0, 1,
    -1, 1, -1, 1, 0, 1, 0, 1,
]);

async function init() {
    const adapter = await navigator.gpu.requestAdapter();
    device = await adapter.requestDevice();

    const canvas = document.querySelector('canvas');
    let canvasSize = canvas.getBoundingClientRect();
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    const aspect = Math.abs(canvas.width / canvas.height);
    mat4.perspective(projectionMatrix, (2 * Math.PI) / 5, aspect, 1, 100.0);

    const context = canvas.getContext('gpupresent');

    console.log(await device);
    console.log(device);

    const swapChainDescriptor = {
        device: device,
        format: "bgra8unorm",
        usage: 0x10
    };
    swapChain = context.configureSwapChain(swapChainDescriptor);

    console.log(swapChain);

    const shaderModuleDescriptor = { code: shader };
    const shaderModule = device.createShaderModule(shaderModuleDescriptor);

    const verticesBufferDescriptor = { size: verticesArray.byteLength, usage: GPUBufferUsage.VERTEX };
    let verticesArrayBuffer;
    verticesArrayBuffer = device.createBuffer(verticesBufferDescriptor);
    console.log(verticesArrayBuffer);

    const verticesWriteArray = new Float32Array(verticesArray);
    verticesArrayBuffer.unmap();

    // Vertex Input
    const positionAttributeState = {
        shaderLocation: positionAttributeNum,  // [[attribute(0)]]
        offset: 0,
        format: "float4"
    };
    const colorAttributeState = {
        shaderLocation: colorAttributeNum,
        offset: colorOffset,
        format: "float4"
    }
    const vertexBufferState = {
        attributes: [positionAttributeState, colorAttributeState],
        arrayStride: vertexSize,
        stepMode: "vertex"
    };

    // Bind group binding layout
    const transformBufferBindGroupLayoutEntry = {
        binding: transformBindingNum, // id[[(0)]]
        visibility: GPUShaderStage.VERTEX,
        type: "uniform-buffer"
    };

    const bindGroupLayoutDescriptor = { entries: [transformBufferBindGroupLayoutEntry] };
    bindGroupLayout = device.createBindGroupLayout(bindGroupLayoutDescriptor);

    // Pipeline
    const depthStateDescriptor = {
        format: "depth32float",
        depthWriteEnabled: true,
        depthCompare: "less"
    };

    const pipelineLayoutDescriptor = { bindGroupLayouts: [bindGroupLayout] };
    const pipelineLayout = device.createPipelineLayout(pipelineLayoutDescriptor);
    const colorTargetState = {
        format: "bgra8unorm",
        blend: {
            alpha: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add"
            },
            color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add"
            },
        },
        writeMask: 15 //GPUColorWriteBits.ALL ISSUE https://github.com/w3c/webidl2.js/issues/316, https://github.com/heycam/webidl/issues/717
    };
    const pipelineDescriptor = {
        vertex: {
            buffers: [vertexBufferState],
            module: shaderModule,
            entryPoint: "vertex_main"
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fragment_main",
            targets: [colorTargetState],
        },

        depthStencil: depthStateDescriptor,
        layout: pipelineLayout
    };
    pipeline = device.createRenderPipeline(pipelineDescriptor);

    let colorAttachment = {
        // attachment is acquired in render loop.
        loadOp: "clear",
        storeOp: "store",
        clearColor: { r: 0.5, g: 1.0, b: 1.0, a: 1.0 } // GPUColor
    };

    // Depth stencil texture

    // GPUExtent3D
    const depthSize = {
        width: canvas.width,
        height: canvas.height,
        depth: 1
    };

    const depthTextureDescriptor = {
        size: depthSize,
        arrayLayerCount: 1,
        mipLevelCount: 1,
        sampleCount: 1,
        dimension: "2d",
        format: "depth32float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    };

    const depthTexture = device.createTexture(depthTextureDescriptor);

    // GPURenderPassDepthStencilAttachmentDescriptor
    const depthAttachment = {
        view: depthTexture.createView(),
        depthLoadOp: "clear",
        depthStoreOp: "store",
        //clearDepth: 1.0,
        stencilLoadValue: "load",
        stencilStoreOp: "clear"
    };

    renderPassDescriptor = {
        colorAttachments: [colorAttachment],
        depthStencilAttachment: depthAttachment
    };

    render();
}

// Transform Buffers and Bindings

const transformSize = 4 * 16;
const transformBufferDescriptor = {
    size: transformSize,
    usage: GPUBufferUsage.MAP_WRITE,
    mappedAtCreation: true
};

function render() {
    if (mappedGroups.length === 0) {
        console.log(transformBufferDescriptor)
        console.log(device.createBuffer(transformBufferDescriptor))
        const buffer = device.createBuffer(transformBufferDescriptor);
        const group = device.createBindGroup(createBindGroupDescriptor(buffer));
        let mappedGroup = { buffer: buffer, bindGroup: group };
        drawCommands(mappedGroup);
    } else
        drawCommands(mappedGroups.shift());
}

function createBindGroupDescriptor(transformBuffer) {
    const transformBufferBinding = {
        buffer: transformBuffer,
        offset: 0,
        size: transformSize
    };
    const transformBufferBindGroupEntry = {
        binding: transformBindingNum,
        resource: transformBufferBinding
    };
    return {
        layout: bindGroupLayout,
        entries: [transformBufferBindGroupEntry]
    };
}

function drawCommands(mappedGroup) {
    updateTransformArray(new Float32Array(mappedGroup.buffer));
    mappedGroup.buffer.unmap();

    const commandEncoder = device.createCommandEncoder();
    renderPassDescriptor.colorAttachments[0].view = swapChain.getCurrentTexture().createDefaultView();
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

    // Encode drawing commands

    passEncoder.setPipeline(pipeline);
    // Vertex attributes
    passEncoder.setVertexBuffers(0, [verticesBuffer], [0]);
    // Bind groups
    passEncoder.setBindGroup(bindGroupIndex, mappedGroup.bindGroup);
    // 36 vertices, 1 instance, 0th vertex, 0th instance.
    passEncoder.draw(36, 1, 0, 0);
    passEncoder.endPass();

    device.getQueue().submit([commandEncoder.finish()]);

    // Ready the current buffer for update after GPU is done with it.
    mappedGroup.buffer.mapWriteAsync().then((arrayBuffer) => {
        mappedGroup.arrayBuffer = arrayBuffer;
        mappedGroups.push(mappedGroup);
    });

    requestAnimationFrame(render);
}

function updateTransformArray(array) {
    let viewMatrix = mat4.create();
    mat4.translate(viewMatrix, viewMatrix, vec3.fromValues(0, 0, -5));
    let now = Date.now() / 1000;
    mat4.rotate(viewMatrix, viewMatrix, 1, vec3.fromValues(Math.sin(now), Math.cos(now), 0));
    let modelViewProjectionMatrix = mat4.create();
    mat4.multiply(modelViewProjectionMatrix, projectionMatrix, viewMatrix);
    mat4.copy(array, modelViewProjectionMatrix);
}

window.addEventListener("load", init);