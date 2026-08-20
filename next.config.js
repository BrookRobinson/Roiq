/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      // Placeholder property photography on the marketing pages.
      // Replace with real NZ listing photography before launch.
      { protocol: "https", hostname: "picsum.photos" },
      // Mapbox Static Images: the NZ map preview on the landing page.
      { protocol: "https", hostname: "api.mapbox.com" },
    ],
  },
};

module.exports = nextConfig;
