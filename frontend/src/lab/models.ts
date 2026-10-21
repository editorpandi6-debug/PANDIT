// Hologram Lab model catalog: detailed objects built from many labelled sub-parts (procedural "custom" scenes).
import type { CustomObject, SceneSpec } from "@/lib/types";

export const CATEGORIES = ["Anatomy", "Space", "Machines", "Molecules", "Buildings", "Animals", "Math"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface LabModel {
  name: string;
  category: Category;
  keywords: string[];
  spec: SceneSpec;
}

const O = (shape: string, label: string, position: [number, number, number], size: number | [number, number, number], color: string, info: string, extra: Partial<CustomObject> = {}): CustomObject => ({
  shape,
  label,
  position,
  size,
  color,
  info,
  ...extra,
});

const FIRE = "#ff8a1f";
const HOT = "#ffd27a";
const EMBER = "#c2300a";
const STEEL = "#d9a66a";
const BLUE = "#4d9bff";
const GREEN = "#52ffa8";

function custom(title: string, objects: CustomObject[], stats: string[], steps: string[]): SceneSpec {
  return { scene: "custom", params: { objects }, title, stats, steps };
}

export const MODELS: LabModel[] = [
  // ───────── Anatomy ─────────
  {
    name: "Human Heart",
    category: "Anatomy",
    keywords: ["heart", "cardiac", "blood pump"],
    spec: custom(
      "Human Heart",
      [
        O("sphere", "Right atrium", [1, 1, 0], 1.6, BLUE, "Receives deoxygenated blood from the body through the superior and inferior vena cava.", { animation: "pulse", speed: 1.2 }),
        O("sphere", "Left atrium", [-1, 1, 0], 1.5, EMBER, "Receives oxygenated blood from the lungs via the four pulmonary veins.", { animation: "pulse", speed: 1.2 }),
        O("sphere", "Right ventricle", [0.9, -0.7, 0.1], 2.0, BLUE, "Pumps deoxygenated blood to the lungs through the pulmonary artery.", { animation: "pulse", speed: 1.2 }),
        O("sphere", "Left ventricle", [-0.9, -0.8, 0], 2.3, EMBER, "Thickest muscular wall; pumps oxygenated blood to the whole body via the aorta.", { animation: "pulse", speed: 1.2 }),
        O("torus", "Aorta", [-0.6, 2.6, 0], [1.6, 0.9, 1], EMBER, "The largest artery; arches over the heart and carries oxygen-rich blood to the body."),
        O("cylinder", "Pulmonary artery", [1.3, 2.4, 0], [0.5, 1.6, 0.5], BLUE, "Carries deoxygenated blood from the right ventricle to the lungs."),
        O("cylinder", "Superior vena cava", [2.2, 2.0, 0], [0.45, 1.6, 0.45], BLUE, "Returns deoxygenated blood from the upper body to the right atrium."),
        O("cylinder", "Inferior vena cava", [1.9, -1.9, 0.4], [0.45, 1.4, 0.45], BLUE, "Returns deoxygenated blood from the lower body to the right atrium."),
        O("ring", "Tricuspid valve", [1, 0.15, 0.2], 1.0, HOT, "One-way valve between the right atrium and right ventricle."),
        O("ring", "Mitral valve", [-1, 0.1, 0.2], 1.0, HOT, "One-way valve between the left atrium and left ventricle."),
      ],
      ["4 chambers", "~72 bpm", "5 L/min"],
      ["Blood returns to the right atrium via the vena cavae", "The right ventricle pumps it to the lungs", "Oxygenated blood enters the left atrium", "The left ventricle pumps it out through the aorta"],
    ),
  },
  {
    name: "Lungs",
    category: "Anatomy",
    keywords: ["lung", "respiratory", "breathing", "bronchi"],
    spec: custom(
      "Lungs",
      [
        O("cylinder", "Trachea", [0, 2.6, 0], [0.6, 1.8, 0.6], STEEL, "The windpipe; a ring-reinforced tube carrying air to the bronchi."),
        O("cylinder", "Left bronchus", [-0.9, 1.2, 0], [0.4, 1.4, 0.4], STEEL, "Branch of the trachea entering the left lung."),
        O("cylinder", "Right bronchus", [0.9, 1.2, 0], [0.4, 1.4, 0.4], STEEL, "Branch of the trachea entering the right lung (wider and more vertical)."),
        O("capsule", "Right lung", [1.8, -0.4, 0], [2.0, 2.2, 1.6], FIRE, "Three lobes; slightly larger than the left lung.", { animation: "pulse", speed: 0.6 }),
        O("capsule", "Left lung", [-1.8, -0.5, 0], [1.8, 2.2, 1.5], FIRE, "Two lobes; leaves room for the heart (cardiac notch).", { animation: "pulse", speed: 0.6 }),
        O("sphere", "Alveoli", [2.4, -1.6, 0.9], 0.5, HOT, "Millions of tiny air sacs where oxygen and carbon dioxide are exchanged.", { animation: "pulse", speed: 2 }),
        O("plane", "Diaphragm", [0, -3.0, 0], [6, 2.5, 1], EMBER, "Dome-shaped muscle that contracts to pull air into the lungs.", { opacity: 0.25 }),
      ],
      ["2 lungs", "~300M alveoli", "12-20 breaths/min"],
      ["Air enters through the trachea", "It splits into the bronchi", "Gas exchange happens in the alveoli", "The diaphragm drives each breath"],
    ),
  },
  {
    name: "Brain",
    category: "Anatomy",
    keywords: ["brain", "cerebrum", "cerebellum", "neuro"],
    spec: custom(
      "Brain",
      [
        O("sphere", "Frontal lobe", [0, 0.9, 1.6], 2.2, FIRE, "Planning, decision making, speech production and voluntary movement."),
        O("sphere", "Parietal lobe", [0, 1.6, -0.3], 2.0, HOT, "Touch, temperature, pain and spatial awareness."),
        O("sphere", "Occipital lobe", [0, 0.6, -2.0], 1.7, EMBER, "Visual processing centre."),
        O("sphere", "Temporal lobe", [2.0, -0.3, 0.2], 1.6, STEEL, "Hearing, memory and language comprehension."),
        O("sphere", "Cerebellum", [0, -1.4, -1.6], 1.5, BLUE, "Balance, coordination and fine motor control."),
        O("cylinder", "Brain stem", [0, -2.3, -0.4], [0.7, 1.6, 0.7], GREEN, "Controls breathing, heart rate and connects the brain to the spinal cord."),
      ],
      ["~86B neurons", "~1.4 kg", "20% of body energy"],
      ["The frontal lobe handles thinking and movement", "Parietal and temporal lobes process senses", "The occipital lobe decodes vision", "Cerebellum and brain stem keep the body running"],
    ),
  },
  { name: "DNA Double Helix", category: "Anatomy", keywords: ["dna", "helix", "gene"], spec: { scene: "dna", params: {}, title: "DNA Double Helix", stats: ["A-T · G-C", "2 strands"], steps: ["Two sugar-phosphate backbones twist around each other", "Base pairs form the rungs", "A pairs with T, G pairs with C"] } },
  { name: "Animal Cell", category: "Anatomy", keywords: ["cell", "organelle", "nucleus"], spec: { scene: "cell", params: { type: "animal" }, title: "Animal Cell", stats: ["Membrane", "Nucleus", "Mitochondria"], steps: ["The membrane controls what enters", "The nucleus stores DNA", "Mitochondria release energy"] } },

  // ───────── Space ─────────
  { name: "Solar System", category: "Space", keywords: ["solar", "planets", "sun", "orbit"], spec: { scene: "solar-system", params: {}, title: "Solar System", stats: ["8 planets", "1 star", "Educational scale"], steps: ["The Sun holds 99.8% of the mass", "Mercury, Venus, Earth and Mars are rocky", "Jupiter and Saturn are gas giants", "Uranus and Neptune are ice giants"] } },
  {
    name: "Rocket",
    category: "Space",
    keywords: ["rocket", "launch", "spacecraft", "booster"],
    spec: custom(
      "Rocket",
      [
        O("cone", "Nose cone / payload fairing", [0, 4.2, 0], [1.4, 1.8, 1.4], HOT, "Protects the payload (satellite or crew capsule) from aerodynamic heating during ascent."),
        O("cylinder", "Second stage", [0, 2.4, 0], [1.4, 1.8, 1.4], STEEL, "Smaller upper stage that fires in vacuum to reach orbital velocity."),
        O("cylinder", "Interstage", [0, 1.3, 0], [1.42, 0.4, 1.42], EMBER, "Structural ring joining the stages; houses separation hardware."),
        O("cylinder", "First stage (LOX + fuel tanks)", [0, -0.9, 0], [1.4, 4.0, 1.4], FIRE, "Main booster: liquid oxygen and kerosene/methane tanks feeding the engines."),
        O("cylinder", "Engine section", [0, -3.2, 0], [1.3, 0.6, 1.3], STEEL, "Thrust structure holding the engines and plumbing."),
        O("cone", "Engine bell", [0, -3.9, 0], [1.0, 0.8, 1.0], EMBER, "Nozzle that expands exhaust gases to produce thrust.", { animation: "pulse", speed: 3 }),
        O("box", "Grid fin", [1.0, 0.4, 0], [0.5, 0.5, 0.08], STEEL, "Steers the booster during descent for recovery."),
        O("box", "Grid fin", [-1.0, 0.4, 0], [0.5, 0.5, 0.08], STEEL, "Steers the booster during descent for recovery."),
        O("cone", "Landing leg", [1.1, -3.4, 0], [0.3, 1.2, 0.3], STEEL, "Deploys for a vertical landing.", { opacity: 0.6 }),
        O("cone", "Landing leg", [-1.1, -3.4, 0], [0.3, 1.2, 0.3], STEEL, "Deploys for a vertical landing.", { opacity: 0.6 }),
      ],
      ["2 stages", "~7.8 km/s to orbit", "Newton's 3rd law"],
      ["The first stage lifts off and burns for ~2.5 minutes", "Stages separate at the interstage", "The second stage reaches orbital speed", "The fairing opens to release the payload"],
    ),
  },
  {
    name: "Satellite",
    category: "Space",
    keywords: ["satellite", "orbiter", "probe"],
    spec: custom(
      "Satellite",
      [
        O("box", "Bus (main body)", [0, 0, 0], [1.6, 1.6, 1.6], STEEL, "Houses computers, batteries, propulsion and payload instruments."),
        O("plane", "Solar array (port)", [-3.2, 0, 0], [4, 1.4, 1], BLUE, "Converts sunlight into electricity.", { opacity: 0.5 }),
        O("plane", "Solar array (starboard)", [3.2, 0, 0], [4, 1.4, 1], BLUE, "Converts sunlight into electricity.", { opacity: 0.5 }),
        O("cone", "High-gain antenna dish", [0, 1.7, 0.4], [1.8, 0.6, 1.8], HOT, "Sends data back to Earth ground stations."),
        O("cylinder", "Thruster", [0, -1.2, 0], [0.4, 0.6, 0.4], EMBER, "Small rocket engine for orbit corrections.", { animation: "pulse", speed: 2 }),
        O("sphere", "Star tracker", [0.9, 0.9, 0.9], 0.3, GREEN, "Camera that reads star positions to determine orientation."),
      ],
      ["LEO 400-2000 km", "GEO 35,786 km", "Solar powered"],
      ["Solar arrays power the bus", "The dish links to Earth", "Thrusters keep the orbit", "Star trackers keep it pointed"],
    ),
  },
  { name: "Moon Phases", category: "Space", keywords: ["moon", "phase", "lunar"], spec: { scene: "moon-phases", params: {}, title: "Moon Phases", stats: ["8 phases", "29.5 days"], steps: ["Half the Moon is always lit by the Sun", "We see different fractions as it orbits", "New Moon sits between Earth and Sun", "Full Moon is opposite the Sun"] } },

  // ───────── Machines ─────────
  {
    name: "Car Engine",
    category: "Machines",
    keywords: ["engine", "piston", "motor", "combustion", "car"],
    spec: custom(
      "Four-stroke Engine",
      [
        O("box", "Engine block", [0, -0.6, 0], [4.4, 2.4, 2.2], STEEL, "Cast metal body that contains the cylinders and coolant passages.", { opacity: 0.18 }),
        O("cylinder", "Cylinder 1", [-1.5, 0.2, 0], [0.9, 2.2, 0.9], FIRE, "Chamber where the fuel-air mixture burns.", { opacity: 0.25 }),
        O("cylinder", "Cylinder 2", [-0.5, 0.2, 0], [0.9, 2.2, 0.9], FIRE, "Chamber where the fuel-air mixture burns.", { opacity: 0.25 }),
        O("cylinder", "Cylinder 3", [0.5, 0.2, 0], [0.9, 2.2, 0.9], FIRE, "Chamber where the fuel-air mixture burns.", { opacity: 0.25 }),
        O("cylinder", "Cylinder 4", [1.5, 0.2, 0], [0.9, 2.2, 0.9], FIRE, "Chamber where the fuel-air mixture burns.", { opacity: 0.25 }),
        O("cylinder", "Piston", [-1.5, 0.3, 0], [0.7, 0.5, 0.7], HOT, "Moves up and down; expanding gas pushes it to produce power.", { animation: "bounce", speed: 2.4 }),
        O("cylinder", "Piston", [-0.5, 0.0, 0], [0.7, 0.5, 0.7], HOT, "Moves up and down; expanding gas pushes it to produce power.", { animation: "bounce", speed: 2.4 }),
        O("cylinder", "Piston", [0.5, 0.3, 0], [0.7, 0.5, 0.7], HOT, "Moves up and down; expanding gas pushes it to produce power.", { animation: "bounce", speed: 2.4 }),
        O("cylinder", "Piston", [1.5, 0.0, 0], [0.7, 0.5, 0.7], HOT, "Moves up and down; expanding gas pushes it to produce power.", { animation: "bounce", speed: 2.4 }),
        O("cylinder", "Crankshaft", [0, -1.6, 0], [0.35, 4.6, 0.35], EMBER, "Converts the pistons' up-down motion into rotation.", { animation: "rotate", speed: 3 }),
        O("box", "Cylinder head & valves", [0, 1.5, 0], [4.4, 0.5, 2.2], STEEL, "Seals the cylinders; intake and exhaust valves open and close here."),
        O("cylinder", "Spark plug", [-1.5, 2.0, 0], [0.15, 0.5, 0.15], HOT, "Ignites the compressed fuel-air mixture.", { animation: "pulse", speed: 4 }),
        O("cylinder", "Camshaft", [0, 2.1, 0.6], [0.25, 4.6, 0.25], STEEL, "Rotating shaft with lobes that open the valves at the right time.", { animation: "rotate", speed: 1.5 }),
        O("box", "Flywheel", [2.7, -1.6, 0], [0.3, 1.6, 1.6], STEEL, "Heavy disc that smooths the engine's rotation.", { animation: "rotate", speed: 3 }),
      ],
      ["4 cylinders", "Intake · Compression · Power · Exhaust", "~2000 rpm"],
      ["Intake: the piston drops and draws in fuel-air", "Compression: the piston rises and squeezes it", "Power: the spark plug fires and the piston is pushed down", "Exhaust: burnt gas leaves; the crankshaft turns the flywheel"],
    ),
  },
  {
    name: "Jet Engine",
    category: "Machines",
    keywords: ["jet", "turbine", "turbofan", "aircraft engine"],
    spec: custom(
      "Turbofan Jet Engine",
      [
        O("cylinder", "Nacelle (casing)", [0, 0, 0], [3.4, 6, 3.4], STEEL, "Outer housing that guides airflow and reduces noise.", { opacity: 0.1 }),
        O("cylinder", "Fan", [0, 2.6, 0], [3.0, 0.3, 3.0], HOT, "Large front fan that accelerates most of the air around the core (bypass).", { animation: "rotate", speed: 6 }),
        O("cylinder", "Low-pressure compressor", [0, 1.6, 0], [1.8, 0.8, 1.8], FIRE, "First compressor stages raising air pressure.", { animation: "rotate", speed: 5 }),
        O("cone", "High-pressure compressor", [0, 0.5, 0], [1.5, 1.2, 1.5], FIRE, "Final compression; the air gets very hot and dense.", { animation: "rotate", speed: 7 }),
        O("torus", "Combustion chamber", [0, -0.6, 0], [1.6, 1.0, 1], EMBER, "Fuel is sprayed in and burned continuously.", { animation: "pulse", speed: 3 }),
        O("cylinder", "Turbine", [0, -1.6, 0], [1.6, 0.6, 1.6], HOT, "Hot gas spins the turbine, which drives the compressor and fan.", { animation: "rotate", speed: 7 }),
        O("cone", "Exhaust nozzle", [0, -2.8, 0], [1.4, 1.2, 1.4], EMBER, "Accelerates exhaust gases to produce thrust."),
        O("cylinder", "Shaft", [0, 0, 0], [0.3, 5.6, 0.3], STEEL, "Connects turbine to compressor and fan.", { animation: "rotate", speed: 6 }),
      ],
      ["Suck · Squeeze · Bang · Blow", "Bypass ratio ~10:1", "~400 kN thrust"],
      ["The fan pulls in air", "Compressors squeeze it", "Fuel burns in the combustion chamber", "The turbine extracts energy and exhaust provides thrust"],
    ),
  },
  {
    name: "Robot Arm",
    category: "Machines",
    keywords: ["robot", "arm", "manipulator", "actuator"],
    spec: custom(
      "6-axis Robot Arm",
      [
        O("cylinder", "Base", [0, -2.8, 0], [2.4, 0.5, 2.4], STEEL, "Fixed mount; contains the first rotary joint (axis 1)."),
        O("cylinder", "Shoulder joint", [0, -2.0, 0], [1.2, 1.0, 1.2], FIRE, "Axis 2: swings the lower arm forward and back.", { animation: "rotate", speed: 0.8 }),
        O("box", "Lower arm", [0, -0.6, 0], [0.7, 2.4, 0.7], STEEL, "Rigid link between shoulder and elbow."),
        O("sphere", "Elbow joint", [0, 0.8, 0], 1.0, FIRE, "Axis 3: bends the upper arm.", { animation: "pulse", speed: 1.5 }),
        O("box", "Upper arm", [0.9, 1.6, 0], [2.4, 0.6, 0.6], STEEL, "Carries the wrist and tool."),
        O("sphere", "Wrist (3 axes)", [2.3, 1.6, 0], 0.8, HOT, "Axes 4-6: roll, pitch and yaw of the tool.", { animation: "rotate", speed: 2 }),
        O("cone", "Gripper", [3.1, 1.6, 0], [0.6, 0.8, 0.6], EMBER, "End effector that picks up parts.", { animation: "pulse", speed: 2.5 }),
        O("box", "Controller cabinet", [-3.0, -2.3, 0], [1.4, 1.6, 1.0], STEEL, "Computer that runs the motion program and servo drives.", { opacity: 0.3 }),
      ],
      ["6 axes", "Servo motors", "Repeatability ±0.02 mm"],
      ["The base rotates the whole arm", "Shoulder and elbow position the wrist", "The wrist orients the tool", "The controller coordinates all six motors"],
    ),
  },

  // ───────── Molecules ─────────
  { name: "Water (H₂O)", category: "Molecules", keywords: ["water", "h2o"], spec: { scene: "molecule", params: { formula: "H2O" }, title: "Water Molecule", stats: ["Bent · 104.5°", "Polar"], steps: ["One oxygen bonded to two hydrogens", "Lone pairs bend the molecule to 104.5°", "The uneven charge makes water polar"] } },
  { name: "Methane (CH₄)", category: "Molecules", keywords: ["methane", "ch4"], spec: { scene: "molecule", params: { formula: "CH4" }, title: "Methane", stats: ["Tetrahedral · 109.5°"], steps: ["Carbon at the centre", "Four hydrogens at tetrahedral corners"] } },
  { name: "Carbon dioxide (CO₂)", category: "Molecules", keywords: ["carbon dioxide", "co2"], spec: { scene: "molecule", params: { formula: "CO2" }, title: "Carbon Dioxide", stats: ["Linear · 180°", "Double bonds"], steps: ["Carbon in the middle", "Two oxygens double-bonded on each side"] } },
  { name: "Benzene (C₆H₆)", category: "Molecules", keywords: ["benzene", "c6h6", "aromatic"], spec: { scene: "molecule", params: { formula: "C6H6" }, title: "Benzene", stats: ["Planar hexagon", "Aromatic"], steps: ["Six carbons form a flat ring", "Alternating double bonds are delocalised", "One hydrogen on each carbon"] } },
  { name: "Carbon Atom", category: "Molecules", keywords: ["atom", "carbon", "electron"], spec: { scene: "atom", params: { atomicNumber: 6, symbol: "C", name: "Carbon" }, title: "Carbon Atom", stats: ["Z = 6", "2 shells"], steps: ["6 protons and 6 neutrons in the nucleus", "2 electrons in the first shell", "4 electrons in the outer shell"] } },

  // ───────── Buildings ─────────
  {
    name: "Pyramid of Giza",
    category: "Buildings",
    keywords: ["pyramid", "giza", "egypt"],
    spec: custom(
      "Great Pyramid",
      [
        O("plane", "Bedrock plateau", [0, -2.6, 0], [10, 10, 1], STEEL, "Limestone plateau levelled before construction.", { opacity: 0.15 }),
        O("cone", "Core masonry (2.3M blocks)", [0, -0.4, 0], [6, 4.4, 6], FIRE, "Roughly cut limestone blocks forming the bulk of the pyramid. Rendered as a 4-sided cone.", { opacity: 0.3 }),
        O("cone", "Casing stones", [0, -0.4, 0], [6.3, 4.6, 6.3], HOT, "Polished white Tura limestone that once made the faces smooth.", { wire: true, opacity: 0.5 }),
        O("cone", "Capstone (pyramidion)", [0, 2.1, 0], [0.6, 0.5, 0.6], HOT, "The topmost stone, possibly gilded."),
        O("box", "King's Chamber", [0, -0.6, 0.2], [0.9, 0.5, 0.5], EMBER, "Granite chamber near the centre containing the sarcophagus."),
        O("box", "Grand Gallery", [0, -1.4, 0.8], [0.3, 1.4, 0.3], EMBER, "Tall corbelled passage leading up to the King's Chamber."),
        O("box", "Entrance", [0, -1.6, 3.0], [0.5, 0.4, 0.4], EMBER, "Original entrance on the north face."),
      ],
      ["146.6 m original height", "~2.3 million blocks", "c. 2560 BC"],
      ["A level plateau was prepared", "Core blocks were stacked in layers", "Smooth casing stones covered the faces", "Internal passages lead to the King's Chamber"],
    ),
  },
  {
    name: "Suspension Bridge",
    category: "Buildings",
    keywords: ["bridge", "suspension", "cable"],
    spec: custom(
      "Suspension Bridge",
      [
        O("box", "Deck", [0, 0, 0], [10, 0.25, 1.6], STEEL, "Roadway carried by vertical hanger cables."),
        O("box", "Tower (west)", [-3, 1.6, 0], [0.5, 4.2, 1.8], FIRE, "Tall pylon that carries the main cables high above the deck."),
        O("box", "Tower (east)", [3, 1.6, 0], [0.5, 4.2, 1.8], FIRE, "Tall pylon that carries the main cables high above the deck."),
        O("torus", "Main cable", [0, 1.9, 0.8], [6.2, 0.4, 1], HOT, "Steel cable in tension spanning between the towers (rendered as an arc).", { opacity: 0.8 }),
        O("torus", "Main cable", [0, 1.9, -0.8], [6.2, 0.4, 1], HOT, "Steel cable in tension spanning between the towers (rendered as an arc).", { opacity: 0.8 }),
        O("box", "Anchorage (west)", [-5.2, -0.6, 0], [0.9, 1.4, 1.8], EMBER, "Massive concrete block that anchors the main cables into the ground."),
        O("box", "Anchorage (east)", [5.2, -0.6, 0], [0.9, 1.4, 1.8], EMBER, "Massive concrete block that anchors the main cables into the ground."),
        O("cylinder", "Pier foundation", [-3, -1.4, 0], [0.9, 1.4, 0.9], STEEL, "Transfers the tower load into bedrock."),
        O("cylinder", "Pier foundation", [3, -1.4, 0], [0.9, 1.4, 0.9], STEEL, "Transfers the tower load into bedrock."),
      ],
      ["Cables in tension", "Towers in compression", "Spans > 1 km"],
      ["The deck hangs from vertical hangers", "Hangers load the main cables", "Cables pull on towers and anchorages", "Towers push the load into foundations"],
    ),
  },
  {
    name: "Skyscraper",
    category: "Buildings",
    keywords: ["skyscraper", "tower", "building", "office"],
    spec: custom(
      "Skyscraper",
      [
        O("box", "Foundation piles", [0, -3.4, 0], [3.4, 0.8, 3.4], EMBER, "Deep piles that carry the building's weight to bedrock.", { opacity: 0.5 }),
        O("box", "Core (lifts & stairs)", [0, 0.2, 0], [0.9, 6.4, 0.9], FIRE, "Concrete core that resists wind and houses elevators."),
        O("box", "Steel frame", [0, 0.2, 0], [2.8, 6.4, 2.8], STEEL, "Columns and beams forming the skeleton.", { wire: true, opacity: 0.6 }),
        O("box", "Glass curtain wall", [0, 0.2, 0], [3.0, 6.4, 3.0], BLUE, "Lightweight glazed skin hung from the floors.", { opacity: 0.12 }),
        O("box", "Mechanical floor", [0, 1.9, 0], [3.1, 0.3, 3.1], HOT, "Houses HVAC, pumps and electrical plant."),
        O("box", "Tuned mass damper", [0, 3.1, 0], [0.8, 0.6, 0.8], HOT, "Heavy pendulum that counteracts sway in wind or earthquakes.", { animation: "float", speed: 1.2 }),
        O("cylinder", "Spire / antenna", [0, 4.3, 0], [0.15, 1.8, 0.15], STEEL, "Communications mast on the roof."),
      ],
      ["Core + frame", "Curtain wall", "Mass damper"],
      ["Piles anchor the tower", "The core and steel frame carry loads", "A light glass skin wraps the frame", "A damper steadies the top floors"],
    ),
  },

  // ───────── Animals ─────────
  {
    name: "Fish",
    category: "Animals",
    keywords: ["fish", "aquatic", "gills"],
    spec: custom(
      "Fish Anatomy",
      [
        O("capsule", "Body (muscle blocks)", [0, 0, 0], [3.8, 1.3, 1.1], FIRE, "Segmented muscle (myomeres) that flexes the body side to side for swimming."),
        O("sphere", "Head", [2.1, 0.1, 0], 1.2, HOT, "Contains brain, eyes and mouth."),
        O("sphere", "Eye", [2.5, 0.4, 0.45], 0.3, STEEL, "Lateral eyes give a wide field of view."),
        O("plane", "Gill cover (operculum)", [1.6, 0, 0.6], [0.8, 1.0, 1], EMBER, "Protects the gills, which extract oxygen from water.", { opacity: 0.6 }),
        O("cone", "Tail fin (caudal)", [-2.6, 0, 0], [1.6, 1.4, 0.2], HOT, "Main propulsion fin.", { animation: "float", speed: 3 }),
        O("cone", "Dorsal fin", [0, 1.0, 0], [1.4, 0.8, 0.15], HOT, "Keeps the fish stable and prevents rolling."),
        O("cone", "Pectoral fin", [1.2, -0.3, 0.7], [0.6, 0.8, 0.1], HOT, "Paired fins for steering and braking.", { animation: "float", speed: 2 }),
        O("capsule", "Swim bladder", [0, 0.3, 0], [1.6, 0.4, 0.4], BLUE, "Gas-filled organ that controls buoyancy.", { opacity: 0.6 }),
        O("cylinder", "Spine", [0, 0.1, 0], [0.12, 4.0, 0.12], STEEL, "Vertebral column running the length of the body.", { wire: true }),
      ],
      ["Cold-blooded", "Gills", "Swim bladder"],
      ["Muscle blocks flex the body", "The tail fin pushes water back", "Gills take oxygen from water", "The swim bladder sets depth"],
    ),
  },
  {
    name: "Bird",
    category: "Animals",
    keywords: ["bird", "wing", "feather", "flight"],
    spec: custom(
      "Bird Anatomy",
      [
        O("capsule", "Body", [0, 0, 0], [1.4, 2.2, 1.2], FIRE, "Streamlined body with a large keel bone anchoring flight muscles."),
        O("sphere", "Head", [0, 1.7, 0.5], 0.8, HOT, "Light skull with large eyes."),
        O("cone", "Beak", [0, 1.7, 1.2], [0.3, 0.7, 0.3], STEEL, "Lightweight keratin beak replaces heavy teeth."),
        O("plane", "Wing (left)", [-2.0, 0.4, 0], [3.2, 1.2, 1], HOT, "Generates lift; primary feathers at the tip provide thrust.", { animation: "float", speed: 2.5, opacity: 0.6 }),
        O("plane", "Wing (right)", [2.0, 0.4, 0], [3.2, 1.2, 1], HOT, "Generates lift; primary feathers at the tip provide thrust.", { animation: "float", speed: 2.5, opacity: 0.6 }),
        O("cone", "Tail feathers", [0, -1.6, -0.3], [1.2, 1.0, 0.15], EMBER, "Steering and braking."),
        O("box", "Keel (sternum)", [0, -0.2, 0.6], [0.3, 1.4, 0.2], STEEL, "Enlarged breastbone where the powerful flight muscles attach."),
        O("sphere", "Air sacs", [0, -0.5, -0.3], 0.7, BLUE, "Part of a one-way breathing system that supplies oxygen very efficiently.", { opacity: 0.4 }),
        O("cylinder", "Leg", [0.3, -1.6, 0.2], [0.12, 0.9, 0.12], STEEL, "Hollow, lightweight bones."),
      ],
      ["Hollow bones", "Keel bone", "One-way lungs"],
      ["Wings create lift as air flows over them", "Flight muscles on the keel power the downstroke", "Tail feathers steer", "Air sacs keep oxygen flowing"],
    ),
  },

  // ───────── Math ─────────
  { name: "Cube", category: "Math", keywords: ["cube", "volume", "box"], spec: { scene: "geometry", params: { shape: "cube", a: 3 }, title: "Cube", stats: ["6 faces", "12 edges", "8 vertices", "V = a³"], steps: ["All 12 edges are equal", "Volume = a × a × a", "Surface area = 6a²"] } },
  { name: "Sphere", category: "Math", keywords: ["sphere", "ball"], spec: { scene: "geometry", params: { shape: "sphere", r: 2 }, title: "Sphere", stats: ["V = 4/3πr³", "A = 4πr²"], steps: ["Every surface point is r from the centre", "Volume = 4/3 · π · r³", "Surface area = 4 · π · r²"] } },
  { name: "Cone", category: "Math", keywords: ["cone"], spec: { scene: "geometry", params: { shape: "cone", r: 1.5, h: 3 }, title: "Cone", stats: ["V = ⅓πr²h"], steps: ["A circular base and an apex", "Volume is one third of a cylinder", "Slant height s = √(r² + h²)"] } },
  { name: "Parabola y = x²", category: "Math", keywords: ["parabola", "graph", "quadratic", "x^2"], spec: { scene: "graph", params: { mode: "2d", expressions: ["x^2", "x^2 - 4"], xRange: [-5, 5] }, title: "Parabolas", stats: ["Vertex (0,0)", "Axis of symmetry x=0"], steps: ["y = x² opens upward", "Subtracting 4 shifts it down", "Roots are where y = 0"] } },
  { name: "3D Surface", category: "Math", keywords: ["surface", "3d graph", "z=", "sin"], spec: { scene: "graph", params: { mode: "3d", expressions: ["sin(x)*cos(y)"], xRange: [-5, 5] }, title: "Surface z = sin(x)·cos(y)", stats: ["z = f(x, y)"], steps: ["Height z depends on both x and y", "Ridges and valleys follow the sine and cosine waves"] } },
];

/** Closest model for a typed name: exact → prefix → substring → keyword → token overlap. */
export function findClosestModel(query: string): LabModel | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const tokens = q.split(/\s+/).filter(Boolean);
  let best: { m: LabModel; score: number } | null = null;
  for (const m of MODELS) {
    const name = m.name.toLowerCase();
    let score = 0;
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 65;
    else if (m.keywords.some((k) => k === q)) score = 60;
    else if (m.keywords.some((k) => q.includes(k) || k.includes(q))) score = 45;
    const hay = `${name} ${m.keywords.join(" ")} ${m.category.toLowerCase()}`;
    score += tokens.filter((t) => t.length > 2 && hay.includes(t)).length * 8;
    if (score > 0 && (!best || score > best.score)) best = { m, score };
  }
  return best?.m ?? null;
}
