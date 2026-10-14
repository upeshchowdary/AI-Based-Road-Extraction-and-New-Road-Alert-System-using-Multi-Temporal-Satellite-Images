import { Outlet, useLocation } from 'react-router'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SiteNav } from '@/components/site/SiteNav'
import { SmoothScroll } from '@/lib/smoothScroll'

export function SiteLayout() {
  const { pathname } = useLocation()
  // Lenis smooth scroll only on Home ("/") where the scroll-pinned 3D
  // hero actually needs it. All other pages use native browser scroll.
  const isHome = pathname === '/'
  return (
    <SmoothScroll enableLenis={isHome}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <SiteNav overlay={isHome} />
      <main id="main" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <SiteFooter />
    </SmoothScroll>
  )
}

