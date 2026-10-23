// Shared materials and palette. Everything static is vertex-coloured, so a handful of materials
// covers the whole yard.
import * as THREE from "three";

export const C = {
  cream: "#f4e4c4",
  creamShade: "#e6d0a8",
  ochre: "#e7b35e",
  pink: "#f2b9a6",
  salmon: "#e99c7c",
  mint: "#b9e0cf",
  plasterBlue: "#b8d3e0",
  terracotta: "#c8643e",
  terracottaDark: "#a44c2f",
  tin: "#9eaaa8",
  rust: "#a8613d",
  rustDark: "#7b4128",
  wood: "#8b5a3a",
  woodDark: "#5c3a26",
  woodLight: "#b88352",
  woodPaint: "#4f8f8a",
  teal: "#3f9c94",
  sky: "#7fb7d9",
  saffron: "#f2b134",
  wine: "#8e2a3b",
  vine: "#6aa23f",
  leafDark: "#40792f",
  leafLight: "#8cc152",
  gas: "#f3c531",
  earth: "#c29b70",
  earthDark: "#a8835c",
  cobble: "#c9b89c",
  stone: "#a59c8f",
  stoneDark: "#857c71",
  brick: "#b8644a",
  white: "#f7f3ea",
  offWhite: "#e9e3d6",
  black: "#2c2a2a",
  steel: "#c9ced2",
  chrome: "#e8edf0",
  rubber: "#2a2727",
  skin: "#efbf9b",
  skinDark: "#d9a07b",
  grey: "#8a8a88",
  glassDark: "#33515f",
  dough: "#f1d9a4",
  crust: "#c98a3c",
  crustDark: "#9a5a25",
} as const;

let cache: ReturnType<typeof create> | null = null;

function create() {
  const matte = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.86, metalness: 0 });
  const metal = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.32, metalness: 0.7 });
  // Window glass: reflects the sky env map.
  const glass = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.12, metalness: 0.25 });
  // Stained shushabandi panes: their own colour glows a little, as if lit from behind by the sun.
  const glow = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, metalness: 0, envMapIntensity: 0.3 });
  glow.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance += vColor.rgb * vColor.rgb * 0.9;\n#endif",
    );
  };
  glow.customProgramCacheKey = () => "ezo-glow";
  // Smooth-shaded variant for food and people (round things read better smooth up close).
  const soft = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 });
  const glossy = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0 });
  const clearGlass = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return { matte, metal, glass, glow, soft, glossy, clearGlass };
}

export function materials() {
  if (!cache) cache = create();
  return cache;
}
