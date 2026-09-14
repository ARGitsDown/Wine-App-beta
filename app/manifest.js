export default function manifest() {
  return {
    name: "Cellarmaster",
    // Twelve characters, so it fits under the home-screen icon without
    // clipping and needs no shortened form.
    short_name: "Cellarmaster",
    description: "A personal wine cellar, wishlist, and tasting log.",
    start_url: "/",
    display: "standalone",
    // background_color is the splash behind the icon while the app boots,
    // so it stays near-white to match what loads; theme_color is the chrome
    // around it, which takes the icon's oxblood.
    background_color: "#fafafa",
    theme_color: "#4a1523",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
