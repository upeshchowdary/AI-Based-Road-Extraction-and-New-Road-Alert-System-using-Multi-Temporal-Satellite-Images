import { Outlet, useLocation } from 'react-router'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SiteNav } from '@/components/site/SiteNav'
import { SmoothScroll } from '@/lib/smoothScroll'

export function SiteLayout() {
  const { pathname } = useLocation()
  return (
    <SmoothScroll>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <SiteNav overlay={pathname === '/'} />
      <main id="main" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <SiteFooter />
    </SmoothScroll>
  )
}
