export interface SolarSystemBody {
  name: string;
  color: string;
  radius: number;
  orbitRadius: number;
  periodDays: number;
  tilt: number;
  spin: number;
  atmosphere?: string;
  ring?: boolean;
  description: string;
  stats: [string, string, string, string, string];
  facts: [string, string, string];
}

export const SOLAR_SYSTEM_BODIES: SolarSystemBody[] = [
  {
    name: "Sun",
    color: "#ffb347",
    radius: 0.8,
    orbitRadius: 0,
    periodDays: 0,
    tilt: 0,
    spin: 0.05,
    description: "Our star, a ball of hot plasma holding 99.8% of the Solar System's mass.",
    stats: ["1,391,000 km", "—", "~27 Earth days", "—", "5,500 °C surface"],
    facts: ["G-type main-sequence star", "99.8% of the Solar System's mass", "Surface ≈ 5,500 °C"],
  },
  {
    name: "Mercury",
    color: "#a89c8c",
    radius: 0.08,
    orbitRadius: 1.5,
    periodDays: 88,
    tilt: 0.03,
    spin: 0.05,
    description: "The smallest planet, a cratered world with almost no atmosphere.",
    stats: ["4,879 km", "57.9 M km", "59 Earth days", "88 days", "−180 to 430 °C"],
    facts: ["Smallest planet", "Almost no atmosphere", "Day longer than its year"],
  },
  {
    name: "Venus",
    color: "#e6c88a",
    radius: 0.17,
    orbitRadius: 2.1,
    periodDays: 224.7,
    tilt: 177,
    spin: -0.03,
    atmosphere: "#ffd9a0",
    description: "Wrapped in thick clouds, with a runaway greenhouse effect hotter than Mercury.",
    stats: ["12,104 km", "108.2 M km", "243 days (retrograde)", "224.7 days", "465 °C"],
    facts: ["Thick clouds", "Hottest planet (465 °C)", "Rotates backwards"],
  },
  {
    name: "Earth",
    color: "#4a8fd8",
    radius: 0.18,
    orbitRadius: 2.85,
    periodDays: 365.25,
    tilt: 23.4,
    spin: 0.6,
    atmosphere: "#5aa0ff",
    description: "Our home, the only known world with liquid oceans and life.",
    stats: ["12,742 km", "149.6 M km", "24 hours", "365.25 days", "15 °C average"],
    facts: ["Our home planet", "One natural satellite: the Moon", "Known to support life"],
  },
  {
    name: "Mars",
    color: "#c9714a",
    radius: 0.11,
    orbitRadius: 3.6,
    periodDays: 687,
    tilt: 25.2,
    spin: 0.58,
    atmosphere: "#ff9a70",
    description: "A cold desert world with iron-rich red dust and polar ice caps.",
    stats: ["6,779 km", "227.9 M km", "24.6 hours", "687 days", "−65 °C average"],
    facts: ["Cold desert world", "Two moons: Phobos and Deimos", "Home of Olympus Mons"],
  },
  {
    name: "Jupiter",
    color: "#d4a878",
    radius: 0.48,
    orbitRadius: 5.6,
    periodDays: 4331,
    tilt: 3.1,
    spin: 1.4,
    description: "The largest planet. The Great Red Spot is a storm wider than Earth.",
    stats: ["139,820 km", "778.5 M km", "9.9 hours", "11.9 years", "95+ moons"],
    facts: ["Largest planet", "Great Red Spot is a giant storm", "95+ known moons"],
  },
  {
    name: "Saturn",
    color: "#e3cc98",
    radius: 0.41,
    orbitRadius: 7.8,
    periodDays: 10747,
    tilt: 26.7,
    spin: 1.3,
    ring: true,
    description: "Famous for its bright rings of ice and rock, and light enough to float on water.",
    stats: ["116,460 km", "1,434 M km", "10.7 hours", "29.5 years", "145+ moons"],
    facts: ["Iconic rings of ice and rock", "Least dense planet", "145+ known moons"],
  },
  {
    name: "Uranus",
    color: "#9fe0e6",
    radius: 0.27,
    orbitRadius: 9.7,
    periodDays: 30589,
    tilt: 97.8,
    spin: -0.9,
    atmosphere: "#9fe8ee",
    description: "An ice giant that rolls around the Sun on its side.",
    stats: ["50,724 km", "2,871 M km", "17.2 hours (retrograde)", "84 years", "28 moons"],
    facts: ["Ice giant", "Rotates on its side (98°)", "28 known moons"],
  },
  {
    name: "Neptune",
    color: "#4a6fe0",
    radius: 0.26,
    orbitRadius: 11.3,
    periodDays: 59800,
    tilt: 28.3,
    spin: 1,
    atmosphere: "#4a70ff",
    description: "The windiest planet, a deep blue ice giant at the edge of the planets.",
    stats: ["49,244 km", "4,495 M km", "16.1 hours", "164.8 years", "16 moons"],
    facts: ["Fastest winds in the Solar System", "Deep blue ice giant", "16 known moons"],
  },
];
