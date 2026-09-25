/**
 * Normalized chipset taxonomy (PRD §10.2).
 *
 * generationRank: 1 (oldest) … 8 (newest) — a curated position in the *maintained* taxonomy,
 * so GenerationScore = rank / 8 × 100 (Gen 8 = 100, Gen 7 = 87.5, Gen 6 = 75 …).
 *
 * ⚠ cpuScore / gpuScore / architectureScore below are CURATED RELATIVE VALUES (0–100) meant as
 * a starting point. Replace them with your own benchmark-backed numbers (Geekbench, 3DMark…)
 * before relying on the recommendations in production. `gpu` is the graphics core's real model name
 * (e.g. "Adreno 750", "Mali-G715 Immortalis MP7") shown to the person on the product page; it plays
 * no role in scoring (`gpuScore` does). Adding a chipset = adding a row.
 */
export const CHIPSETS = [
  { id: 'apple-a16-bionic', vendor: 'Apple', name: 'Apple A16 Bionic', aliases: ['A16 Bionic', 'A16'], generationRank: 4, performanceTier: 'flagship', cpuScore: 84, gpuScore: 78, architectureScore: 85, gpu: 'Apple GPU (5-core)',cores: '6-core CPU / 5-core GPU', released: '2022-09' },
  { id: 'apple-a18', vendor: 'Apple', name: 'Apple A18', aliases: ['A18'], generationRank: 8, performanceTier: 'flagship', cpuScore: 96, gpuScore: 90, architectureScore: 95, gpu: 'Apple GPU (5-core)',cores: '6-core CPU / 5-core GPU', released: '2024-09' },
  { id: 'snapdragon-8-elite-galaxy', vendor: 'Qualcomm', name: 'Snapdragon 8 Elite for Galaxy', aliases: ['Snapdragon 8 Elite'], generationRank: 8, performanceTier: 'flagship', cpuScore: 98, gpuScore: 96, architectureScore: 97, gpu: 'Adreno 830',cores: '8-core (2+6)', released: '2024-10' },
  { id: 'snapdragon-8-gen-3', vendor: 'Qualcomm', name: 'Snapdragon 8 Gen 3', aliases: ['SM8650'], generationRank: 6, performanceTier: 'flagship', cpuScore: 90, gpuScore: 92, architectureScore: 90, gpu: 'Adreno 750',cores: '8-core (1+3+2+2)', released: '2023-10' },
  { id: 'snapdragon-8s-gen-3', vendor: 'Qualcomm', name: 'Snapdragon 8s Gen 3', aliases: ['SM8635'], generationRank: 7, performanceTier: 'upper-mid', cpuScore: 78, gpuScore: 74, architectureScore: 82, gpu: 'Adreno 735',cores: '8-core (1+4+3)', released: '2024-03' },
  { id: 'snapdragon-7s-gen-2', vendor: 'Qualcomm', name: 'Snapdragon 7s Gen 2', aliases: ['SM7435'], generationRank: 6, performanceTier: 'mid', cpuScore: 50, gpuScore: 45, architectureScore: 60, gpu: 'Adreno 710',cores: '8-core (4+4)', released: '2023-08' },
  { id: 'exynos-2400', vendor: 'Samsung', name: 'Exynos 2400', aliases: [], generationRank: 7, performanceTier: 'flagship', cpuScore: 80, gpuScore: 80, architectureScore: 85, gpu: 'Xclipse 940',cores: '10-core (1+2+3+4)', released: '2024-01' },
  { id: 'exynos-2400e', vendor: 'Samsung', name: 'Exynos 2400e', aliases: [], generationRank: 7, performanceTier: 'flagship', cpuScore: 77, gpuScore: 77, architectureScore: 85, gpu: 'Xclipse 940',cores: '10-core (1+2+3+4)', released: '2024-09' },
  { id: 'exynos-1480', vendor: 'Samsung', name: 'Exynos 1480', aliases: [], generationRank: 7, performanceTier: 'mid', cpuScore: 55, gpuScore: 60, architectureScore: 65, gpu: 'Mali-G68 MP5',cores: '8-core (4+4)', released: '2024-03' },
  { id: 'exynos-1380', vendor: 'Samsung', name: 'Exynos 1380', aliases: [], generationRank: 5, performanceTier: 'mid', cpuScore: 45, gpuScore: 40, architectureScore: 55, gpu: 'Mali-G68 MP5',cores: '8-core (4+4)', released: '2023-03' },
  { id: 'google-tensor-g3', vendor: 'Google', name: 'Google Tensor G3', aliases: ['Tensor G3'], generationRank: 6, performanceTier: 'upper-mid', cpuScore: 68, gpuScore: 70, architectureScore: 78, gpu: 'Mali-G715 Immortalis MP7',cores: '9-core (1+4+4)', released: '2023-10' },
  { id: 'google-tensor-g4', vendor: 'Google', name: 'Google Tensor G4', aliases: ['Tensor G4'], generationRank: 7, performanceTier: 'upper-mid', cpuScore: 70, gpuScore: 66, architectureScore: 80, gpu: 'Mali-G715 Immortalis MP7',cores: '8-core (1+3+4)', released: '2024-08' },
  { id: 'dimensity-8300-ultra', vendor: 'MediaTek', name: 'MediaTek Dimensity 8300 Ultra', aliases: ['Dimensity 8300 Ultra', 'Dimensity 8300'], generationRank: 6, performanceTier: 'upper-mid', cpuScore: 72, gpuScore: 70, architectureScore: 80, gpu: 'Mali-G615 MC6',cores: '8-core (1+3+4)', released: '2023-11' },
  { id: 'dimensity-7200-pro', vendor: 'MediaTek', name: 'MediaTek Dimensity 7200 Pro', aliases: ['Dimensity 7200 Pro', 'Dimensity 7200', 'Dimensity 7200 Ultra'], generationRank: 5, performanceTier: 'mid', cpuScore: 52, gpuScore: 48, architectureScore: 62, gpu: 'Mali-G610 MC4',cores: '8-core (2+6)', released: '2023-02' },
  { id: 'snapdragon-7-gen-3', vendor: 'Qualcomm', name: 'Snapdragon 7 Gen 3', aliases: ['SM7550'], generationRank: 7, performanceTier: 'upper-mid', cpuScore: 66, gpuScore: 62, architectureScore: 76, gpu: 'Adreno 720',cores: '8-core (1+3+4)', released: '2024-03' },
  { id: 'snapdragon-4-gen-2', vendor: 'Qualcomm', name: 'Snapdragon 4 Gen 2', aliases: ['SM4450'], generationRank: 5, performanceTier: 'entry', cpuScore: 26, gpuScore: 20, architectureScore: 42, gpu: 'Adreno 613',cores: '8-core (2+6)', released: '2023-06' },
  { id: 'dimensity-9300', vendor: 'MediaTek', name: 'MediaTek Dimensity 9300', aliases: ['Dimensity 9300', 'Dimensity 9300+', 'MediaTek Dimensity 9300+'], generationRank: 6, performanceTier: 'flagship', cpuScore: 88, gpuScore: 90, architectureScore: 88, gpu: 'Immortalis-G720 MC12',cores: '8-core (4+4)', released: '2023-11' },
  { id: 'dimensity-8200', vendor: 'MediaTek', name: 'MediaTek Dimensity 8200', aliases: ['Dimensity 8200', 'Dimensity 8200 Ultra'], generationRank: 4, performanceTier: 'upper-mid', cpuScore: 62, gpuScore: 62, architectureScore: 72, gpu: 'Mali-G610 MC6',cores: '8-core (1+3+4)', released: '2022-12' },
  { id: 'dimensity-7300', vendor: 'MediaTek', name: 'MediaTek Dimensity 7300', aliases: ['Dimensity 7300', 'Dimensity 7300 Ultra'], generationRank: 7, performanceTier: 'mid', cpuScore: 54, gpuScore: 50, architectureScore: 66, gpu: 'Mali-G615 MC2',cores: '8-core (4+4)', released: '2024-05' },
  { id: 'dimensity-8400', vendor: 'MediaTek', name: 'MediaTek Dimensity 8400', aliases: ['Dimensity 8400', 'Dimensity 8400 Ultra'], generationRank: 8, performanceTier: 'upper-mid', cpuScore: 80, gpuScore: 78, architectureScore: 86, gpu: 'Mali-G620 MC5',cores: '8-core (8×A725)', released: '2024-12' },
  { id: 'helio-g99', vendor: 'MediaTek', name: 'MediaTek Helio G99', aliases: ['Helio G99', 'Helio G99 Ultra'], generationRank: 3, performanceTier: 'entry', cpuScore: 28, gpuScore: 22, architectureScore: 36, gpu: 'Mali-G57 MC2',cores: '8-core (2+6)', released: '2022-06' },
  { id: 'exynos-2200', vendor: 'Samsung', name: 'Exynos 2200', aliases: [], generationRank: 3, performanceTier: 'flagship', cpuScore: 72, gpuScore: 74, architectureScore: 76, gpu: 'Xclipse 920',cores: '8-core (1+3+4)', released: '2022-01' },
  { id: 'exynos-1280', vendor: 'Samsung', name: 'Exynos 1280', aliases: [], generationRank: 3, performanceTier: 'mid', cpuScore: 36, gpuScore: 32, architectureScore: 48, gpu: 'Mali-G68',cores: '8-core (2+6)', released: '2022-03' },
  { id: 'exynos-1330', vendor: 'Samsung', name: 'Exynos 1330', aliases: [], generationRank: 5, performanceTier: 'entry', cpuScore: 32, gpuScore: 28, architectureScore: 45, gpu: 'Mali-G68',cores: '8-core (2+6)', released: '2023-03' },
  { id: 'apple-a15-bionic', vendor: 'Apple', name: 'Apple A15 Bionic', aliases: ['A15 Bionic', 'A15'], generationRank: 2, performanceTier: 'flagship', cpuScore: 74, gpuScore: 70, architectureScore: 78, gpu: 'Apple GPU (5-core)',cores: '6-core CPU / 5-core GPU', released: '2021-09' },
  { id: 'apple-a17-pro', vendor: 'Apple', name: 'Apple A17 Pro', aliases: ['A17 Pro'], generationRank: 6, performanceTier: 'flagship', cpuScore: 92, gpuScore: 88, architectureScore: 93, gpu: 'Apple GPU (6-core)',cores: '6-core CPU / 6-core GPU', released: '2023-09' },
  { id: 'apple-a18-pro', vendor: 'Apple', name: 'Apple A18 Pro', aliases: ['A18 Pro'], generationRank: 8, performanceTier: 'flagship', cpuScore: 97, gpuScore: 93, architectureScore: 96, gpu: 'Apple GPU (6-core)',cores: '6-core CPU / 6-core GPU', released: '2024-09' },
  { id: 'google-tensor-g2', vendor: 'Google', name: 'Google Tensor G2', aliases: ['Tensor G2'], generationRank: 4, performanceTier: 'upper-mid', cpuScore: 60, gpuScore: 62, architectureScore: 72, gpu: 'Mali-G710 MP7',cores: '8-core (2+2+4)', released: '2022-10' },
  { id: 'snapdragon-8-gen-2', vendor: 'Qualcomm', name: 'Snapdragon 8 Gen 2', aliases: ['SM8550'], generationRank: 4, performanceTier: 'flagship', cpuScore: 86, gpuScore: 88, architectureScore: 88, gpu: 'Adreno 740',cores: '8-core (1+2+2+3)', released: '2022-11' },
  { id: 'snapdragon-8-plus-gen-1', vendor: 'Qualcomm', name: 'Snapdragon 8+ Gen 1', aliases: ['SM8475'], generationRank: 3, performanceTier: 'flagship', cpuScore: 78, gpuScore: 80, architectureScore: 82, gpu: 'Adreno 730',cores: '8-core (1+3+4)', released: '2022-05' },
  { id: 'snapdragon-8s-gen-4', vendor: 'Qualcomm', name: 'Snapdragon 8s Gen 4', aliases: ['SM8735'], generationRank: 8, performanceTier: 'upper-mid', cpuScore: 84, gpuScore: 80, architectureScore: 88, gpu: 'Adreno 825',cores: '8-core (1+3+2+2)', released: '2025-04' },
  { id: 'snapdragon-7-plus-gen-3', vendor: 'Qualcomm', name: 'Snapdragon 7+ Gen 3', aliases: ['SM7675'], generationRank: 7, performanceTier: 'upper-mid', cpuScore: 70, gpuScore: 66, architectureScore: 78, gpu: 'Adreno 720',cores: '8-core (1+4+3)', released: '2024-03' },
  { id: 'snapdragon-7s-gen-3', vendor: 'Qualcomm', name: 'Snapdragon 7s Gen 3', aliases: ['SM7635'], generationRank: 7, performanceTier: 'mid', cpuScore: 56, gpuScore: 52, architectureScore: 68, gpu: 'Adreno 710',cores: '8-core (1+3+4)', released: '2024-08' },
  { id: 'snapdragon-6-gen-3', vendor: 'Qualcomm', name: 'Snapdragon 6 Gen 3', aliases: ['SM6475'], generationRank: 7, performanceTier: 'mid', cpuScore: 46, gpuScore: 42, architectureScore: 60, gpu: 'Adreno 613',cores: '8-core (4+4)', released: '2024-03' },
  { id: 'exynos-1580', vendor: 'Samsung', name: 'Exynos 1580', aliases: [], generationRank: 8, performanceTier: 'mid', cpuScore: 60, gpuScore: 56, architectureScore: 72, gpu: 'Xclipse 540',cores: '10-core (1+3+4+2)', released: '2025-03' },
  { id: 'dimensity-9400', vendor: 'MediaTek', name: 'MediaTek Dimensity 9400', aliases: ['Dimensity 9400', 'Dimensity 9400+'], generationRank: 8, performanceTier: 'flagship', cpuScore: 94, gpuScore: 92, architectureScore: 94, gpu: 'Immortalis-G925 MC12',cores: '8-core (1+3+4)', released: '2024-10' },
  { id: 'helio-g85', vendor: 'MediaTek', name: 'MediaTek Helio G85', aliases: ['Helio G85'], generationRank: 1, performanceTier: 'entry', cpuScore: 20, gpuScore: 15, architectureScore: 25, gpu: 'Mali-G52 MC2',cores: '8-core (2+6)', released: '2020-05' },
  { id: 'helio-g88', vendor: 'MediaTek', name: 'MediaTek Helio G88', aliases: ['Helio G88'], generationRank: 2, performanceTier: 'entry', cpuScore: 24, gpuScore: 18, architectureScore: 28, gpu: 'Mali-G52 MC2',cores: '8-core (2+6)', released: '2021-09' },
  { id: 'snapdragon-680', vendor: 'Qualcomm', name: 'Snapdragon 680', aliases: ['SM6225'], generationRank: 2, performanceTier: 'entry', cpuScore: 25, gpuScore: 18, architectureScore: 34, gpu: 'Adreno 610',cores: '8-core (4+4)', released: '2021-11' },
  { id: 'unisoc-t612', vendor: 'Unisoc', name: 'Unisoc T612', aliases: ['T612'], generationRank: 1, performanceTier: 'entry', cpuScore: 14, gpuScore: 10, architectureScore: 20, gpu: 'Mali-G57',cores: '8-core (2+6)', released: '2021-03' },
  { id: 'unisoc-t616', vendor: 'Unisoc', name: 'Unisoc T616', aliases: ['T616'], generationRank: 2, performanceTier: 'entry', cpuScore: 18, gpuScore: 13, architectureScore: 24, gpu: 'Mali-G57 MP2',cores: '8-core (2+6)', released: '2021-08' },
  { id: 'dimensity-6300', vendor: 'MediaTek', name: 'MediaTek Dimensity 6300', aliases: ['Dimensity 6300'], generationRank: 5, performanceTier: 'mid', cpuScore: 42, gpuScore: 38, architectureScore: 55, gpu: 'Mali-G57 MC2',cores: '8-core (2+6)', released: '2024-04' },
  { id: 'dimensity-8020', vendor: 'MediaTek', name: 'MediaTek Dimensity 8020', aliases: ['Dimensity 8020'], generationRank: 5, performanceTier: 'upper-mid', cpuScore: 58, gpuScore: 56, architectureScore: 66, gpu: 'Mali-G610 MC6',cores: '8-core (4+4)', released: '2023-04' },
  { id: 'kirin-9000s', vendor: 'HiSilicon', name: 'HiSilicon Kirin 9000S', aliases: ['Kirin 9000S'], generationRank: 6, performanceTier: 'flagship', cpuScore: 74, gpuScore: 68, architectureScore: 78, gpu: 'Maleoon 910',cores: '8-core (1+3+4)', released: '2023-08' },
];

/** Case/punctuation-insensitive lookup key. */
export const chipsetKey = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9+]+/g, '');

/** Builds a lookup from any known name/alias to a chipset id. */
export function buildChipsetIndex(chipsets) {
  const index = new Map();
  for (const c of chipsets) {
    for (const n of [c.name, ...(c.aliases || []), c.id]) index.set(chipsetKey(n), c.id);
  }
  return index;
}
