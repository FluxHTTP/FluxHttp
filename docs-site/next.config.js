/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: process.env.NODE_ENV === 'production' ? '/fluxhttp-docs' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/fluxhttp-docs/' : '',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    appDir: true,
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.md$/,
      use: 'raw-loader',
    });
    return config;
  },
};

module.exports = nextConfig;