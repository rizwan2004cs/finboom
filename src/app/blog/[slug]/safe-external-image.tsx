"use client"

import { useState } from "react"
import { ZoomableImage } from "./zoomable-image"

// External image URLs in AI-generated posts can 404 (hallucinated stock
// photo IDs in older posts). Hide the figure until the image actually
// loads, and remove it entirely if it fails.
export function SafeExternalImage({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  if (failed) return null

  return (
    <ZoomableImage src={url} alt={alt}>
      <div className={loaded ? "my-8 rounded-xl overflow-hidden" : "hidden"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt}
          className="w-full rounded-xl"
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      </div>
    </ZoomableImage>
  )
}
