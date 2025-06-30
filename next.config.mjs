import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig = {
  /* config options here */
};

export default withNextIntl(nextConfig);
