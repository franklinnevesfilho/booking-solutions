import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_10%_20%,_#bbf7d0_0%,_#dcfce7_35%,_#f8fafc_100%)] px-4 py-10 sm:px-6">
      <div className="absolute right-4 top-4 sm:right-6">
        <LanguageSwitcher />
      </div>
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">
        {children}
      </div>
    </div>
  )
}
