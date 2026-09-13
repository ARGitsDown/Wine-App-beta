// Temporary build-time diagnostic: prints which database-related environment
// variable NAMES are visible to the build, and how long each value is.
// Never prints the actual values, so this is safe to leave in build logs.
const relevant = Object.keys(process.env).filter((key) =>
  /DATABASE|POSTGRES|PRISMA/i.test(key)
);

console.log("[env check] Variables matching DATABASE/POSTGRES/PRISMA:");
if (relevant.length === 0) {
  console.log("  (none found)");
} else {
  for (const key of relevant.sort()) {
    console.log(`  ${key}: length=${(process.env[key] || "").length}`);
  }
}
