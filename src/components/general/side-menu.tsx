"use client"

import { useState } from "react"
import { Home, ChevronDown, ChevronLeft, ChevronRight, Menu, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { useSideMenu } from "@/context/SideMenuContext"
import { useRouter } from "next/navigation"

export function SideMenu() {
  const t = useTranslations("Navigation")
  const [openSummary, setOpenSummary] = useState(false)
  const { collapsed, setCollapsed } = useSideMenu()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()

  function handleLogout() {
    localStorage.removeItem("piholesAuth")
    localStorage.removeItem("yapdAuthTime")
    router.push("/login")
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 md:hidden"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        <Menu className="size-5" />
      </Button>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full flex-col border-r bg-background transition-transform duration-300 md:flex ",
          collapsed ? "w-14" : "w-64",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between p-2 pt-10">
          <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} className="hidden md:inline-flex">
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 text-sm">
          <ul className="space-y-2">
            <li>
              <Link
                href="/"
                className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent hover:text-accent-foreground"
              >
                <Home className="size-4" />
                {!collapsed && t("home")}
              </Link>
            </li>
            <li>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md px-2 py-1 hover:bg-accent"
                onClick={() => setOpenSummary((o) => !o)}
              >
                <span className={collapsed ? "sr-only" : undefined}>{t("summary")}</span>
                {!collapsed && (
                  <ChevronDown className={cn("size-4 transition-transform", openSummary && "rotate-180")} />
                )}
              </button>
              {openSummary && !collapsed && (
                <ul className="mt-1 space-y-1 pl-4">
                  <li>
                    <Link
                      href="/summary/top-clients"
                      className="block rounded-md px-2 py-1 hover:bg-accent hover:text-accent-foreground"
                    >
                      {t("topClients")}
                    </Link>
                  </li>
                </ul>
              )}
            </li>
          </ul>
        </nav>
        <div className="border-t p-2">
          <Button
            variant="ghost"
            className="flex w-full items-center gap-2"
            onClick={handleLogout}
          >
            <LogOut className="size-4" />
            {!collapsed && t("logout")}
          </Button>
        </div>
      </aside>
    </>
  )
}
