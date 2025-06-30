'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

type Props = {
    children: React.ReactNode
    attribute?: 'class' | 'data-theme'
    defaultTheme?: string
    enableSystem?: boolean
}

export function ThemeProvider({
    children,
    attribute = 'class',
    defaultTheme = 'system',
    enableSystem = true,
}: Props) {
    return (
        <NextThemesProvider
            attribute={attribute}
            defaultTheme={defaultTheme}
            enableSystem={enableSystem}
        >
            {children}
        </NextThemesProvider>
    )
}
