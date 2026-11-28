/* =========================================================================
   Axia · La gema del hero (28/11/2026, sustituye al MacBook por fotogramas)
   La gema del logo en 3D con three.js. Se dibuja en directo a la resolución real de la pantalla
   (en una pantalla 4K sale a 4K), así que nunca se ve pixelada.
   Con el scroll se agrieta, estalla en esquirlas y, al llegar al formulario, se vuelve a montar.
   main.js mueve window.AXIA_GEMA.s de 0 a 1 durante el hero; aquí se reparte en fases (fases()).
   ========================================================================= */
import * as THREE from './vendor/three.module.min.js';

const estado = window.AXIA_GEMA || (window.AXIA_GEMA = { s: 0 });
const raiz = document.documentElement;
const lienzo = document.getElementById('lienzo');
const heroEl = document.getElementById('inicio');
const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
const enMovil = matchMedia('(max-width: 899px)').matches;
const prueba = new URLSearchParams(location.search);   // ?s=0.3 deja la gema quieta en ese punto (para revisar)

/* ---------- Utilidades ---------- */
function semilla(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const azar = semilla(28112026);          // las esquirlas salen siempre iguales
const entre = (a, b) => a + (b - a) * azar();
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lineal = (a, b, x) => Math.min(1, Math.max(0, (x - a) / (b - a)));

/* ---------- 1. La forma: la gema del logo, con las mismas medidas que el SVG ---------- */
// viewBox del logo «30 10 140 182» pasado a 3D: 2 de alto y el centro en 0. z = grosor (delante +, detrás −).
const P = (x, y, z = 0) => new THREE.Vector3((x - 100) / 81, (101 - y) / 81, z);

function caras() {
  const T = P(100, 20), Lg = P(40, 72), Rg = P(160, 72), B = P(100, 182);
  const lista = [];
  const pl = {}, pr = {};
  for (const z of [1, -1]) {
    const GL = P(85.6, 72, 0.30 * z), GR = P(114.4, 72, 0.30 * z);   // donde las patas de la A cortan la línea
    const PL = P(70.2, 127.4, 0.15 * z), PR = P(129.8, 127.4, 0.15 * z);   // donde las patas tocan el contorno
    const M = P(100, 115, 0.27 * z);
    pl[z] = PL; pr[z] = PR;
    // [a, b, c, línea en ab, bc, ca] → 2 = contorno, 1 = línea interior del logo, 0 = sin línea
    lista.push(
      [T, Lg, GL, 2, 1, 1], [T, GL, GR, 1, 1, 1], [T, GR, Rg, 1, 1, 2],
      [Lg, PL, GL, 2, 1, 1], [GR, PR, Rg, 1, 2, 1],
      [GL, PL, M, 1, 0, 0], [PL, B, M, 2, 0, 0], [B, PR, M, 2, 0, 0], [PR, GR, M, 1, 0, 0], [GR, GL, M, 1, 0, 0],
    );
  }
  // aristas de los lados, donde se juntan la mitad de delante y la de detrás
  lista.push([Lg, pl[-1], pl[1], 0, 0, 0], [pl[1], pl[-1], B, 0, 0, 0], [Rg, pr[1], pr[-1], 0, 0, 0], [pr[1], B, pr[-1], 0, 0, 0]);
  // todas hacia fuera
  return lista.map(([a, b, c, fab, fbc, fca]) => {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const g = new THREE.Vector3().add(a).add(b).add(c);
    return n.dot(g) >= 0 ? [a, b, c, fab, fbc, fca] : [a, c, b, fca, fbc, fab];
  });
}

const areaDe = (a, b, c) => new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() / 2;

// Parte un triángulo por su lado más largo hasta que las piezas son pequeñas. Cada vértice lleva
// su posición dentro del triángulo grande (b) para dibujar las líneas del logo encima de las esquirlas.
function partir(tri, amin, prof, salida) {
  const [v0, v1, v2] = tri;
  if (prof > 10 || areaDe(v0.p, v1.p, v2.p) < amin) { salida.push(tri); return; }
  let mejor = null, largo = -1;
  for (const l of [[v0, v1, v2], [v1, v2, v0], [v2, v0, v1]]) {
    const d = l[0].p.distanceTo(l[1].p);
    if (d > largo) { largo = d; mejor = l; }
  }
  const [a, b, o] = mejor;
  const t = entre(0.34, 0.66);
  const m = { p: a.p.clone().lerp(b.p, t), b: a.b.map((x, i) => x + (b.b[i] - x) * t) };
  partir([a, m, o], amin, prof + 1, salida);
  partir([m, b, o], amin, prof + 1, salida);
}

/* ---------- 2. Las esquirlas: cada trocito de la superficie con su cuña hacia el centro ---------- */
function construirEsquirlas() {
  const lista = caras();
  const total = lista.reduce((s, [a, b, c]) => s + areaDe(a, b, c), 0);
  const amin = (total / (enMovil ? 150 : 270)) * 1.35;
  const origen = new THREE.Vector3(0.14, 0.22, 0.32);   // la grieta empieza aquí (delante, arriba a la derecha)
  const A = { position: [], aCentro: [], aDir: [], aEje: [], aAzar: [], aBary: [], aDist: [], aMasc: [], aTipo: [] };
  const SIN_LINEA = [9, 9, 9], CERO = [0, 0, 0], UNO = [1, 1, 1];
  const superficie = [];   // centros de las piezas de fuera, para las chispas

  function esquirla(tris, capa) {
    const c = new THREE.Vector3();
    let n = 0;
    for (const t of tris) for (const v of t) { c.add(v.p); n++; }
    c.divideScalar(n);
    const d = c.clone().normalize();
    d.x += entre(-0.35, 0.35); d.y += entre(-0.3, 0.35); d.z += entre(-0.2, 0.65);
    d.normalize();
    const eje = new THREE.Vector3(entre(-1, 1), entre(-1, 1), entre(-1, 1)).normalize();
    const retraso = Math.min(0.36, c.distanceTo(origen) * 0.15 + entre(0, 0.06) + (capa ? 0.07 : 0));
    const vel = capa ? entre(0.42, 0.85) : entre(0.8, 1.35);
    const giro = entre(1.6, 5.8) * (azar() < 0.5 ? -1 : 1);
    for (const t of tris) for (const v of t) {
      A.position.push(v.p.x, v.p.y, v.p.z);
      A.aCentro.push(c.x, c.y, c.z);
      A.aDir.push(d.x, d.y, d.z);
      A.aEje.push(eje.x, eje.y, eje.z);
      A.aAzar.push(retraso, vel, giro, capa);
      A.aBary.push(...v.b3);
      A.aDist.push(...v.d);
      A.aMasc.push(...v.m);
      A.aTipo.push(v.t);
    }
    if (!capa) superficie.push(c);
  }
  const corte = (p) => ({ p, b3: UNO, d: SIN_LINEA, m: CERO, t: 1 });

  for (const [a, b, c, fab, fbc, fca] of lista) {
    // altura de cada vértice a su lado opuesto (para pasar de «posición en el triángulo» a distancia real)
    const ar = areaDe(a, b, c);
    const h = [2 * ar / b.distanceTo(c), 2 * ar / c.distanceTo(a), 2 * ar / a.distanceTo(b)];
    const masc = [fbc, fca, fab];   // la línea del lado opuesto a cada vértice
    const trozos = [];
    partir([{ p: a, b: [1, 0, 0] }, { p: b, b: [0, 1, 0] }, { p: c, b: [0, 0, 1] }], amin * entre(0.75, 1.3), 0, trozos);
    for (const [u, v, w] of trozos) {
      const k = entre(0.46, 0.6);   // profundidad de la capa de fuera
      const ui = u.p.clone().multiplyScalar(k), vi = v.p.clone().multiplyScalar(k), wi = w.p.clone().multiplyScalar(k);
      const fuera = (x, b3) => ({ p: x.p, b3, d: x.b.map((q, i) => q * h[i]), m: masc, t: 0 });
      const U = corte(ui), Vv = corte(vi), W = corte(wi);
      // capa de fuera: la cara brillante + su grosor
      esquirla([
        [fuera(u, [1, 0, 0]), fuera(v, [0, 1, 0]), fuera(w, [0, 0, 1])],
        [W, Vv, U],
        [corte(u.p), U, Vv], [corte(u.p), Vv, corte(v.p)],
        [corte(v.p), Vv, W], [corte(v.p), W, corte(w.p)],
        [corte(w.p), W, U], [corte(w.p), U, corte(u.p)],
      ], 0);
      // capa de dentro: la punta hasta el centro
      const O = corte(new THREE.Vector3(0, 0, 0));
      esquirla([[U, Vv, W], [U, Vv, O], [Vv, W, O], [W, U, O]], 1);
    }
  }

  // La gema entera, sin cortes: es la que se ve quieta (las esquirlas dejarían costuras finas entre trozos)
  const E = { position: [], aCentro: [], aDir: [], aEje: [], aAzar: [], aBary: [], aDist: [], aMasc: [], aTipo: [] };
  for (const [a, b, c, fab, fbc, fca] of lista) {
    const ar = areaDe(a, b, c);
    const h = [2 * ar / b.distanceTo(c), 2 * ar / c.distanceTo(a), 2 * ar / a.distanceTo(b)];
    [a, b, c].forEach((p, i) => {
      E.position.push(p.x, p.y, p.z);
      E.aCentro.push(0, 0, 0); E.aDir.push(0, 0, 0); E.aEje.push(0, 0, 1); E.aAzar.push(0, 0, 0, 0);
      E.aBary.push(1, 1, 1);
      E.aDist.push(i === 0 ? h[0] : 0, i === 1 ? h[1] : 0, i === 2 ? h[2] : 0);
      E.aMasc.push(fbc, fca, fab);
      E.aTipo.push(0);
    });
  }

  const geometria = (D) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(D.position, 3));
    for (const [nombre, tam] of [['aCentro', 3], ['aDir', 3], ['aEje', 3], ['aAzar', 4], ['aBary', 3], ['aDist', 3], ['aMasc', 3], ['aTipo', 1]]) {
      geo.setAttribute(nombre, new THREE.Float32BufferAttribute(D[nombre], tam));
    }
    geo.computeBoundingSphere();
    geo.boundingSphere.radius = 40;   // vuelan lejos: que no se recorten
    return geo;
  };
  return { geo: geometria(A), geoEntera: geometria(E), superficie };
}

