-- A bottle row is a lot: size, place and unit price are single nullable values.
-- All additive; no backfill (null = not recorded).
ALTER TABLE "Bottle"
  ADD COLUMN "sizeMl" INTEGER,
  ADD COLUMN "location" TEXT,
  ADD COLUMN "pricePaidCents" INTEGER,
  ADD COLUMN "priceCurrency" TEXT;

-- Prisma doesn't model CHECK constraints, so they are invisible to
-- `migrate diff` and don't show as drift. A price and its currency travel
-- together; 0 is a gift and is allowed.
ALTER TABLE "Bottle" ADD CONSTRAINT "Bottle_lot_sane" CHECK (
  ("sizeMl" IS NULL OR "sizeMl" BETWEEN 50 AND 30000)
  AND ("location" IS NULL OR btrim("location") <> '')
  AND ("pricePaidCents" IS NULL OR "pricePaidCents" >= 0)
  AND (("pricePaidCents" IS NULL) = ("priceCurrency" IS NULL))
  AND ("priceCurrency" IS NULL OR "priceCurrency" ~ '^[A-Z]{3}$')
);

-- A row that exists has at least one bottle (checked: no existing row has
-- fewer). "Tasted one" moves the last one to History at quantity 1 rather
-- than zero.
ALTER TABLE "Bottle" ADD CONSTRAINT "Bottle_quantity_positive" CHECK ("quantity" >= 1);
