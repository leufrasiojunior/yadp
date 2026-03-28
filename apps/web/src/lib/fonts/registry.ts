export const fontRegistry = {
  geist: {
    label: "Geist",
    variable: "--font-geist",
  },
  inter: {
    label: "Inter",
    variable: "--font-inter",
  },
  notoSans: {
    label: "Noto Sans",
    variable: "--font-noto-sans",
  },
  nunitoSans: {
    label: "Nunito Sans",
    variable: "--font-nunito-sans",
  },
  figtree: {
    label: "Figtree",
    variable: "--font-figtree",
  },
  roboto: {
    label: "Roboto",
    variable: "--font-roboto",
  },
  raleway: {
    label: "Raleway",
    variable: "--font-raleway",
  },
  dmSans: {
    label: "DM Sans",
    variable: "--font-dm-sans",
  },
  publicSans: {
    label: "Public Sans",
    variable: "--font-public-sans",
  },
  outfit: {
    label: "Outfit",
    variable: "--font-outfit",
  },
  geistMono: {
    label: "Geist Mono",
    variable: "--font-geist-mono",
  },
  geistPixelSquare: {
    label: "Geist Pixel Square",
    variable: "--font-geist-pixel-square",
  },
  jetBrainsMono: {
    label: "JetBrains Mono",
    variable: "--font-jetbrains-mono",
  },
  notoSerif: {
    label: "Noto Serif",
    variable: "--font-noto-serif",
  },
  robotoSlab: {
    label: "Roboto Slab",
    variable: "--font-roboto-slab",
  },
  merriweather: {
    label: "Merriweather",
    variable: "--font-merriweather",
  },
  lora: {
    label: "Lora",
    variable: "--font-lora",
  },
  playfairDisplay: {
    label: "Playfair Display",
    variable: "--font-playfair-display",
  },
} as const;

export type FontKey = keyof typeof fontRegistry;

export const fontVars = "";

export const fontOptions = (Object.entries(fontRegistry) as Array<[FontKey, (typeof fontRegistry)[FontKey]]>).map(
  ([key, font]) => ({
    key,
    label: font.label,
    variable: font.variable,
  }),
);
