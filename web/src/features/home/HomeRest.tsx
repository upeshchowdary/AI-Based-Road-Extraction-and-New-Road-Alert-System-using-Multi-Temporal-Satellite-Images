import { Bento } from './Bento'
import { Audiences, FinalCta, OpenData, Results } from './HomeSections'
import { Pipeline } from './Pipeline'
import { PixelVsRoadwatch } from './PixelVsRoadwatch'
import { Problem } from './Problem'
import { Timelapse } from './Timelapse'

/** Everything below the hero — loaded right after first paint so the hero ships first. */
export default function HomeRest() {
  return (
    <>
      <Problem />
      <Pipeline />
      <PixelVsRoadwatch />
      <Bento />
      <Timelapse />
      <Audiences />
      <Results />
      <OpenData />
      <FinalCta />
    </>
  )
}
