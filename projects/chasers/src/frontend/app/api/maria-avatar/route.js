import { readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_MARIA_AVATAR_PATH =
  "/Users/abhetu/.cursor/projects/Users-abhetu-Downloads-hackathon-2026-projects/assets/image-6a9412ac-18d3-4029-be28-ecd045a670c7.png";

export async function GET() {
  const imagePath = process.env.MARIA_AVATAR_PATH || DEFAULT_MARIA_AVATAR_PATH;

  try {
    const bytes = await readFile(imagePath);
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    // Fallback to static public avatar if custom file is unavailable.
    const fallbackPath = path.join(process.cwd(), "public", "next.svg");
    const fallbackBytes = await readFile(fallbackPath);
    return new Response(fallbackBytes, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=300",
      },
    });
  }
}
