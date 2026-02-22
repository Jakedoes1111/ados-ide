const path = require('path');
const os = require('os');
const { app } = require('electron');

// Update to override the supported VS Code API version.
// process.env.VSCODE_API_VERSION = '1.50.0'

// Use a set of builtin plugins in our application.
process.env.THEIA_DEFAULT_PLUGINS = `local-dir:${path.resolve(__dirname, '../', 'plugins')}`;

const cpuCount = Array.isArray(os.cpus()) ? os.cpus().length : 4;
const totalMemGiB = Math.max(1, Math.floor(os.totalmem() / (1024 ** 3)));

// Bound the libuv thread pool so backend fs/process work scales on modern CPUs
// without overcommitting small systems.
if (!process.env.UV_THREADPOOL_SIZE) {
    process.env.UV_THREADPOOL_SIZE = String(Math.min(12, Math.max(6, cpuCount)));
}

function hasArgSwitch(name) {
    return process.argv.some(arg => arg === `--${name}` || arg.startsWith(`--${name}=`));
}

function hasAnyArgSwitch(names) {
    return names.some(name => hasArgSwitch(name));
}

function appendSwitch(name, value) {
    if (!app.commandLine.hasSwitch(name)) {
        app.commandLine.appendSwitch(name, value);
    }
}

function applyRuntimeProfile() {
    const requestedMode = (process.env.ADOS_GPU_MODE || 'balanced').toLowerCase();
    const gpuMode = requestedMode === 'off' || requestedMode === 'safe' || requestedMode === 'performance'
        ? requestedMode
        : 'balanced';

    // Keep renderer process count reasonable for a 16 GiB class machine while still
    // allowing enough parallel webviews/editors.
    appendSwitch('renderer-process-limit', totalMemGiB >= 16 ? '8' : '6');
    appendSwitch('num-raster-threads', String(Math.min(4, Math.max(2, Math.floor(cpuCount / 3)))));

    const gpuExplicitlyDisabled = hasAnyArgSwitch([
        'disable-gpu',
        'disable-gpu-compositing',
        'disable-software-rasterizer'
    ]);

    if (gpuMode === 'off') {
        app.disableHardwareAcceleration();
        console.log(`[aDOs] Runtime profile: gpu=${gpuMode}, cpu=${cpuCount}, mem=${totalMemGiB}GiB`);
        return;
    }

    if (gpuExplicitlyDisabled || gpuMode === 'safe') {
        console.log(`[aDOs] Runtime profile: gpu=${gpuMode} (conservative), cpu=${cpuCount}, mem=${totalMemGiB}GiB`);
        return;
    }

    // Balanced/default profile: enable conservative GPU acceleration that tends to
    // benefit Theia/Monaco rendering on Intel iGPU Linux systems.
    appendSwitch('enable-gpu-rasterization');
    appendSwitch('enable-zero-copy');
    appendSwitch('enable-native-gpu-memory-buffers');
    appendSwitch('enable-accelerated-video-decode');

    // Only set enable-features if user did not set explicit feature flags.
    if (!hasArgSwitch('enable-features')) {
        const features = ['CanvasOopRasterization'];
        if (process.platform === 'linux') {
            features.push('VaapiVideoDecoder');
        }
        if (gpuMode === 'performance') {
            features.push('Vulkan');
        }
        appendSwitch('enable-features', features.join(','));
    }

    if (gpuMode === 'performance') {
        appendSwitch('ignore-gpu-blocklist');
    }

    console.log(`[aDOs] Runtime profile: gpu=${gpuMode}, cpu=${cpuCount}, mem=${totalMemGiB}GiB`);
}

applyRuntimeProfile();

// Handover to the auto-generated electron application handler.
require('../lib/backend/electron-main.js');
