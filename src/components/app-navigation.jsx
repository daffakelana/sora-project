"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  BookOpenText,
  ChartNoAxesColumnIncreasing,
  Home,
  Menu,
  PenLine,
  Sparkles,
  User,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: Sparkles },
  { href: "/vocabulary", label: "Kosakata", icon: BookOpenText },
  { href: "/practice", label: "Latihan", icon: PenLine },
  {
    href: "/progress",
    label: "Progress",
    icon: ChartNoAxesColumnIncreasing,
  },
]

const hiddenRoutes = ["/login", "/signup"]
const hiddenRoutePrefixes = ["/vocabulary/"]

function isActivePath(pathname, href) {
  if (href === "/") {
    return pathname === "/"
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppNavigation({ profile }) {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  if (
    hiddenRoutes.some((route) => pathname === route) ||
    hiddenRoutePrefixes.some((route) => pathname.startsWith(route))
  ) {
    return null
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-4 sm:px-8"
      >
        <Link href="/" className="font-serif text-xl font-medium tracking-tight">
          German Vocab
        </Link>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="sm:hidden"
          onClick={() => setIsMenuOpen(true)}
          aria-label="Buka menu"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-navigation-sheet"
        >
          <Menu className="size-5" />
        </Button>

        <div className="hidden items-center gap-1 overflow-x-auto sm:flex">
          {navLinks.map((item) => {
            const Icon = item.icon
            const active = isActivePath(pathname, item.href)

            return (
              <Button
                asChild
                key={item.href}
                variant={active ? "default" : "outline"}
              >
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                </Link>
              </Button>
            )
          })}
          <Button
            asChild
            variant={isActivePath(pathname, "/profile") ? "default" : "outline"}
          >
            <Link href="/profile" title="Profil">
              {profile?.avatar ? (
                <img
                  src={profile.avatar}
                  alt=""
                  className="size-5 rounded-full object-cover"
                />
              ) : (
                <User className="size-4" />
              )}
              <span className="max-w-32 truncate">
                {profile?.name ?? "Profil"}
              </span>
            </Link>
          </Button>
        </div>
      </nav>

      <div
        className={cn(
          "fixed inset-0 z-50 transition sm:hidden",
          isMenuOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!isMenuOpen}
      >
        <button
          type="button"
          className={cn(
            "absolute inset-0 bg-black/30 transition",
            isMenuOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setIsMenuOpen(false)}
          aria-label="Tutup menu"
        />

        <div
          id="mobile-navigation-sheet"
          className={cn(
            "absolute inset-x-0 bottom-0 rounded-t-3xl border border-border bg-background p-5 shadow-2xl transition duration-300",
            isMenuOpen ? "translate-y-0" : "translate-y-full"
          )}
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="font-serif text-xl font-medium tracking-tight">
                German Vocab
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Pilih halaman
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setIsMenuOpen(false)}
              aria-label="Tutup menu"
            >
              <X className="size-5" />
            </Button>
          </div>

          <div className="space-y-2">
            {navLinks.map((item) => {
              const Icon = item.icon
              const active = isActivePath(pathname, item.href)

              return (
                <Button
                  asChild
                  key={item.href}
                  variant={active ? "default" : "outline"}
                  className="h-auto w-full justify-between px-4 py-3"
                >
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="size-4" />
                      {item.label}
                    </span>
                    <span className="text-xs opacity-60">Buka</span>
                  </Link>
                </Button>
              )
            })}
            <Button
              asChild
              variant={isActivePath(pathname, "/profile") ? "default" : "outline"}
              className="h-auto w-full justify-between px-4 py-3"
            >
              <Link href="/profile" onClick={() => setIsMenuOpen(false)}>
                <span className="flex items-center gap-3">
                  {profile?.avatar ? (
                    <img
                      src={profile.avatar}
                      alt=""
                      className="size-5 rounded-full object-cover"
                    />
                  ) : (
                    <User className="size-4" />
                  )}
                  {profile?.name ?? "Profil"}
                </span>
                <span className="text-xs opacity-60">Buka</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
