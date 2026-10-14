import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Outlet } from 'react-router'
import { SiteLayout } from './app/site/SiteLayout'
import { RouteError } from './app/RouteError'

const Home = lazy(() => import('./app/site/HomePage'))
const Explore = lazy(() => import('./app/site/ExplorePage'))
const Platform = lazy(() => import('./app/site/PlatformPage'))
const Capabilities = lazy(() => import('./app/site/CapabilitiesPage'))
const Solution = lazy(() => import('./app/site/SolutionPage'))
const Research = lazy(() => import('./app/site/ResearchPage'))
const About = lazy(() => import('./app/site/AboutPage'))
const Docs = lazy(() => import('./app/site/DocsPage'))
const Contact = lazy(() => import('./app/site/ContactPage'))
const Attributions = lazy(() => import('./app/site/AttributionsPage'))
const Privacy = lazy(() => import('./app/site/PrivacyPage'))
const Stories = lazy(() => import('./app/site/StoriesPage'))
const Story = lazy(() => import('./app/site/StoryPage'))
const DesignPage = lazy(() => import('./app/site/DesignPage'))
const NotFound = lazy(() => import('./app/site/NotFoundPage'))

const AppShell = lazy(() => import('./app/console/AppShell'))
const SignIn = lazy(() => import('./app/console/SignInPage'))
const CommandCenter = lazy(() => import('./app/console/CommandCenter'))
const AlertsInbox = lazy(() => import('./app/console/AlertsInbox'))
const AlertDetail = lazy(() => import('./app/console/AlertDetail'))
const ChangeExplorer = lazy(() => import('./app/console/ChangeExplorer'))
const Network = lazy(() => import('./app/console/NetworkPage'))
const Audit = lazy(() => import('./app/console/AuditPage'))
const Zones = lazy(() => import('./app/console/ZonesPage'))
const Ask = lazy(() => import('./app/console/AskPage'))
const Reports = lazy(() => import('./app/console/ReportsPage'))
const System = lazy(() => import('./app/console/SystemPage'))
const Settings = lazy(() => import('./app/console/SettingsPage'))

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
          { path: 'platform', element: <S><Platform /></S> },
          { path: 'capabilities', element: <S><Capabilities /></S> },
          { path: 'solutions/:slug', element: <S><Solution /></S> },
          { path: 'research', element: <S><Research /></S> },
          { path: 'about', element: <S><About /></S> },
          { path: 'docs', element: <S><Docs /></S> },
          { path: 'docs/:slug', element: <S><Docs /></S> },
          { path: 'contact', element: <S><Contact /></S> },
          { path: 'attributions', element: <S><Attributions /></S> },
          { path: 'privacy', element: <S><Privacy /></S> },
          { path: 'stories', element: <S><Stories /></S> },
          { path: 'stories/:slug', element: <S><Story /></S> },
          { path: 'design', element: <S><DesignPage /></S> },
          { path: '*', element: <S><NotFound /></S> },
        ],
      },
      { path: 'explore', element: <S><Explore /></S> },
      { path: 'app/sign-in', element: <S><SignIn /></S> },
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
          { path: 'audit', element: <S><Audit /></S> },
          { path: 'zones', element: <S><Zones /></S> },
          { path: 'ask', element: <S><Ask /></S> },
          { path: 'reports', element: <S><Reports /></S> },
          { path: 'system', element: <S><System /></S> },
          { path: 'settings', element: <S><Settings /></S> },
        ],
      },
    ],
  },
])

export { Outlet }
