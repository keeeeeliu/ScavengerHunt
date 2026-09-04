/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // .nosync keeps iCloud Drive from syncing (and clobbering) the build output
  // on the local machine; cloud builds (Vercel etc.) use the standard .next.
  distDir: process.env.VERCEL || process.env.CI ? '.next' : '.next.nosync',
};

module.exports = nextConfig;
