import { PageIntro, Section } from '@/components/site/PageIntro'

/** Mirrors LICENSES_DATA.md plus everything the UI ships. Keep both in sync. */
const DATA_ROWS = [
  ['Copernicus Sentinel-2 L2A', 'Seasonal composites (zones A–C, 2022–2026)', 'Copernicus open data terms', 'Contains modified Copernicus Sentinel data 2022–2026', 'https://sentinels.copernicus.eu/'],
  ['Microsoft Planetary Computer', 'STAC access to Sentinel-2', 'Data under source terms', 'Microsoft Planetary Computer', 'https://planetarycomputer.microsoft.com/'],
  ['OpenStreetMap', 'Roads, AP/district boundaries, road labels', 'ODbL 1.0', '© OpenStreetMap contributors', 'https://www.openstreetmap.org/copyright'],
  ['OpenFreeMap', 'Vector basemap tiles and fonts', 'Free, OSM-based', '© OpenFreeMap © OpenStreetMap contributors', 'https://openfreemap.org/'],
  ['AWS Terrain Tiles', 'Hillshade (terrarium elevation)', 'Open data (various sources)', 'Terrain Tiles, AWS Open Data', 'https://registry.opendata.aws/terrain-tiles/'],
  ['EOX Sentinel-2 cloudless 2016', 'Optional satellite basemap on /explore', 'CC BY 4.0', 'Sentinel-2 cloudless 2016 by EOX IT Services GmbH', 'https://s2maps.eu/'],
  ['NASA Visible Earth', 'Blue Marble (day) and Black Marble (night) globe textures', 'Public domain', 'NASA Visible Earth', 'https://visibleearth.nasa.gov/'],
]

const SOFTWARE_ROWS = [
  ['Geist, Geist Mono', 'UI and data typefaces', 'SIL OFL 1.1'],
  ['Instrument Serif', 'Editorial accent', 'SIL OFL 1.1'],
  ['React, React Router', 'App framework', 'MIT'],
  ['Vite, Tailwind CSS', 'Build and styling', 'MIT'],
  ['three.js, React Three Fiber, drei', '3D globe', 'MIT'],
  ['GSAP (incl. ScrollTrigger, SplitText)', 'Scroll and timeline motion', 'GSAP standard licence (free)'],
  ['Lenis', 'Smooth scrolling (public pages)', 'MIT'],
  ['Motion', 'UI micro-motion', 'MIT'],
  ['MapLibre GL JS', 'Maps', 'BSD-3-Clause'],
  ['Radix UI, cmdk, sonner, vaul', 'Accessible primitives, command palette, toasts, sheets', 'MIT'],
  ['Lucide', 'Icons', 'ISC'],
  ['detect-gpu', 'Quality tiers', 'MIT'],
  ['marked', 'Docs rendering', 'MIT'],
]

export default function AttributionsPage() {
  return (
    <>
      <PageIntro docTitle="Attributions" title="Attributions" lead="Every dataset, imagery source, typeface and library this site uses, with its licence." />
      <Section title="Data and imagery">
        <div className="overflow-x-auto rounded-panel border border-line">
          <table className="w-full min-w-[760px] text-left text-[14px]">
            <caption className="sr-only">Data and imagery sources</caption>
            <thead>
              <tr className="border-b border-line text-[13px] text-muted">
                <th className="p-4 font-normal">Source</th>
                <th className="p-4 font-normal">Used for</th>
                <th className="p-4 font-normal">Licence</th>
                <th className="p-4 font-normal">Attribution</th>
              </tr>
            </thead>
            <tbody>
              {DATA_ROWS.map(([n, u, l, a, href]) => (
                <tr key={n} className="border-b border-line align-top last:border-0">
                  <th scope="row" className="p-4 font-normal">
                    <a href={href} target="_blank" rel="noreferrer" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-sentinel">
                      {n}
                    </a>
                  </th>
                  <td className="p-4 text-muted">{u}</td>
                  <td className="t-mono p-4 text-[13px] text-fg">{l}</td>
                  <td className="p-4 text-muted">{a}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-3xl text-[14px] text-muted">
          No government emblems or logos are used. NTRO, ISRO, NRSC and KL University are named in text only. National boundaries are deliberately not drawn on any map;
          only the Andhra Pradesh state and district boundaries from OpenStreetMap are shown.
        </p>
      </Section>
      <Section title="Typefaces and software" className="border-b-0">
        <div className="overflow-x-auto rounded-panel border border-line">
          <table className="w-full min-w-[560px] text-left text-[14px]">
            <caption className="sr-only">Typefaces and software libraries</caption>
            <tbody>
              {SOFTWARE_ROWS.map(([n, u, l]) => (
                <tr key={n} className="border-b border-line last:border-0">
                  <th scope="row" className="p-4 font-normal text-fg">
                    {n}
                  </th>
                  <td className="p-4 text-muted">{u}</td>
                  <td className="t-mono p-4 text-[13px] text-fg">{l}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}
