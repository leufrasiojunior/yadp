import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/",
        permanent: false,
      },
      {
        source: "/pt-br/dashboard",
        destination: "/",
        permanent: false,
      },
      {
        source: "/en/dashboard",
        destination: "/",
        permanent: false,
      },
    ];
  },
}

export default withNextIntl(nextConfig);
