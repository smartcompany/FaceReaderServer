import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // 서버 빌드 시 dummy-data 폴더를 포함하도록 설정
      config.module.rules.push({
        test: /\.json$/,
        type: 'asset/resource',
        generator: {
          filename: 'dummy-data/[name][ext]'
        }
      });
    }
    return config;
  },
};

export default nextConfig;
