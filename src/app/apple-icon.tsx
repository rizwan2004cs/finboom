import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #f8f8fa, #e8e8ed)",
          borderRadius: 38,
          position: "relative",
        }}
      >
        <span
          style={{
            fontSize: 110,
            fontWeight: 700,
            color: "#1d1d1f",
            fontFamily: "Georgia, serif",
            letterSpacing: "-3px",
          }}
        >
          F
        </span>
        <div
          style={{
            position: "absolute",
            top: 32,
            right: 28,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "radial-gradient(circle at 38% 32%, #6ee78a, #34c759)",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
