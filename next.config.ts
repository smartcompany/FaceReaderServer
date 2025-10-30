import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Allow importing plain text files (e.g., prompts) as raw strings
    config.module.rules.push({
      test: /\.txt$/i,
      type: 'asset/source',
    });
    return config;
  },
};

export default nextConfig;
