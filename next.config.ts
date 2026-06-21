import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [64, 68, 72, 75, 88],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-eaf679ed02634f958b68991d910a997b.r2.dev',
      },
      {
        protocol: 'https',
        hostname: 'www.guilhermepilger.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/PDF/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