/* ---------- 3. El material: cristal tallado (reflejo, refracción con dispersión y un rebote dentro) ---------- */
const vertexGema = /* glsl */`
uniform float uP;
uniform float uGrieta;
uniform float uTiempo;
uniform float uLejos;
attribute vec3 aCentro;
attribute vec3 aDir;
attribute vec3 aEje;
attribute vec4 aAzar;
attribute vec3 aBary;
attribute vec3 aDist;
attribute vec3 aMasc;
attribute float aTipo;
varying vec3 vLoc;
varying vec3 vBary;
varying vec3 vDist;
varying vec3 vMasc;
varying float vTipo;
varying float vE;

mat3 girar(vec3 e, float a) {
  float s = sin(a), c = cos(a), t = 1.0 - c;
  return mat3(t * e.x * e.x + c,       t * e.x * e.y + s * e.z, t * e.x * e.z - s * e.y,
              t * e.x * e.y - s * e.z, t * e.y * e.y + c,       t * e.y * e.z + s * e.x,
              t * e.x * e.z + s * e.y, t * e.y * e.z - s * e.x, t * e.z * e.z + c);
}

void main() {
  float e = clamp((uP - aAzar.x) / 0.62, 0.0, 1.0);        // avance de esta esquirla
  float ee = 1.0 - pow(1.0 - e, 3.0);                        // sale disparada y frena
  float temblor = uGrieta * (1.0 - ee) * 0.03 * sin(uTiempo * 31.0 + aAzar.y * 57.0);
  vec3 p = (position - aCentro) * (1.0 - 0.3 * ee);
  p = girar(aEje, aAzar.z * ee + temblor) * p;
  vec3 pos = aCentro + p + aDir * (ee * aAzar.y * uLejos + uGrieta * 0.028);
  vLoc = pos;
  vBary = aBary; vDist = aDist; vMasc = aMasc; vTipo = aTipo; vE = e;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}`;

