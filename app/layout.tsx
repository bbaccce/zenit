import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Zenit — Health Dashboard',
  description: 'Personal health dashboard: calories, running, habits, and an AI coach — live data from Apple Watch.',
  applicationName: 'Zenit',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Zenit',
  },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon-32.png',
  },
  openGraph: {
    title: 'Zenit — Health Dashboard',
    description: 'Personal health dashboard: calories, running, habits, and an AI coach — live data from Apple Watch.',
    url: 'https://zenit-peach.vercel.app',
    siteName: 'Zenit',
    images: [
      {
        url: '/icon-512.png',
        width: 512,
        height: 512,
        alt: 'Zenit',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Zenit — Health Dashboard',
    description: 'Personal health dashboard: calories, running, habits, and an AI coach — live data from Apple Watch.',
    images: ['/icon-512.png'],
  },
}

export const viewport: Viewport = {
  themeColor: '#080810',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
