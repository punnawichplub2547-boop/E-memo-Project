import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Packages that do dynamic require() internally and must NOT be bundled by
  // Turbopack — keep them external so they are traced into .next/standalone
  // (otherwise they go missing at runtime, e.g. nodemailer -> "All sends failed").
  serverExternalPackages: ["pdf-parse", "nodemailer"],
};

export default nextConfig;