const fragmentGema = /* glsl */`
uniform samplerCube uEnv;
uniform mat3 uRot;
uniform vec3 uCamLocal;
uniform float uLuzGrieta;
uniform float uNucleo;
uniform float uExpo;
uniform float uGrosor;
uniform float uClaro;
varying vec3 vLoc;
varying vec3 vBary;
varying vec3 vDist;
varying vec3 vMasc;
varying float vTipo;
varying float vE;

float min3(vec3 v) { return min(min(v.x, v.y), v.z); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
// El estudio de luz se mira en coordenadas del mundo; la gema trabaja en las suyas.
// Nivel de desenfoque fijo (lod): con el automático salían rayitas punteadas en los bordes de las facetas.
vec3 env(vec3 d, float lod) { return textureCubeLodEXT(uEnv, normalize(uRot * d), lod).rgb; }

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
// Las facetas de detrás que se ven a través de cada cara: un abanico de rombos alrededor del centro,
// como la culata de un diamante. Al girar la gema el dibujo se desplaza y las caras destellan.
vec2 faceta(vec2 q) {
  q.x *= 1.35;
  float a = atan(q.y, q.x) / 6.2831853 + 0.5;
  float sec = floor(a * 16.0);
  float anillo = floor(length(q) * 3.3 + fract(sec * 0.5));   // anillos al tresbolillo
  return hash2(vec2(sec, anillo) + 1.7);
}
// La luz entra por la cara de delante, rebota en una faceta de detrás (Nb) y vuelve a salir hacia ti
vec3 rebote(vec3 V, vec3 N, vec3 Nb, float ior) {
  vec3 t1 = refract(-V, N, 1.0 / ior);
  vec3 t2 = reflect(t1, Nb);
  vec3 t3 = refract(t2, -N, ior);
  if (dot(t3, t3) < 0.01) t3 = reflect(t2, N);
  return t3;
}

void main() {
  vec3 N = normalize(cross(dFdx(vLoc), dFdy(vLoc)));
  vec3 V = normalize(uCamLocal - vLoc);
  if (dot(N, V) < 0.0) N = -N;
  float ndv = clamp(dot(N, V), 0.0, 1.0);

  vec3 refl = env(reflect(-V, N), 0.0);
  vec3 t1 = refract(-V, N, 1.0 / 2.42);
  vec2 c = faceta(vLoc.xy - vec2(0.0, 0.08) + t1.xy * 0.5);
  vec3 Nb = normalize(vec3((c - 0.5) * 2.1, 1.0));
  // tres colores con un índice casi igual: el «fuego» del diamante, apenas un toque (la marca es blanco y negro)
  vec3 cuerpo = vec3(env(rebote(V, N, Nb, 2.41), 1.0).r, env(rebote(V, N, Nb, 2.42), 1.0).g, env(rebote(V, N, Nb, 2.43), 1.0).b);
  cuerpo = mix(vec3(dot(cuerpo, vec3(0.333))), cuerpo, 0.2);
  cuerpo += env(t1, 2.5) * 0.18;   // lo que se ve a través
  float fres = 0.17 + 0.83 * pow(1.0 - ndv, 5.0);
  vec3 col = mix(cuerpo, refl, fres);

  if (vTipo > 0.5) {
    // caras del corte: cristal esmerilado y la luz del núcleo al romperse
    col = env(N, 3.5) * 0.35 + refl * 0.25 + vec3(1.0, 0.99, 0.97) * uNucleo * 2.2 * (1.0 - vE);
  } else {
    // grietas: líneas de luz por donde se va a partir
    float bmin = min3(vBary);
    float grieta = 1.0 - smoothstep(0.0, fwidth(bmin) * 1.25, bmin);
    col += vec3(1.0, 0.99, 0.96) * grieta * uLuzGrieta * 2.2;
    // sobre el fondo blanco: cristal claro
    col = mix(col, vec3(0.5) + col * 0.6, uClaro);
    // líneas del logo (contorno, cintura y la A), con grosor real y bordes suaves a cualquier resolución.
    // Blancas sobre negro y negras sobre blanco, como el logo.
    vec3 aa = fwidth(vDist);
    vec3 g = vMasc * uGrosor;
    vec3 l = (1.0 - smoothstep(g - aa, g + aa, vDist)) * step(0.5, vMasc);
    float linea = max(max(l.x, l.y), l.z);
    col = mix(col, mix(vec3(2.4) + refl * 0.5, vec3(0.012), uClaro), linea);
  }
  col = aces(col * uExpo);
  gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`;

