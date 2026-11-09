// "Random name" button. This is UI only: it picks a name to feed the seeded
// generator. It uses crypto, not Math.random, and never touches generation.
const FIRST = [
  "Ada", "Grace", "Alan", "Katherine", "Linus", "Margaret", "Dennis", "Hedy", "Claude",
  "Marie", "Isaac", "Rosalind", "Nikola", "Emmy", "Carl", "Sofia", "Leonhard", "Maryam",
];
const LAST = [
  "Lovelace", "Hopper", "Turing", "Johnson", "Torvalds", "Hamilton", "Ritchie", "Lamarr",
  "Shannon", "Curie", "Newton", "Franklin", "Tesla", "Noether", "Gauss", "Kovalevskaya",
  "Euler", "Mirzakhani",
];

function randomInt(n) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % n;
}

export function randomName() {
  return `${FIRST[randomInt(FIRST.length)]} ${LAST[randomInt(LAST.length)]}`;
}
