import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { SessionProvider } from 'next-auth/react'
import { Toaster } from '@/components/ui/sonner'

const commitMono = localFont({
  src: [
    { path: './fonts/CommitMono-400-Regular.otf', weight: '400', style: 'normal' },
    { path: './fonts/CommitMono-400-Italic.otf',  weight: '400', style: 'italic' },
    { path: './fonts/CommitMono-700-Regular.otf', weight: '700', style: 'normal' },
    { path: './fonts/CommitMono-700-Italic.otf',  weight: '700', style: 'italic' },
  ],
  variable: '--font-commit-mono',
  display: 'swap',
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
    <html lang="en" className={commitMono.variable}>
      <body className="bg-zinc-50">
        <SessionProvider>
          {children}
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  )
}
