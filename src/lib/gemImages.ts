/**
 * Maps each gem's stable `slug` to its sketch image in /public/gem-pic.
 * Shown on the hunt screen in place of the placeholder before a team submits
 * their own photo. If you add a new gem, add its sketch here (or it falls back
 * to a placeholder icon).
 */
const GEM_IMAGES: Record<string, string> = {
  "slavery-memorial": "/gem-pic/slaveryMemorial.png",
  "advice-from-a-former-student": "/gem-pic/AdviceFromaFormerStudent.png",
  "idee-di-pietra": "/gem-pic/IdeeDiPietra.png",
  "brown-bear": "/gem-pic/BrownBear.png",
  "casey-shearer-memorial": "/gem-pic/caseyShearerMemorial.png",
  "reclining-figure": "/gem-pic/recliningFigure.png",
  "marcus-aurelius": "/gem-pic/marcusAurelius.png",
  "war-memorial": "/gem-pic/warMemorial.png",
  "one-and-a-half": "/gem-pic/1_1_2.png",
  "america-one": "/gem-pic/americaOne.png",
  "infinite-possibility": "/gem-pic/infinitePossibility.png",
  "swearer-bear": "/gem-pic/swearerBear.png",
  "little-bear-fountain": "/gem-pic/littleBearFountain.png",
  "circle-dance": "/gem-pic/circleDance.png",
  "guardian-birds": "/gem-pic/gurdianBirds.png",
  "pembroke-tribute-garden": "/gem-pic/pembrokeTributeGarden.png",
  "lines-of-sight": "/gem-pic/linesOfSight.png",
  "posture-mirror": "/gem-pic/postureMirror.png",
  "indomitable": "/gem-pic/Indomitable.png",
  "infinite-composition": "/gem-pic/infiniteComposition.png",
};

export function gemImageForSlug(slug: string | undefined | null): string | null {
  if (!slug) return null;
  return GEM_IMAGES[slug] ?? null;
}
