import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "three",
    "@react-three/fiber",
    "@react-three/drei",
    "@tanstack/react-query",
    "@tanstack/query-core",
  ],
  turbopack: {
    resolveAlias: {
      "@tanstack/react-query": "@tanstack/react-query/build/modern/index.js",
      "@tanstack/query-core": "@tanstack/query-core/build/modern/index.js",
    },
  },
};

export default nextConfig;
