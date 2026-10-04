import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** Shared look for generated link-preview images (brand colors from globals.css). */
export function ogCard({
  eyebrow,
  title,
  footer,
}: {
  eyebrow: string;
  title: string;
  footer: string;
}) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#faf7f2",
        borderBottom: "24px solid #2f6b4f",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 30,
          fontWeight: 700,
          color: "#a84b25",
          letterSpacing: 2,
        }}
      >
        {eyebrow.toUpperCase()}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: title.length > 40 ? 72 : 88,
          fontWeight: 700,
          color: "#1f2a24",
          lineHeight: 1.1,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", fontSize: 32, color: "#575f59" }}>{footer}</div>
    </div>,
    OG_SIZE,
  );
}
