import { detectBrand, parseTitle, stripBrandPrefix } from '../domain/title-parser.js';
import { buildIdentity } from '../domain/identity.js';
import { chipsetKey } from '../scoring/chipsets.js';
import { cleanText } from '../domain/text.js';
import { lookupSpecs } from './spec-catalog.js';
import { fillMissing } from '../domain/identity.js';

/**
 * Turns a validated RawListing into the retailer-independent internal contract:
 *   NormalizedListing = { brand, model, ram, storage, chipsetId, fiveG, specs, identity, offer }
 * Nothing after this point knows which retailer the data came from.
 */
export function normalizeListing(listing, { chipsetIndex }) {
  const parsed = parseTitle(listing.title);

  const model = listing.model
    ? stripBrandPrefix(cleanText(listing.model, 120))
    : parsed.model;
  const brand =
    (listing.brand && (detectBrand(listing.brand) ?? cleanText(listing.brand, 60))) ||
    parsed.brand ||
    detectBrand(model);

  const problems = [];
  if (!brand) problems.push('brand could not be determined');
  if (!model) problems.push('model could not be determined');

  const ram = listing.ram ?? parsed.ram ?? null;
  const storage = listing.storage ?? parsed.storage ?? null;

  // Specs: what the listing carries wins; gaps are filled from the curated spec catalog (never invented).
  const merged = fillMissing(listing.specs || {}, lookupSpecs(brand, model) ?? {});
  const { chipsetName, fiveG, ...specGroups } = merged;
  let chipsetId = null;
  let chipsetUnknown = null;
  if (chipsetName) {
    chipsetId = chipsetIndex.get(chipsetKey(chipsetName)) ?? null;
    if (!chipsetId) chipsetUnknown = chipsetName; // logged; scores that need the chipset are excluded, not zeroed
  }

  const fiveGValue = typeof fiveG === 'boolean' ? fiveG : (specGroups.connectivity?.fiveG ?? null);

  if (problems.length) return { ok: false, errors: problems };

  const identity = buildIdentity({ brand, model, ram, storage, chipsetId, fiveG: fiveGValue });
  return {
    ok: true,
    value: {
      brand,
      model,
      ram,
      storage,
      chipsetId,
      chipsetUnknown,
      fiveG: fiveGValue,
      specs: specGroups,
      imageUrl: listing.imageUrl,
      identity,
      offer: {
        price: listing.price,
        available: listing.available,
        url: listing.url,
        sourceProductId: listing.sourceProductId,
        lastUpdated: listing.fetchedAt,
        imageUrl: listing.imageUrl ?? null,
        color: listing.color ?? parsed.color ?? null,
      },
    },
  };
}
