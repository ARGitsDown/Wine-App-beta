import { ImageResponse } from "next/og";
import AppMark from "@/app/components/AppMark";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// Serves both the browser favicon and the PWA manifest's icon.
export default function Icon() {
  return new ImageResponse(<AppMark size={size.width} />, { ...size });
}
