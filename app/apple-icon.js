import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same design as icon.js, sized for Apple's home-screen touch icon
// convention (no rounded-corner masking needed - iOS applies its own).
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#18181b",
        }}
      >
        <svg width="100" height="105" viewBox="0 0 100 105">
          <path d="M15 8 Q15 65 50 65 Q85 65 85 8 Z" fill="#fafafa" />
          <rect x="47" y="65" width="6" height="25" fill="#fafafa" />
          <rect x="25" y="90" width="50" height="8" rx="4" fill="#fafafa" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