/* ---------- 4. Chispas que salen con la explosión ---------- */
const vertexChispas = /* glsl */`
uniform float uP;
uniform float uTiempo;
uniform float uDPR;
uniform float uLejos;
attribute vec3 aVel;
attribute vec4 aAzar;
varying float vA;
void main() {
  float e = clamp((uP - aAzar.x) / 0.6, 0.0, 1.0);
  float ee = 1.0 - pow(1.0 - e, 2.4);
  vec3 p = position + aVel * ee * aAzar.w * uLejos * 0.8;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aAzar.y * uDPR * (9.0 / -mv.z);
  float brillo = 0.55 + 0.45 * sin(uTiempo * 7.0 + aAzar.z * 40.0);
  vA = smoothstep(0.0, 0.05, e) * (1.0 - smoothstep(0.45, 1.0, e)) * brillo;
}`;
const fragmentChispas = /* glsl */`
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vec3(1.0), a * a * vA);
}`;

/* ---------- 5. El estudio de fotos: cajas de luz que se reflejan en las caras ---------- */
function crearEntorno(renderer) {
  const esc = new THREE.Scene();
  esc.background = new THREE.Color(0x000000);
  const az = semilla(7);
  const caja = (w, h, luz, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(luz, luz, luz), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); esc.add(m);
  };
  // degradado gris muy suave para que ninguna cara quede negra del todo
  esc.add(new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    // de abajo oscuro a arriba gris, con una franja clara en el horizonte que dibuja degradados en las caras
    fragmentShader: 'varying vec3 vP; void main(){ float y = vP.y * 0.5 + 0.5; float h = exp(-pow((vP.y - 0.12) / 0.09, 2.0)); gl_FragColor = vec4(vec3(0.012 + 0.13 * y * y + 0.34 * h), 1.0); }',
  })));
  caja(14, 4, 3.2, 0, 9, 2);        // caja de luz cenital
  caja(1.6, 12, 2.2, -8, 1, 3);     // tiras de los lados
  caja(1.6, 12, 2.2, 8, 1, 3);
  caja(6, 2.2, 1.4, -4, 3, -8);     // detrás: lo que se ve a través
  caja(6, 2.2, 1.0, 5, -2, -8);
  caja(12, 1.2, 1.2, 0, -7, 4);     // suelo
  caja(7, 7, 0.7, 0, 1, 11);        // de frente, detrás de la cámara
  for (let i = 0; i < 34; i++) {    // puntos de luz pequeños: los destellos de las caras
    const a = az() * Math.PI * 2, y = -6 + az() * 13, r = 9 + az() * 3;
    caja(0.4, 0.4, 5 + az() * 8, Math.cos(a) * r, y, Math.sin(a) * r);
  }
  const tipo = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const rt = new THREE.WebGLCubeRenderTarget(enMovil ? 256 : 512, { type: tipo, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  new THREE.CubeCamera(0.1, 100, rt).update(renderer, esc);
  esc.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return rt.texture;
}

function texturaBrillo() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.18, 'rgba(255,255,255,.55)');
  r.addColorStop(0.45, 'rgba(225,230,240,.14)');
  r.addColorStop(1, 'rgba(225,230,240,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- 6. Montaje ---------- */
function iniciar() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    raiz.classList.add('sin-webgl');
    return;
  }
  renderer.setClearColor(0x000000, 0);

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camara.position.set(0, 0, 9);

  const gema = new THREE.Group();
  escena.add(gema);

  const { geo, geoEntera, superficie } = construirEsquirlas();
  const uni = {
    uP: { value: 0 }, uGrieta: { value: 0 }, uTiempo: { value: 0 }, uLejos: { value: 5.6 },
    uEnv: { value: crearEntorno(renderer) }, uRot: { value: new THREE.Matrix3() }, uCamLocal: { value: new THREE.Vector3() },
    uLuzGrieta: { value: 0 }, uNucleo: { value: 0 }, uExpo: { value: 1.05 }, uGrosor: { value: 0.018 }, uClaro: { value: 0 },
  };
  const matGema = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: vertexGema, fragmentShader: fragmentGema, side: THREE.DoubleSide, extensions: { derivatives: true, shaderTextureLOD: true } });
  const malla = new THREE.Mesh(geo, matGema);
  malla.frustumCulled = false;
  gema.add(malla);
  const entera = new THREE.Mesh(geoEntera, matGema);
  entera.frustumCulled = false;
  gema.add(entera);

  // chispas
  const N = enMovil ? 450 : 1300;
  const pc = new Float32Array(N * 3), vc = new Float32Array(N * 3), ac = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const base = superficie[Math.floor(azar() * superficie.length)];
    const p = base.clone().multiplyScalar(entre(0.2, 1));
    const v = base.clone().normalize();
    v.x += entre(-0.5, 0.5); v.y += entre(-0.5, 0.5); v.z += entre(-0.3, 0.8);
    v.normalize();
    pc.set([p.x, p.y, p.z], i * 3);
    vc.set([v.x, v.y, v.z], i * 3);
    ac.set([entre(0, 0.25), entre(1.2, 4.2), azar(), entre(0.4, 1.6)], i * 4);
  }
  const geoChispas = new THREE.BufferGeometry();
  geoChispas.setAttribute('position', new THREE.BufferAttribute(pc, 3));
  geoChispas.setAttribute('aVel', new THREE.BufferAttribute(vc, 3));
  geoChispas.setAttribute('aAzar', new THREE.BufferAttribute(ac, 4));
  const uniChispas = { uP: uni.uP, uTiempo: uni.uTiempo, uLejos: uni.uLejos, uDPR: { value: renderer.getPixelRatio() } };
  const chispas = new THREE.Points(geoChispas, new THREE.ShaderMaterial({
    uniforms: uniChispas, vertexShader: vertexChispas, fragmentShader: fragmentChispas,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  chispas.frustumCulled = false;
  gema.add(chispas);

  // halo detrás de la gema y destello al romperse
  const brillo = texturaBrillo();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: brillo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.1 }));
  halo.position.set(0, -0.05, -1.2);
  halo.scale.setScalar(3.4);
  halo.renderOrder = -1;
  gema.add(halo);
  const destello = new THREE.Sprite(new THREE.SpriteMaterial({ map: brillo, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  destello.renderOrder = 5;
  gema.add(destello);

  /* Tamaño: la gema ocupa ~45 % del alto, en el hueco entre el titular y el «Desliza» (en ventanas bajas, más pequeña) */
  const titular = document.querySelector('.hero__arriba');
  const desliza = document.querySelector('.hero__intro');
  let ancho = 0, alto = 0, baseY = 0;
  function ajustar(forzar) {
    const w = lienzo.clientWidth, h = lienzo.clientHeight;
    if (!w || !h || (forzar !== true && w === ancho && h === alto)) return;
    ancho = w; alto = h;
    // Nitidez: la resolución real de la pantalla (×2 como mucho); en escritorio, al menos ×1,5 para que los bordes
    // salgan finos, pero sin pasar de los píxeles de una pantalla 4K (3840 × 2160) para que vaya fluido.
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, enMovil ? 1 : 1.5), 2);
    renderer.setPixelRatio(Math.max(1, Math.min(dpr, Math.sqrt((3840 * 2160) / (w * h)))));
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
    const visH = 2 * camara.position.z * Math.tan(THREE.MathUtils.degToRad(camara.fov / 2));
    const visW = visH * camara.aspect;
    const techo = titular ? titular.offsetTop + titular.offsetHeight + h * 0.035 : h * 0.3;
    const suelo = desliza ? desliza.offsetTop - h * 0.015 : h * 0.92;
    const banda = Math.max(suelo - techo, h * 0.28);
    const altoPx = Math.min(h * (enMovil ? 0.4 : 0.46), banda * 0.88);
    const mundo = visH / h;   // unidades 3D por píxel
    gema.scale.setScalar(Math.min((altoPx * mundo) / 2, (visW * 0.6) / 1.48));
    baseY = (h / 2 - (techo + banda / 2)) * mundo;
    gema.position.y = baseY;
    uniChispas.uDPR.value = renderer.getPixelRatio();
    if (reducido) pintar(0);
  }

  /* Fases del scroll (s de 0 a 1 en todo el hero) */
  const FIN = enMovil ? [0.74, 0.88] : [0.72, 0.86];   // a la vez que el fondo pasa a blanco y entra el formulario
  function fases(s) {
    const vuelve = 1 - suave(FIN[0], FIN[1], s);
    return {
      grieta: suave(0.04, 0.19, s) * vuelve,                       // se agrieta y tiembla
      p: lineal(0.19, 0.6, s) * vuelve,                            // estalla (cada esquirla frena sola)
      nucleo: Math.exp(-(((s - 0.215) / 0.032) ** 2)),             // destello al romperse
      claro: enMovil ? suave(0.72, 0.84, s) : suave(0.70, 0.80, s), // el fondo de la página pasa a blanco (main.js)
    };
  }

  const raton = { x: 0, y: 0 }, incl = { x: 0, y: 0 };
  if (!reducido) addEventListener('pointermove', (ev) => { raton.x = ev.clientX / innerWidth - 0.5; raton.y = ev.clientY / innerHeight - 0.5; }, { passive: true });

  const reloj = new THREE.Clock();
  const inversa = new THREE.Matrix4();
  let t = 0;
  function pintar(dt) {
    t += dt;
    const sFija = prueba.has('s') ? parseFloat(prueba.get('s')) : null;
    const f = fases(sFija ?? (reducido ? 0 : estado.s));
    const k = Math.min(1, dt * 3);
    incl.x += (raton.y * 0.32 - incl.x) * k;
    incl.y += (raton.x * 0.55 - incl.y) * k;
    const quieta = reducido || sFija !== null;
    // se balancea para enseñar que es 3D sin perder la A de vista
    gema.rotation.set(
      incl.x + (quieta ? 0.06 : Math.sin(t * 0.37) * 0.08),
      incl.y + (quieta ? -0.38 : Math.sin(t * 0.55) * 0.5) + f.p * 1.3,
      quieta ? 0 : Math.sin(t * 0.3) * 0.03);
    gema.position.y = baseY + (quieta ? 0 : Math.sin(t * 0.8) * 0.04);
    gema.updateMatrixWorld();
    uni.uRot.value.setFromMatrix4(gema.matrixWorld);
    uni.uCamLocal.value.copy(camara.position).applyMatrix4(inversa.copy(gema.matrixWorld).invert());
    const intacta = f.p < 0.0005 && f.grieta < 0.002;
    entera.visible = intacta;
    malla.visible = !intacta;
    uni.uP.value = f.p;
    uni.uGrieta.value = f.grieta;
    uni.uLuzGrieta.value = f.grieta * (1 - Math.min(1, f.p * 3));
    uni.uNucleo.value = f.nucleo;
    uni.uClaro.value = f.claro;
    uni.uTiempo.value = t;
    destello.material.opacity = Math.min(1, f.nucleo);
    destello.scale.setScalar(1.4 + f.nucleo * 4.2);
    halo.material.opacity = 0.1 * (1 - f.p);
    renderer.render(escena, camara);
  }

  if ('ResizeObserver' in window) new ResizeObserver(() => ajustar()).observe(lienzo);
  addEventListener('resize', () => ajustar());
  ajustar();
  if (document.fonts) document.fonts.ready.then(() => ajustar(true));   // el titular cambia de alto al cargar la letra
  pintar(0);
  raiz.classList.add('gema-lista');
  if (reducido) return;

  // Solo se dibuja mientras el hero está en pantalla
  let enVista = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((e) => { enVista = e[0].isIntersecting; reloj.getDelta(); }, { rootMargin: '120px' }).observe(heroEl);
  }
  lienzo.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); raiz.classList.add('sin-webgl'); });
  renderer.setAnimationLoop(() => {
    const dt = Math.min(reloj.getDelta(), 1 / 20);
    if (enVista) pintar(dt);
  });
}

if (lienzo && heroEl) iniciar();
