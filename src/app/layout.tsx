
'use client'

import { ThemeProvider } from '@/components/theme/theme-provider'
import { ToggleThemeButton } from '@/components/theme/toggle-theme-button'
import './global.css'
import { usePathname } from 'next/navigation'


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="relative">

        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <div className="absolute top-4 right-4 z-50">
            <ToggleThemeButton />
          </div>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
