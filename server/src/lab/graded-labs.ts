/**
 * Graded labs Andy offers in the picker and as Voshi assessment locations.
 * Add a lab here once — locations catalog and picker both derive from this list.
 */
export const GRADED_LABS = [
  {
    id: "doorbell",
    label: "Doorbell Demo",
    points: 100,
    src: "/labs/doorbell.yaml",
  },
  {
    id: "single-pole-lamp",
    label: "Single-Pole Lamp",
    points: 100,
    src: "/labs/single-pole-lamp.yaml",
  },
  {
    id: "three-way-lamp",
    label: "Three-Way Lamp",
    points: 100,
    src: "/labs/three-way-lamp.yaml",
  },
  {
    id: "four-way-lamp",
    label: "Four-Way Lamp",
    points: 100,
    src: "/labs/four-way-lamp.yaml",
  },
  {
    id: "gfci-downstream",
    label: "GFCI Downstream",
    points: 100,
    src: "/labs/gfci-downstream.yaml",
  },
  {
    id: "multi-wire-branch",
    label: "Multi-Wire Branch",
    points: 100,
    src: "/labs/multi-wire-branch.yaml",
  },
] as const;

export type GradedLabId = (typeof GRADED_LABS)[number]["id"];

/**
 * Builds the Voshi content-picker locations map (extid → assessment metadata).
 */
export function voshiLocationsCatalog(): Record<
  string,
  { type: "assessment"; label: string; points: number }
> {
  const locations: Record<
    string,
    { type: "assessment"; label: string; points: number }
  > = {};
  for (const lab of GRADED_LABS) {
    locations[lab.id] = {
      type: "assessment",
      label: lab.label,
      points: lab.points,
    };
  }
  return locations;
}

/**
 * Builds picker entries for the lab shell (id, label, yaml src).
 */
export function labPickerEntries(): Array<{
  id: string;
  src: string;
  label: string;
}> {
  return GRADED_LABS.map((lab) => ({
    id: lab.id,
    src: lab.src,
    label: lab.label,
  }));
}
