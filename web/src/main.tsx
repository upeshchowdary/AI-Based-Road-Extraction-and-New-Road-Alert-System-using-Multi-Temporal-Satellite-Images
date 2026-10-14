import '@fontsource-variable/geist/index.css'
import '@fontsource-variable/geist-mono/index.css'
import '@fontsource/instrument-serif/latin-400-italic.css'
import './design/globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './router'
import { PrefsEffects } from './app/PrefsEffects'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrefsEffects />
    <RouterProvider router={router} />
  </StrictMode>,
)
