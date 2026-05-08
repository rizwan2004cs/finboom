import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "FinBoom - Know Your True Wealth";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#1d1d1f",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, sans-serif",
          color: "white",
        }}
      >
        {/* Brand Icon */}
        <div style={{ display: "flex", position: "relative", marginBottom: 60 }}>
          <div
            style={{
              width: 192,
              height: 192,
              background: "#1d1d1f",
              borderRadius: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "4px solid #333",
            }}
          >
            <span
              style={{
                fontSize: 120,
                fontWeight: 700,
                letterSpacing: "-4px",
                marginTop: 10,
              }}
            >
              F
            </span>
          </div>
          {/* Green dot */}
          <div
            style={{
              position: "absolute",
              top: 55 - 16,
              right: 192 - 140 - 16,
              width: 32,
              height: 32,
              background: "#34c759",
              borderRadius: "50%",
              opacity: 0.9,
            }}
          />
        </div>

        {/* Text Area */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "0 64px",
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: 24,
              color: "#ffffff",
            }}
          >
            FinBoom
          </div>
          <div
            style={{
              fontSize: 36,
              color: "#a1a1aa",
              maxWidth: 900,
              lineHeight: 1.4,
              fontWeight: 500,
            }}
          >
            Track net worth, income, expenses, and financial goals across 20+ asset classes.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}