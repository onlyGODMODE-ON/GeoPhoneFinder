import { StoreAdapter } from './base.js';

/**
 * adapterKey (stores.adapter_key) -> adapter class. Add a retailer = add a line here (plus its row in
 * ingestion/stores.js). A subclass only needs code if the store's data is not already in RawListing
 * shape: override `mapRecord(record)` for a JSON feed, or `fetchLive()` for an API / HTML integration.
 * See docs/ADAPTERS.md.
 */
class ZoommerAdapter extends StoreAdapter {}
class AltaAdapter extends StoreAdapter {}
class ElitAdapter extends StoreAdapter {}
class MegatechnicaAdapter extends StoreAdapter {}
class IStoreAdapter extends StoreAdapter {}
class GStoreAdapter extends StoreAdapter {}
class XiaomiAdapter extends StoreAdapter {}

const ADAPTERS = {
  zoommer: ZoommerAdapter,
  alta: AltaAdapter,
  elit: ElitAdapter,
  megatechnica: MegatechnicaAdapter,
  istore: IStoreAdapter,
  gstore: GStoreAdapter,
  xiaomi: XiaomiAdapter,
};

export function createAdapter(store, options) {
  const Adapter = ADAPTERS[store.adapterKey];
  if (!Adapter) throw new Error(`No adapter registered for adapterKey "${store.adapterKey}"`);
  return new Adapter(store, options);
}
