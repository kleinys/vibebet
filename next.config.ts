import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Anchor the Turbopack workspace root to this folder. Otherwise Next picks
  // up the parent `marketing/package-lock.json` and warns about ambiguity.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
