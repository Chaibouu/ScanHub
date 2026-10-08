/** @type {import('next').NextConfig} */
const nextConfig = {
    // Image Docker autonome (.next/standalone) — requis par le Dockerfile
    output: 'standalone',

    // Paquets Node natifs à ne pas bundler côté serveur
    serverExternalPackages: ['pino', 'pino-pretty', 'ioredis'],

    // Optimisations pour Next.js 15
    experimental: {
        // Amélioration des performances
        optimizePackageImports: ['@radix-ui/react-icons', 'lucide-react'],
        // Amélioration du bundling
        turbo: {
            rules: {
                '*.svg': {
                    loaders: ['@svgr/webpack'],
                    as: '*.js',
                },
            },
        },
    },

    // Configuration des images
    images: {
        remotePatterns: [

            {
                protocol: "https",
                hostname: "firebasestorage.googleapis.com",
                pathname: "**"
            },
        ],
        // Amélioration des performances d'image
        formats: ['image/webp', 'image/avif'],
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    },

    // Amélioration de la compression
    compress: true,

    // Configuration des en-têtes de sécurité
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    // Empêche le clickjacking
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    // Empêche le MIME sniffing
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    // Contrôle les infos transmises dans le Referer
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    // Force HTTPS pour 2 ans, incluant sous-domaines (activer en production)
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=63072000; includeSubDomains; preload',
                    },
                    // Protection XSS legacy (IE/Edge anciens)
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block',
                    },
                    // Restreint l'accès aux APIs sensibles du navigateur
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
                    },
                    // Content-Security-Policy définie dynamiquement dans middleware.ts
                    // (avec nonce par requête pour supprimer unsafe-inline des scripts)
                ],
            },
        ];
    },

    // Amélioration du tree-shaking
    webpack: (config, { dev, isServer }) => {
        // Optimisations pour la production
        if (!dev && !isServer) {
            config.optimization.splitChunks = {
                chunks: 'all',
                cacheGroups: {
                    vendor: {
                        test: /[\\/]node_modules[\\/]/,
                        name: 'vendors',
                        chunks: 'all',
                    },
                },
            };
        }

        return config;
    },
};

export default nextConfig;
