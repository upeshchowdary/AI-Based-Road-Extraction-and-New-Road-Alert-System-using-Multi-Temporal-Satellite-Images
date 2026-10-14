import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Outlet } from 'react-router'
import { SiteLayout } from './app/site/SiteLayout'
import { RouteError } from './app/RouteError'

const Home = lazy(() => import('./app/site/HomePage'))
const Explore = lazy(() => import('./app/site/ExplorePage'))
const Research = lazy(() => import('./app/site/ResearchPage'))
const Docs = lazy(() => import('./app/site/DocsPage'))
const Attributions = lazy(() => import('./app/site/AttributionsPage'))
const NotFound = lazy(() => import('./app/site/NotFoundPage'))

const AppShell = lazy(() => import('./app/console/AppShell'))
const CommandCenter = lazy(() => import('./app/console/CommandCenter'))
const AlertsInbox = lazy(() => import('./app/console/AlertsInbox'))
const AlertDetail = lazy(() => import('./app/console/AlertDetail'))
const ChangeExplorer = lazy(() => import('./app/console/ChangeExplorer'))
const Network = lazy(() => import('./app/console/NetworkPage'))
const Zones = lazy(() => import('./app/console/ZonesPage'))
const Reports = lazy(() => import('./app/console/ReportsPage'))
const System = lazy(() => import('./app/console/SystemPage'))

function S({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="min-h-dvh bg-bg0" aria-busy="true" />}>{children}</Suspense>
}

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      {
        element: <SiteLayout />,
        children: [
          { index: true, element: <S><Home /></S> },
          { path: 'research', element: <S><Research /></S> },
          { path: 'docs', element: <S><Docs /></S> },
          { path: 'docs/:slug', element: <S><Docs /></S> },
          { path: 'attributions', element: <S><Attributions /></S> },
          { path: '*', element: <S><NotFound /></S> },
        ],
      },
      { path: 'explore', element: <S><Explore /></S> },
      {
        path: 'app',
        element: (
          <S>
            <AppShell />
          </S>
        ),
        children: [
          { index: true, element: <S><CommandCenter /></S> },
          { path: 'alerts', element: <S><AlertsInbox /></S> },
          { path: 'alerts/:id', element: <S><AlertDetail /></S> },
          { path: 'explorer', element: <S><ChangeExplorer /></S> },
          { path: 'network', element: <S><Network /></S> },
          { path: 'zones', element: <S><Zones /></S> },
          { path: 'reports', element: <S><Reports /></S> },
          { path: 'system', element: <S><System /></S> },
        ],
      },
    ],
  },
])

export { Outlet }
