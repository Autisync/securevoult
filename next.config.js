/** @type {import('next').NextConfig} */

const nextConfig = {
    // Enable static export for extension build
    // Docker sets NEXT_OUTPUT=standalone: a small self-contained server in .next/standalone.
    output: process.env.BUILD_TARGET === 'extension' ? 'export' : process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
    trailingSlash: process.env.BUILD_TARGET === 'extension',
    assetPrefix: process.env.BUILD_TARGET === 'extension' ? './' : undefined,
    async headers() {
        const securityHeaders = [
            {
                key: 'X-Frame-Options',
                value: 'DENY',
            },
            {
                key: 'X-Content-Type-Options',
                value: 'nosniff',
            },
            {
                key: 'Referrer-Policy',
                value: 'strict-origin-when-cross-origin',
            },
            {
                key: 'Permissions-Policy',
                value: 'camera=(), microphone=(), geolocation=()'
            },
            {
                key: 'Content-Security-Policy',
                value: [
                    "default-src 'self'",
                    "base-uri 'self'",
                    "frame-ancestors 'none'",
                    "object-src 'none'",
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.gstatic.com https://apis.google.com",
                    "style-src 'self' 'unsafe-inline'",
                    "img-src 'self' data: blob: https:",
                    "font-src 'self' data: https:",
                    "connect-src 'self' https: wss:",
                    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
                    "form-action 'self' https://checkout.stripe.com",
                ].join('; '),
            },
        ];

        if (process.env.NODE_ENV === 'production') {
            securityHeaders.push({
                key: 'Strict-Transport-Security',
                value: 'max-age=31536000; includeSubDomains; preload',
            });
        }

        return [
            {
                source: '/:path*',
                headers: securityHeaders,
            },
        ];
    },
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