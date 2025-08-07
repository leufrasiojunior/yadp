import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "YAPD",
  version: packageJson.version,
  copyright: `© ${currentYear}`,
  meta: {
    title: "YAPD - Modern Next.js Dashboard admin interface for Pihole",
    description: "YAPD - Yet, another PiHole dashborad is a modern interface for PiHole using modern tecnologies",
  },
};
