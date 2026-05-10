export const PRODUCT_TOUR_BROWSER_COOKIE_NAME = "yapd_tour_browser_id";
export const PRODUCT_TOUR_KEYS = ["overview-v1"] as const;

export type ProductTourKey = (typeof PRODUCT_TOUR_KEYS)[number];
