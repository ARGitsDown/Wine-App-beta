-- Which list a binned wine was on, for the Recently deleted page. Nullable:
-- entries made before this column carry no value. Additive.
ALTER TABLE "BottleTrash" ADD COLUMN "listedIn" TEXT;
