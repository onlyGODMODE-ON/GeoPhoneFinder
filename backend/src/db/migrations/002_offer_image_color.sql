-- Per-store photo and colour: the card shows the picture used by the store that offers the best price.
ALTER TABLE store_offers ADD COLUMN image_url TEXT;
ALTER TABLE store_offers ADD COLUMN color TEXT;
