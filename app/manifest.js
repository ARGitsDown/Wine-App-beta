export default function manifest() {
  return {
    name: "Wine Tracker",
    short_name: "Wine Tracker",
    description: "A personal wine cellar, wishlist, and tasting log.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#18181b",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
