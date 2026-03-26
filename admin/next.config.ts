import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Monorepo: prefer this app’s folder over a parent lockfile when tracing standalone output.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
