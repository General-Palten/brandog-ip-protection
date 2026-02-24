/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SERPAPI_SERVER_KEY: process.env.SERPAPI_API_KEY ? 'true' : 'false',
  },
};

export default nextConfig;
