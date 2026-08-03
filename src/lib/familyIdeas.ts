/**
 * Family-time idea generator. A rotating pool of kid-friendly activities so
 * "what should we do tonight?" always has fresh answers. Works fully offline;
 * {kid} is swapped for one of your kids' names when available.
 */
export const FAMILY_IDEAS: string[] = [
  'Family bike ride around the neighborhood',
  'Build the tallest Lego tower you can with {kid}',
  'Backyard soccer or play catch',
  'Cook or bake something together — let {kid} pick the recipe',
  'Family movie night with popcorn',
  'Read a chapter of a book out loud together',
  'Nature walk with a little scavenger hunt',
  'Draw or paint together',
  'Board game or card night (Uno, Guess Who)',
  'Dance party in the living room',
  'Build a pillow fort',
  'Simple science experiment (baking-soda volcano)',
  'Go to the park or playground',
  'Ride scooters or roller skate',
  'Puzzle night',
  'Sprinkler or water-balloon fun',
  'Stargazing in the backyard',
  'Make a craft out of the recycling bin',
  'Set up an obstacle course in the yard',
  'Teach {kid} to make a simple snack',
  'Visit the library and pick new books',
  'Bake and decorate cookies',
  'Family walk after dinner',
  'Play hide-and-seek',
  'Have a picnic (indoors counts!)',
  'Build and race paper airplanes',
  'Family talent show',
  'Plant something in the garden',
  'Play charades',
  'Story chain: everyone adds one sentence',
]

/** Return n distinct ideas, personalized with a kid's name where relevant. */
export function pickIdeas(n: number, kids: string[] = []): string[] {
  const pool = [...FAMILY_IDEAS]
  // Fisher-Yates shuffle (runtime randomness is fine in the app).
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const nameFor = () => (kids.length ? kids[Math.floor(Math.random() * kids.length)] : 'the kids')
  return pool.slice(0, Math.max(1, n)).map((idea) => idea.replace('{kid}', nameFor()))
}
