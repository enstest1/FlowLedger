import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from 'next-auth/react'
import { Toaster } from '@/components/ui/sonner'

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
      <body className="bg-zinc-50">
        <SessionProvider>
          {children}
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  )
}
