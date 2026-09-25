-- The chipset's graphics core, shown to the person on the product page (e.g. "Adreno 750",
-- "Mali-G715 Immortalis MP7", "Apple GPU (6-core)"). Display only — scoring still uses gpu_score.
ALTER TABLE chipsets ADD COLUMN gpu TEXT;
