import { MapExperience } from "@/components/map/MapExperience";

/**
 * The demo map — the whole map experience, including setting your own deposit,
 * rate and hold period, running on demo listings. Open to anyone: there is no
 * real analysis here to protect, and being able to drive it is the point.
 */
export default function DemoMapPage() {
  return <MapExperience demo />;
}
