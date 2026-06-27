import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: process.env.TITLE || "Sono Tracker",
    short_name: process.env.TITLE || "Sono Tracker",
    description: process.env.DESCRIPTION || "",
    start_url: "/",
    display: "fullscreen",
    display_override: ["fullscreen", "standalone", "minimal-ui", "browser"],
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#000000",
    scope: "/",
    icons: [
      {
        src: "/housing-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
