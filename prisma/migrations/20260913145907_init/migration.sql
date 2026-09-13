-- CreateTable
CREATE TABLE "Bottle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "producer" TEXT NOT NULL,
    "vintage" INTEGER,
    "variety" TEXT,
    "region" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'wishlist',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TastingNote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bottleId" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "tastedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TastingNote_bottleId_fkey" FOREIGN KEY ("bottleId") REFERENCES "Bottle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
