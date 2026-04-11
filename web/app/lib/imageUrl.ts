import type { Artifact } from "../types";

export type ImageSize = "thumb" | "medium" | "full";

/**
 * Resolve an artifact's image URL at a specific size tier.
 *
 * - For new artifacts the API returns image_url like
 *   "/api/proxy/artifacts/{id}/image/medium". Swap the trailing
 *   size segment to request thumb/medium/full.
 * - For legacy artifacts image_url is a "data:image/...;base64,..."
 *   data URI. We can't resize it server-side, so we pass it through.
 */
export function imageUrl(art: Pick<Artifact, "image_url">, size: ImageSize): string {
  const url = art.image_url || "";
  if (!url) return "";
  if (url.startsWith("data:")) return url;
  return url.replace(/\/image\/(thumb|medium|full)$/, `/image/${size}`);
}
