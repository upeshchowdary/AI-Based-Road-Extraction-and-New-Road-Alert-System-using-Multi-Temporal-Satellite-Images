import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { lazy, Suspense, useEffect } from 'react'
import { Hero } from '@/features/home/Hero'
import { Preloader } from '@/features/home/Preloader'

const HomeRest = lazy(() => import('@/features/home/HomeRest'))

function Settled() {
  // sections below the hero change the page height once they mount: re-measure scroll triggers
  useEffect(() => {
    requestAnimationFrame(() => ScrollTrigger.refresh())
  }, [])
  return null
}

export default function HomePage() {
  useEffect(() => {
    document.title = 'RoadWatch — every new road, seen first'
  }, [])
  return (
    <>
      <Preloader />
      <Hero />
      <Suspense fallback={<div id="how-it-works" className="min-h-screen border-t border-line bg-bg0" aria-busy="true" />}>
        <HomeRest />
        <Settled />
      </Suspense>
    </>
  )
}
