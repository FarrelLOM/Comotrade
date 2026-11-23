/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    agentUpgrade: 'security',
  },
  turbopack: {
    root: `${import.meta.dirname}`,
  },
};

export default nextConfig;
