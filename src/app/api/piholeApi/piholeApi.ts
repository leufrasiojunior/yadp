const piholeApi = {
  baseURL: process.env.NEXT_PUBLIC_PIHOLE_API_URL || "https://api.pi-hole.net",
  withCredentials: true,
  headers: {
    Authorization: `Bearer ${process.env.NEXT_PUBLIC_PIHOLE_API_TOKEN}`,
  },
};
