import { ImageResponse } from "next/og";
import AppMark from "@/app/components/AppMark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple's home-screen touch icon. No rounded-corner masking needed - iOS
// applies its own.
export default function AppleIcon() {
  return new ImageResponse(<AppMark size={size.width} />, { ...size });
}
