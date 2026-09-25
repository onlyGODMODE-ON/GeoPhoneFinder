/**
 * Versioned component-score definitions (PRD §10). Declarative on purpose:
 * adding a category = adding one object here; the recommendation engine never changes.
 *
 * At startup these are synced into the `score_definitions` table. If you change a formula,
 * BUMP `version` so historical scores stay explainable.
 *
 * Group weights and factor weights do not need to sum to 1 — they are normalised at
 * evaluation time, and factors without data are excluded (PRD §10.1).
 */
const lin = (min, max) => ({ type: 'linear', min, max }); // min > max => "lower is better"
const log = (min, max) => ({ type: 'log', min, max });
const bool = { type: 'bool' };
const map = (values) => ({ type: 'map', values });
const f = (id, weight, path, normalize) => ({ id, weight, path, normalize });
const fd = (id, weight, derive, normalize) => ({ id, weight, derive, normalize });

const HDR = map({ none: 0, hdr10: 60, 'hdr10+': 80, 'dolby vision': 100 });

const videoFactors = () => [
  f('resolution', 0.35, 'video.maxResolution', map({ '720p': 10, '1080p': 35, '4k': 75, '8k': 100 })),
  f('fps4k', 0.25, 'video.max4kFps', lin(0, 120)),
  f('hdr', 0.25, 'video.hdr', HDR),
  f('stabilization', 0.15, 'cameras.main.ois', bool),
];

const selfieFactors = () => [
  f('frontMp', 0.3, 'cameras.front.mp', lin(8, 50)),
  f('autofocus', 0.3, 'cameras.front.autofocus', bool),
  f('frontVideo', 0.4, 'video.frontMaxResolution', map({ '720p': 20, '1080p': 50, '4k': 90 })),
];

