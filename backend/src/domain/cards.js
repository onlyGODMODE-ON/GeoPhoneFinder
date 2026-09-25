/** Shapes phone records for API responses. Shared by recommendations, search, details and compare. */
export function phoneName(phone) {
  return `${phone.brand} ${phone.model}`;
}

export function serializePhoneCard(phone) {
  return {
    id: phone.id,
    slug: phone.slug,
    brand: phone.brand,
    model: phone.model,
    name: phoneName(phone),
    ram: phone.ram,
    storage: phone.storage,
    imageUrl: phone.imageUrl,
    chipset: phone.chipset ? { id: phone.chipset.id, name: phone.chipset.name, vendor: phone.chipset.vendor } : null,
    highlights: {
      displaySizeInch: phone.display?.sizeInch ?? null,
      refreshRateHz: phone.display?.refreshRateHz ?? null,
      batteryMah: phone.battery?.capacityMah ?? null,
      mainCameraMp: phone.cameras?.main?.mp ?? null,
      fiveG: phone.connectivity?.fiveG ?? null,
    },
    scores: phone.scores,
    lastUpdated: phone.lastUpdated,
  };
}

export function serializePhoneDetail(phone) {
  return {
    ...serializePhoneCard(phone),
    specs: {
      display: phone.display,
      battery: phone.battery,
      cameras: phone.cameras,
      video: phone.video,
      connectivity: phone.connectivity,
      audio: phone.audio,
      body: phone.body,
      software: phone.software,
      chipset: phone.chipset,
    },
    scoreDetails: phone.scoreDetails,
    source: phone.source,
    sourceUrl: phone.sourceUrl,
    sourceProductId: phone.sourceProductId,
  };
}
