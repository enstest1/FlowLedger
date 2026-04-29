import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { SessionProvider } from 'next-auth/react'
import { Toaster } from '@/components/ui/sonner'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'FlowLedger — Invoice. Approve. Settle. Privately.',
  description:
    'Private invoice, approval, and payment workflow for Canton Network teams.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={jetbrainsMono.variable}>
        <SessionProvider>
          {children}
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  )
}
