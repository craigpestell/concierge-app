import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";

// The picture shown when the site is shared in a text, Facebook post or search card.
export const alt = `${brand.name}: house and pet sitting and personal concierge help in ${brand.area}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#1d3a40",
          color: "#f5efe3",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 6, textTransform: "uppercase", color: "#c9a45c" }}>
          Personal concierge
        </div>
        <div style={{ display: "flex", fontSize: 96, marginTop: 24 }}>{brand.name}</div>
        <div style={{ display: "flex", width: 160, height: 3, background: "#c9a45c", marginTop: 36, marginBottom: 36 }} />
        <div style={{ display: "flex", fontSize: 40, color: "#e9d7ae" }}>House &amp; pet sitting · errands · everyday help</div>
        <div style={{ display: "flex", fontSize: 32, marginTop: 16, color: "#cfd8d6" }}>New Westminster &amp; Burnaby, BC</div>
      </div>
    ),
    size,
  );
}
