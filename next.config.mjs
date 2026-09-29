/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keeps sharp - the image library Next's own image optimizer uses - out
  // of every server function's bundle. It was about three-quarters of each
  // deployment's traced size (~47 of ~63 MB, two Linux builds of libvips
  // plus a wasm fallback), and Vercel's Hobby plan caps the combined size
  // of every retained deployment's functions at 10 GB (BACKLOG #52).
  //
  // Nothing here uses it at runtime: label photos render as plain <img>
  // straight from Blob storage rather than through next/image, and the app
  // icons use next/og, which renders with its own wasm (satori + resvg),
  // not sharp. If next/image is ever adopted, take this out first - on a
  // self-hosted `next start` the optimizer needs sharp.
  outputFileTracingExcludes: {
    "/**": ["node_modules/sharp/**", "node_modules/@img/**"],
  },
};

export default nextConfig;
