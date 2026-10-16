import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, Outlet, useParams } from 'react-router'
import { SiteLayout } from './app/site/SiteLayout'
import { RouteError } from './app/RouteError'

// one product (docs/ui/redesign_v2.md): landing + a single shell with Map · Alerts · Results · Data · Docs
const Home = lazy(() => import('./app/site/HomePage'))
const NotFound = lazy(() => import('./app/site/NotFoundPage'))
const Shell = lazy(() => import('./app/shell/ProductShell'))
const MapPage = lazy(() => import('./app/site/ExplorePage'))
const AlertsInbox = lazy(() => import('./app/console/AlertsInbox'))
const AlertDetail = lazy(() => import('./app/console/AlertDetail'))
const Results = lazy(() => import('./app/site/ResearchPage'))
const DataPage = lazy(() => import('./app/console/SystemPage'))
const Docs = lazy(() => import('./app/site/DocsPage'))
const Attributions = lazy(() => import('./app/site/AttributionsPage'))

function S({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="min-h-dvh bg-bg0" aria-busy="true" />}>{children}</Suspense>
}

/** Old links (v1) keep working. */
function AlertRedirect() {
  const { id } = useParams()
  return <Navigate to={`/alerts/${id}`} replace />
}

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      {
        element: <SiteLayout />,
        children: [
          { index: true, element: <S><Home /></S> },
          { path: '*', element: <S><NotFound /></S> },
        ],
      },
      {
        element: <S><Shell /></S>,
        children: [
          { path: 'map', element: <MapPage /> },
          { path: 'alerts', element: <AlertsInbox /> },
          { path: 'alerts/:id', element: <AlertDetail /> },
          { path: 'results', element: <Results /> },
          { path: 'data', element: <DataPage /> },
          { path: 'docs', element: <Docs /> },
          { path: 'docs/:slug', element: <Docs /> },
          { path: 'attributions', element: <Attributions /> },
        ],
      },
      // v1 redirects
      { path: 'explore', element: <Navigate to="/map" replace /> },
      { path: 'research', element: <Navigate to="/results" replace /> },
      { path: 'app', element: <Navigate to="/map" replace /> },
      { path: 'app/alerts', element: <Navigate to="/alerts" replace /> },
      { path: 'app/alerts/:id', element: <AlertRedirect /> },
      { path: 'app/system', element: <Navigate to="/data" replace /> },
      { path: 'app/*', element: <Navigate to="/map" replace /> },
    ],
  },
])

export { Outlet }
