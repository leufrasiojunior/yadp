import LayoutWithSideMenu from "@/components/general/LayoutWithSideMenu";

export default function WithMenuLayout({ children }: { children: React.ReactNode }) {
  return <LayoutWithSideMenu>{children}</LayoutWithSideMenu>;
}
