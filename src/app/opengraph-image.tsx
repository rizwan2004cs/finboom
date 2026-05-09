import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const alt = "FinBoom - Know Your True Wealth";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  const playfairBold = await fetch(
    "https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKeiukDQ.ttf"
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(145deg, #f8f8fa 0%, #eaeaef 50%, #e2e2e8 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Playfair Display', Georgia, serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle radial glow behind icon */}
        <div
          style={{
            position: "absolute",
            top: 80,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(52,199,89,0.08) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Glass icon container */}
        <div style={{ display: "flex", position: "relative", marginBottom: 48 }}>
          <div
            style={{
              width: 160,
              height: 160,
              background: "linear-gradient(145deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.5) 100%)",
              borderRadius: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1.5px solid rgba(0,0,0,0.06)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)",
            }}
          >
            <span
              style={{
                fontSize: 100,
                fontWeight: 700,
                color: "#1d1d1f",
                letterSpacing: "-3px",
                fontFamily: "'Playfair Display', serif",
              }}
            >
              F
            </span>
          </div>
          {/* Green accent dot */}
          <div
            style={{
              position: "absolute",
              top: 28,
              right: 18,
              width: 26,
              height: 26,
              background: "radial-gradient(circle at 38% 32%, #6ee78a, #34c759, #1a8a38)",
              borderRadius: "50%",
              boxShadow: "0 2px 12px rgba(52,199,89,0.35)",
              display: "flex",
            }}
          />
        </div>

        {/* Brand name */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "0 80px",
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              marginBottom: 20,
              color: "#1d1d1f",
              fontFamily: "'Playfair Display', serif",
            }}
          >
            FinBoom
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#6e6e73",
              maxWidth: 800,
              lineHeight: 1.5,
              fontWeight: 400,
              letterSpacing: "0.01em",
              fontFamily: "'Playfair Display', serif",
            }}
          >
            Track net worth, income, expenses, and financial goals across 20+ asset classes.
          </div>
        </div>

        {/* Subtle bottom accent line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, transparent, rgba(52,199,89,0.4), transparent)",
            display: "flex",
          }}
        />
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Playfair Display",
          data: playfairBold,
          weight: 700,
          style: "normal",
        },
      ],
    }
  );
}