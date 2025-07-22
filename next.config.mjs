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
        destination: "/pt-br/dashboard/default",
        permanent: false,
      },
      {
        source: "/pt-br/dashboard",
        destination: "/pt-br/dashboard/default",
        permanent: false,
      },
      {
        source: "/en/dashboard",
        destination: "/en/dashboard/default",
        permanent: false,
      },
    ];
  },
}

export default withNextIntl(nextConfig);