export const SCORE_DEFINITIONS = [
  {
    key: 'performance',
    version: 1,
    label: 'Performance',
    groups: [
      {
        id: 'chipset',
        weight: 1,
        factors: [
          fd('generation', 0.22, 'generationScore', lin(0, 100)),
          f('cpu', 0.28, 'chipset.cpuScore', lin(0, 100)),
          f('gpu', 0.18, 'chipset.gpuScore', lin(0, 100)),
          f('architecture', 0.1, 'chipset.architectureScore', lin(0, 100)),
          f('tier', 0.12, 'chipset.performanceTier', map({ flagship: 100, 'upper-mid': 72, mid: 45, entry: 20 })),
          f('sustained', 0.1, 'benchmarks.sustainedScore', lin(0, 100)),
        ],
      },
    ],
  },
  {
    key: 'gaming',
    version: 1,
    label: 'Gaming',
    groups: [
      {
        id: 'gaming',
        weight: 1,
        factors: [
          f('gpu', 0.35, 'chipset.gpuScore', lin(0, 100)),
          f('chipset', 0.25, 'chipset.cpuScore', lin(0, 100)),
          f('refreshRate', 0.15, 'display.refreshRateHz', lin(60, 144)),
          f('sustained', 0.15, 'benchmarks.sustainedScore', lin(0, 100)),
          f('thermal', 0.1, 'benchmarks.thermalScore', lin(0, 100)),
        ],
      },
    ],
  },
  {
    key: 'camera',
    version: 1,
    label: 'Camera',
    // Megapixels alone never decide the score (PRD §10.3): they carry 0.2 of the 0.34 "main" group.
    groups: [
      {
        id: 'main',
        weight: 0.34,
        factors: [
          f('sensor', 0.55, 'cameras.main.sensorSizeInch', lin(0.36, 0.85)),
          f('aperture', 0.25, 'cameras.main.aperture', lin(2.4, 1.4)),
          f('megapixels', 0.2, 'cameras.main.mp', log(8, 200)),
        ],
      },
      { id: 'stabilization', weight: 0.14, factors: [f('ois', 1, 'cameras.main.ois', bool)] },
      {
        id: 'ultrawide',
        weight: 0.1,
        factors: [f('present', 0.6, 'cameras.ultrawide.present', bool), f('mp', 0.4, 'cameras.ultrawide.mp', lin(8, 50))],
      },
      {
        id: 'zoom',
        weight: 0.2,
        factors: [
          f('telephoto', 0.4, 'cameras.telephoto.present', bool),
          f('opticalZoom', 0.6, 'cameras.opticalZoomMax', lin(1, 5)),
        ],
      },
      { id: 'video', weight: 0.12, factors: videoFactors() },
      { id: 'selfie', weight: 0.1, factors: selfieFactors() },
    ],
  },
  {
    key: 'battery',
    version: 2, // v2: 5000 mAh = 80 points (was a flat 3000–6500 mAh scale that gave ~35 to a 5000 mAh phone)
    label: 'Battery',
    groups: [
      {
        id: 'battery',
        weight: 1,
        factors: [
          // capacity curve + charging speed, see scoring/derive.js
          fd('capacity', 0.85, 'batteryPoints', lin(0, 100)),
          f('endurance', 0.15, 'benchmarks.enduranceScore', lin(0, 100)),
        ],
      },
    ],
  },
  {
    key: 'display',
    version: 1,
    label: 'Display',
    groups: [
      {
        id: 'display',
        weight: 1,
        factors: [
          fd('resolution', 0.2, 'displayMegapixels', lin(1.0, 4.6)),
          f('refreshRate', 0.25, 'display.refreshRateHz', lin(60, 120)),
          f(
            'panel',
            0.2,
            'display.panel',
            map({ 'ips lcd': 35, lcd: 35, oled: 80, amoled: 85, 'ltpo oled': 100, 'ltpo amoled': 100 }),
          ),
          f('brightness', 0.2, 'display.peakBrightnessNits', lin(400, 2600)),
          f('hdr', 0.1, 'display.hdr', HDR),
          f('size', 0.05, 'display.sizeInch', lin(5.8, 6.8)),
        ],
      },
    ],
  },
  {
    key: 'storage',
    version: 1,
    label: 'Storage',
    groups: [{ id: 'capacity', weight: 1, factors: [f('capacity', 1, 'storage', log(64, 1024))] }],
  },
  {
    key: 'ram',
    version: 1,
    label: 'RAM',
    groups: [{ id: 'capacity', weight: 1, factors: [f('capacity', 1, 'ram', log(4, 16))] }],
  },
  {
    key: 'video',
    version: 1,
    label: 'Video',
    groups: [{ id: 'video', weight: 1, factors: videoFactors() }],
  },
  {
    key: 'selfie',
    version: 1,
    label: 'Selfie',
    groups: [{ id: 'selfie', weight: 1, factors: selfieFactors() }],
  },
  {
    key: 'speakers',
    version: 1,
    label: 'Speakers',
    groups: [
      {
        id: 'speakers',
        weight: 1,
        factors: [f('stereo', 0.65, 'audio.stereo', bool), f('tuned', 0.35, 'audio.tuned', bool)],
      },
    ],
  },
  {
    key: 'connectivity',
    version: 1,
    label: 'Connectivity',
    groups: [
      {
        id: 'connectivity',
        weight: 1,
        factors: [
          f('fiveG', 0.25, 'connectivity.fiveG', bool),
          f('wifi', 0.25, 'connectivity.wifi', map({ 'wi-fi 5': 30, 'wi-fi 6': 60, 'wi-fi 6e': 80, 'wi-fi 7': 100 })),
          f('bluetooth', 0.15, 'connectivity.bluetooth', lin(5.0, 5.4)),
          f('nfc', 0.15, 'connectivity.nfc', bool),
          f('esim', 0.1, 'connectivity.esim', bool),
          f(
            'usb',
            0.1,
            'connectivity.usb',
            map({ 'usb 2.0': 40, 'usb 3.0': 80, 'usb 3.1': 90, 'usb 3.2': 100 }),
          ),
        ],
      },
    ],
  },
  {
    key: 'compact',
    version: 1,
    label: 'Compact / Lightweight',
    groups: [
      {
        id: 'compact',
        weight: 1,
        factors: [
          f('weight', 0.5, 'body.weightG', lin(240, 160)),
          f('screenSize', 0.3, 'display.sizeInch', lin(6.9, 5.8)),
          f('thickness', 0.2, 'body.thicknessMm', lin(9.0, 7.0)),
        ],
      },
    ],
  },
  {
    key: 'durability',
    version: 1,
    label: 'Durability',
    groups: [
      {
        id: 'durability',
        weight: 1,
        factors: [
          f('ip', 0.4, 'body.ipRating', map({ none: 0, ip54: 45, ip64: 55, ip65: 65, ip67: 85, ip68: 100, ip69: 100 })),
          f(
            'glass',
            0.25,
            'body.glass',
            map({
              none: 10,
              'gorilla glass 3': 40,
              'gorilla glass 5': 60,
              'gorilla glass victus': 85,
              'xiaomi shield glass': 85,
              'gorilla glass victus+': 90,
              'ceramic shield': 95,
              'gorilla glass victus 2': 100,
            }),
          ),
          f('frame', 0.2, 'body.frame', map({ plastic: 35, aluminum: 75, 'stainless steel': 85, titanium: 100 })),
          f('militaryGrade', 0.15, 'body.militaryGrade', bool),
        ],
      },
    ],
  },
  {
    key: 'software',
    version: 1,
    label: 'Software / Updates',
    groups: [
      {
        id: 'updates',
        weight: 1,
        factors: [
          f('osUpdates', 0.5, 'software.osUpdateYears', lin(2, 7)),
          f('securityUpdates', 0.5, 'software.securityUpdateYears', lin(3, 7)),
        ],
      },
    ],
  },
];
