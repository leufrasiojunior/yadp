"use client"

import { useState } from "react"
import { Menu, Home, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetTrigger, SheetContent, SheetClose } from "@/components/ui/sheet"
import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

export function SideMenu() {
  const t = useTranslations("Navigation")
  const [openSummary, setOpenSummary] = useState(false)

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon">
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <nav className="p-4 text-sm">
          <ul className="space-y-2">
            <li>
              <SheetClose asChild>
                <Link
                  href="/"
                  className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent hover:text-accent-foreground"
                >
                  <Home className="size-4" />
                  {t("home")}
                </Link>
              </SheetClose>
            </li>
            <li>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md px-2 py-1 hover:bg-accent"
                onClick={() => setOpenSummary((o) => !o)}
              >
                <span>{t("summary")}</span>
                <ChevronDown className={cn("size-4 transition-transform", openSummary && "rotate-180")}/>
              </button>
              {openSummary && (
                <ul className="mt-1 space-y-1 pl-4">
                  <li>
                    <SheetClose asChild>
                      <Link
                        href="/summary/top-clients"
                        className="block rounded-md px-2 py-1 hover:bg-accent hover:text-accent-foreground"
                      >
                        {t("topClients")}
                      </Link>
                    </SheetClose>
                  </li>
                </ul>
              )}
            </li>
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
