/** @type {import('next').NextConfig} */

const nextConfig = {
    // Enable static export for extension build
    output: process.env.BUILD_TARGET === 'extension' ? 'export' : undefined,
    trailingSlash: process.env.BUILD_TARGET === 'extension',
    assetPrefix: process.env.BUILD_TARGET === 'extension' ? './' : undefined,
    images: {
        unoptimized: process.env.BUILD_TARGET === 'extension',
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
                pathname: '/**',
            },
        ],
    },
};

module.exports = nextConfig;