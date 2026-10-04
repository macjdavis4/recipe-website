import { ogCard, OG_SIZE } from "@/lib/og";
import { SITE_NAME } from "@/lib/site";

export const alt = `${SITE_NAME}: recipes from real kitchens`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "Recipes from real kitchens",
    title: "Cook what you love. Share what works.",
    footer: SITE_NAME,
  });
}
