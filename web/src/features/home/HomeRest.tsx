import { FinalCta, OpenData, Results } from './HomeSections'
import { Pipeline } from './Pipeline'
import { Timelapse } from './Timelapse'

/** Below the hero (redesign v2): how it works -> real imagery -> live results -> open data -> CTA. */
export default function HomeRest() {
  return (
    <>
      <Pipeline />
      <Timelapse />
      <Results />
      <OpenData />
      <FinalCta />
    </>
  )
}
