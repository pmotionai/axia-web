/* =========================================================================
   Axia · Landing — interacciones
   1) Arranque: Lenis (scroll suave) + GSAP/ScrollTrigger
   2) Fondo que cambia de color por secciones + barra que aparece y cambia de tono
   3) Hero: secuencia del portátil en <canvas> + tarjeta de contacto
   4) iPhone: el chat de WhatsApp avanza con el scroll
   5) Editor: el código se escribe solo, con resaltado de sintaxis
   6) Textos que entran, botones magnéticos, tarjetas que se inclinan, menú
   7) Formulario de contacto (contacto.php)
   ========================================================================= */
(() => {
  'use strict';

  const raiz = document.documentElement;
  // Zoom dentro de la pantalla de la arquitectura (lanzado el 25/11). Para quitarlo: clase «sin-zoom» en <html>.
  const ZOOM = !raiz.classList.contains('sin-zoom');
  if (ZOOM) raiz.classList.add('zoom-arq');
  raiz.classList.remove('sin-js');
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducido) raiz.classList.add('reducido');
  const conRaton = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const WHATSAPP = 'https://wa.me/34684483549?text=' + encodeURIComponent('Hola Pau, he visto la web de Axia y quiero hablar de mi negocio.');

  // Si GSAP no carga, la página se ve entera y estática.
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    raiz.classList.add('reducido');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- 1. Scroll suave con Lenis, sincronizado con ScrollTrigger ---------- */
  let lenis = null;
  if (!reducido && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const posicion = () => (lenis ? lenis.animatedScroll : window.scrollY);
  function irA(destino, offset = 0) {
    const y = typeof destino === 'number' ? destino : destino.getBoundingClientRect().top + window.scrollY + offset;
    if (lenis) lenis.scrollTo(y, { duration: 1.5 });
    else window.scrollTo({ top: y, behavior: reducido ? 'auto' : 'smooth' });
  }

  /* ---------- 2. Fondo por secciones y barra ---------- */
  const NEGRO = [5, 5, 5], BLANCO = [255, 255, 255];
  const aRGB = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const nav = $('#nav');
  let tramoHero = { blancoIni: innerHeight * 0.6, blancoFin: innerHeight, contacto: innerHeight };
  let paradas = [];
  let tramoArq = null;   // solo en la prueba del zoom

  // Cada sección con data-fondo pinta la página de su color al acercarse al centro de la pantalla.
  function calcularParadas() {
    const vh = innerHeight;
    paradas = [{ y: 0, c: NEGRO }, { y: tramoHero.blancoIni, c: NEGRO }, { y: tramoHero.blancoFin, c: BLANCO }];
    let previo = BLANCO;
    $$('[data-fondo]').forEach((s) => {
      // Si la sección está fijada (pin) cuenta su hueco en la página: fijada no tiene offsetParent ni su posición real
      const ref = s.parentElement && s.parentElement.classList.contains('pin-spacer') ? s.parentElement : s;
      if (!ref.offsetParent && s.tagName !== 'FOOTER') return;     // oculta en este tamaño
      const c = aRGB(s.dataset.fondo);
      const arriba = ref.getBoundingClientRect().top + window.scrollY;
      paradas.push({ y: Math.max(tramoHero.blancoFin, arriba - vh * 0.85), c: previo });
      paradas.push({ y: Math.max(tramoHero.blancoFin, arriba - vh * 0.35), c });
      previo = c;
      if (s.id === 'arquitectura' && tramoArq) { paradas.push({ y: tramoArq.ini, c }, { y: tramoArq.fin, c: BLANCO }); previo = BLANCO; }
    });
  }
  function colorEn(y) {
    if (y <= paradas[0].y) return paradas[0].c;
    for (let i = 1; i < paradas.length; i++) {
      const a = paradas[i - 1], b = paradas[i];
      if (y <= b.y) {
        const k = b.y === a.y ? 1 : (y - a.y) / (b.y - a.y);
        return a.c.map((v, j) => Math.round(v + (b.c[j] - v) * k));
      }
    }
    return paradas[paradas.length - 1].c;
  }
  function alMover() {
    const y = posicion();
    const c = colorEn(y);
    raiz.style.setProperty('--fondo', `rgb(${c[0]}, ${c[1]}, ${c[2]})`);
    nav.classList.toggle('flota', y > 40);   // arriba estirada; al bajar, píldora con contorno blanco
  }
  if (lenis) lenis.on('scroll', alMover);
  else window.addEventListener('scroll', alMover, { passive: true });
  ScrollTrigger.addEventListener('refresh', () => { calcularParadas(); alMover(); });

  /* ---------- 3. Hero: el portátil se abre, gira y deja sitio al contacto ---------- */
  const hero = $('#inicio');
  const lienzo = $('#lienzo');
  const ctx = lienzo.getContext('2d');
  const cajaLienzo = $('.hero__lienzo');
  const tarjeta = $('#contacto');
  const huecoHero = $('.hero__contacto');
  const huecoMovil = $('#contacto-movil .contenedor');
  const enMovil = matchMedia('(max-width: 899px)').matches;          // juego de imágenes según el tamaño al cargar
  const CARPETA = enMovil ? 'frames-movil' : 'frames';
  const TOTAL = enMovil ? 75 : 150;
  const imagenes = new Array(TOTAL);
  const secuencia = { frame: 0 };
  let pintada = null;

  // Precarga: primero una de cada 8, luego cada 4, 2 y 1 → se puede hacer scroll enseguida.
  function cargar(i) {
    if (imagenes[i]) return;
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { im.lista = true; if (Math.abs(Math.round(secuencia.frame) - i) < 4) pintar(true); };
    im.src = `${CARPETA}/f${String(i).padStart(3, '0')}.webp`;
    imagenes[i] = im;
  }
  cargar(0); cargar(TOTAL - 1);
  [8, 4, 2, 1].forEach((paso) => { for (let i = 0; i < TOTAL; i += paso) cargar(i); });

  function cercana(i) {
    if (imagenes[i] && imagenes[i].lista) return imagenes[i];
    for (let k = 1; k < TOTAL; k++) {
      const a = imagenes[i - k], b = imagenes[i + k];
      if (a && a.lista) return a;
      if (b && b.lista) return b;
    }
    return null;
  }
  function pintar(forzar = false) {
    const i = Math.max(0, Math.min(TOTAL - 1, Math.round(secuencia.frame)));
    const im = cercana(i);
    if (!im || (im === pintada && !forzar)) return;
    pintada = im;
    const W = lienzo.width, H = lienzo.height, r = im.naturalWidth / im.naturalHeight;
    let h = H * 0.66, w = h * r;
    const maxW = W * (W < H ? 1.06 : 0.94);
    if (w > maxW) { w = maxW; h = w / r; }
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(im, (W - w) / 2, H * 0.64 - h / 2, w, h);   // por debajo del centro: arriba va el titular
  }
  function ajustarLienzo() {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(lienzo.clientWidth * d), h = Math.round(lienzo.clientHeight * d);
    if (!w || !h || (w === lienzo.width && h === lienzo.height)) return;
    lienzo.width = w; lienzo.height = h;
    pintar(true);
  }
  // El lienzo se ajusta a su tamaño real (también si cambia sin evento resize)
  if ('ResizeObserver' in window) new ResizeObserver(ajustarLienzo).observe(lienzo);
  window.addEventListener('resize', ajustarLienzo);
  ajustarLienzo();

  // El titular entra con fade al cargar
  gsap.from('.hero__arriba', { autoAlpha: 0, y: 34, duration: 1.4, delay: 0.15, ease: 'power3.out' });

  const mm = gsap.matchMedia();
  mm.add({ escritorio: '(min-width: 900px)', movil: '(max-width: 899px)', quieto: '(prefers-reduced-motion: reduce)' }, (contexto) => {
    const { escritorio, quieto } = contexto.conditions;
    // La tarjeta vive dentro del hero en escritorio y debajo del portátil en móvil.
    (escritorio && !quieto ? huecoHero : huecoMovil).appendChild(tarjeta);

    if (quieto) {
      secuencia.frame = TOTAL - 1; pintar(true);
      const fin = () => hero.offsetTop + hero.offsetHeight;
      tramoHero = { blancoIni: fin() - innerHeight * 0.4, blancoFin: fin(), contacto: fin() };
      return;
    }

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: escritorio ? '+=420%' : '+=300%',
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
        onRefresh: (st) => {
          const largo = st.end - st.start;
          tramoHero = escritorio
            ? { blancoIni: st.start + largo * 0.70, blancoFin: st.start + largo * 0.80, contacto: st.start + largo * 0.95 }
            : { blancoIni: st.start + largo * 0.72, blancoFin: st.start + largo * 0.84, contacto: st.end + innerHeight * 0.1 };
        },
      },
    });

    // 0 → 70 %: el portátil se abre de espaldas, gira 180° y queda de frente
    tl.to(secuencia, { frame: TOTAL - 1, duration: 0.70, onUpdate: () => pintar() }, 0)
      .to('.hero__intro', { autoAlpha: 0, duration: 0.05 }, 0.01)
      .to('.hero__titular', { autoAlpha: 0, y: -50, duration: 0.07 }, 0.62)
      .to('.hero__brillo', { autoAlpha: 0, duration: 0.08 }, 0.68)
      // las manchas de color se desplazan con el scroll mientras el portátil gira
      .to('.hero__brillo i:nth-child(1)', { xPercent: 22, yPercent: -18, duration: 0.7 }, 0)
      .to('.hero__brillo i:nth-child(2)', { xPercent: -18, yPercent: 20, duration: 0.7 }, 0)
      .to('.hero__brillo i:nth-child(3)', { xPercent: 30, yPercent: 26, duration: 0.7 }, 0)
      .to('.hero__brillo i:nth-child(4)', { xPercent: -24, yPercent: -16, duration: 0.7 }, 0)
      .to('.hero__brillo i:nth-child(5)', { xPercent: -30, yPercent: 10, duration: 0.7 }, 0);

    if (escritorio) {
      // 72 → 100 %: el fondo pasa a blanco, el portátil se va a la izquierda y entra la tarjeta
      tl.to(cajaLienzo, { x: () => -innerWidth * 0.22, scale: 0.8, duration: 0.12, ease: 'power2.inOut' }, 0.72)
        .fromTo(tarjeta, { autoAlpha: 0, x: 90 }, { autoAlpha: 1, x: 0, duration: 0.1, ease: 'power3.out' }, 0.80)
        .from($$('.anima', tarjeta), { autoAlpha: 0, y: 24, duration: 0.06, stagger: 0.008, ease: 'power2.out' }, 0.83)
        .to({}, { duration: 0.08 }, 0.92);   // pausa final para rellenar el formulario
    } else {
      tl.to(cajaLienzo, { y: () => innerHeight * 0.06, scale: 0.92, duration: 0.14, ease: 'power2.inOut' }, 0.74)
        .to({}, { duration: 0.1 }, 0.9);
    }

    return () => { gsap.set(cajaLienzo, { clearProps: 'transform' }); gsap.set(tarjeta, { clearProps: 'all' }); };
  });

  /* ---------- 4. Arquitectura: el MacBook enseña cómo fluye un cliente ---------- */
  // Giro del MacBook (portatil.html?giro=1 de projects/axia-web-3d): de lado a recto, con las esquinas
  // de la pantalla en cada imagen. La primera imagen es la pose de reposo; el resto se usa en el zoom.
  const GIRO = window.AXIA_MAC_GIRO;
  const MAC = { ancho: GIRO.ancho, alto: GIRO.alto, esquinas: GIRO.esquinas[0] };
  const ULTIMO_GIRO = GIRO.esquinas.length - 1;
  const rutaGiro = (i) => (window.AXIA_GIRO_IMGS ? window.AXIA_GIRO_IMGS[i] : `img/giro-${String(i).padStart(3, '0')}.webp?v=202611260818`);
  let esquinasActuales = MAC.esquinas;
  const seccionArq = $('#arquitectura');
  const mac = $('#mac');
  const macImg = $('.mac__img', mac);
  const pantallaArq = $('#pantalla-arq');
  const pasos = $$('#pasos li');

  // Deforma un rectángulo de w×h para que encaje en 4 puntos (perspectiva real con matrix3d)
  function matrizCuadrilatero(w, h, p) {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = p;
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
    const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    const den = dx1 * dy2 - dx2 * dy1;
    const g = (dx3 * dy2 - dx2 * dy3) / den, k = (dx1 * dy3 - dx3 * dy1) / den;
    const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3, d = y1 - y0 + g * y1, e = y3 - y0 + k * y3;
    return `matrix3d(${a / w},${d / w},0,${g / w},${b / h},${e / h},0,${k / h},0,0,1,0,${x0},${y0},0,1)`;
  }
  function colocarPantalla() {
    const s = macImg.clientWidth / MAC.ancho;
    if (s) pantallaArq.style.transform = matrizCuadrilatero(GIRO.pantalla.ancho, GIRO.pantalla.alto, esquinasActuales.map(([x, y]) => [x * s, y * s]));
  }
  // Imágenes del giro: se precargan al abrir la página y se cambian según el scroll (la pantalla HTML las sigue).
  // Si al hacer scroll rápido una imagen aún no ha llegado, se pone la más cercana y se corrige en cuanto llega.
  const cacheGiro = [];
  let giroActual = 0, giroObjetivo = 0;
  const lista = (im) => im && im.complete && im.naturalWidth > 0;
  function precargarGiro() {
    if (cacheGiro.length) return;
    for (let i = 0; i <= ULTIMO_GIRO; i++) {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => { if (i !== giroActual && i <= Math.round(giroObjetivo)) ponerGiro(giroObjetivo); };
      im.src = rutaGiro(i);
      cacheGiro.push(im);
    }
  }
  function ponerGiro(f) {
    giroObjetivo = f;
    let i = Math.max(0, Math.min(ULTIMO_GIRO, Math.round(f)));
    while (i > 0 && !lista(cacheGiro[i])) i--;
    if (i === giroActual || !lista(cacheGiro[i])) return;
    macImg.src = cacheGiro[i].src;
    giroActual = i;
    esquinasActuales = GIRO.esquinas[i];
    colocarPantalla();
  }
  if (document.readyState === 'complete') precargarGiro();
  else window.addEventListener('load', precargarGiro);
  if ('ResizeObserver' in window) new ResizeObserver(colocarPantalla).observe(macImg);
  window.addEventListener('resize', colocarPantalla);
  colocarPantalla();

  // Líneas que unen Cliente → Axia → Tu equipo → Cierre (se recalculan si cambia la letra)
  function caja(el) {
    let x = 0, y = 0, e = el;
    while (e && e !== pantallaArq) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }
  const tramos = [['#ap-cliente', '#ap-ia', 'l1'], ['#ap-axia', '#ap-equipo', 'l2'], ['#ap-equipo', '#ap-cierre', 'l3']];
  function trazarLineas() {
    tramos.forEach(([de, a, id]) => {
      const A = caja($(de)), B = caja($(a));
      const x1 = A.x + A.w + 8, y1 = A.y + Math.min(A.h / 2, 150), x2 = B.x - 8, y2 = B.y + Math.min(B.h / 2, 150);
      const dx = (x2 - x1) / 2;
      const d = `M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      $('#' + id).setAttribute('d', d);
      $('#' + id + 'b').setAttribute('d', d);
    });
  }
  trazarLineas();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(trazarLineas);

  function linea(id, d) {
    const path = $('#' + id), punto = $('#' + id + 'c'), p = { k: 0 };
    return gsap.timeline()
      .fromTo(path, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.45 * d, ease: 'power1.inOut' })
      .fromTo(p, { k: 0 }, {
        k: 1, duration: 0.45 * d, ease: 'power1.inOut',
        onUpdate: () => {
          const pt = path.getPointAtLength(path.getTotalLength() * p.k);
          punto.setAttribute('cx', pt.x); punto.setAttribute('cy', pt.y);
          punto.style.opacity = p.k > 0.02 && p.k < 0.98 ? 1 : 0;
        },
      }, 0);
  }
  function marcarPaso(tl) {
    const t = tl.time();
    const i = t < tl.labels.p2 ? 0 : t < tl.labels.p3 ? 1 : t < tl.labels.p4 ? 2 : 3;
    pasos.forEach((li, n) => li.classList.toggle('on', n === i));
  }
  function montarArq(tl, d = 1) {
    const enciende = { opacity: 1, borderColor: '#d1d1d6', backgroundColor: '#1b1b1e', duration: 0.3 * d };
    tl.addLabel('p1')
      .to('#ap-cliente', enciende)
      .from('#ap-cliente .ap__canales span', { autoAlpha: 0, y: 16, stagger: 0.05 * d, duration: 0.25 * d }, '<')
      .add(linea('l1', d))
      .addLabel('p2')
      .to('#ap-ia', enciende)
      .to('#ap-crm', enciende, '+=' + 0.12 * d)
      .to('#ap-auto', enciende, '+=' + 0.12 * d)
      .add(linea('l2', d))
      .addLabel('p3')
      .to('#ap-equipo', enciende)
      .from('#ap-equipo .ap__aviso', { autoAlpha: 0, x: 30, duration: 0.3 * d }, '<')
      .add(linea('l3', d))
      .addLabel('p4')
      .to('#ap-cierre', enciende)
      .from('#ap-cierre li', { autoAlpha: 0, x: 20, stagger: 0.12 * d, duration: 0.25 * d }, '<')
      .to({}, { duration: 0.45 * d });
    tl.fromTo('#ap-pista', { scaleX: 0 }, { scaleX: 1, duration: tl.duration(), ease: 'none' }, 0);
    tl.eventCallback('onUpdate', () => marcarPaso(tl));
    marcarPaso(tl);
    return tl;
  }

  // Al acabar el recorrido: 1) el MacBook se pone recto mientras va al centro, 2) entra de frente
  // en la pantalla, que se vuelve blanca y desemboca en «Primero entendemos tu empresa».
  function meterseEnLaPantalla(tl) {
    const escena = $('.mac-escena', seccionArq);
    const texto = $('.bloque-texto', seccionArq);
    const giro = { f: 0 };
    // Pantalla en la última imagen (recta = rectángulo), medida respecto a la sección fijada
    const medir = () => {
      const sec = seccionArq.getBoundingClientRect(), esc = escena.getBoundingClientRect(), img = macImg.getBoundingClientRect();
      const s = img.width / MAC.ancho;
      const xs = GIRO.esquinas[ULTIMO_GIRO].map(([x]) => img.left - esc.left + x * s);
      const ys = GIRO.esquinas[ULTIMO_GIRO].map(([, y]) => img.top - esc.top + y * s);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, ancho: x1 - x0, alto: y1 - y0, escX: esc.left - sec.left, escY: esc.top - sec.top };
    };
    precargarGiro();   // por si la página aún no había terminado de cargar
    tl.addLabel('zoom', '+=0.15')
      .to(texto, { autoAlpha: 0, x: -70, duration: 0.35, ease: 'power2.in' }, 'zoom')
      // 1) se endereza y se centra
      .to(giro, { f: ULTIMO_GIRO, duration: 0.9, ease: 'power2.inOut', onUpdate: () => ponerGiro(giro.f) }, 'zoom')
      .fromTo(escena, { x: 0, y: 0 }, {
        transformOrigin: () => { const m = medir(); return `${m.cx}px ${m.cy}px`; },
        x: () => { const m = medir(); return innerWidth / 2 - (m.escX + m.cx); },
        y: () => { const m = medir(); return innerHeight / 2 - (m.escY + m.cy); },
        duration: 0.9, ease: 'power2.inOut', immediateRender: false,   // se mide al llegar, con la sección ya fijada
      }, 'zoom')
      // 2) entra de frente hasta que la pantalla llena toda la vista
      .fromTo(escena, { scale: 1 }, {
        scale: () => { const m = medir(); return Math.max(innerWidth / m.ancho, innerHeight / m.alto) * 1.08; },
        duration: 1, ease: 'power3.in', immediateRender: false,
      }, 'zoom+=0.9')
      .to('#ap-final', { opacity: 1, duration: 0.55, ease: 'power1.in' }, 'zoom+=1.3')
      .to('#pantalla-arq .mac__brillo', { opacity: 0, duration: 0.55, ease: 'power1.in' }, 'zoom+=1.3')   // el reflejo dejaba rayas sobre el blanco
      // 3) con la pantalla ya llenando la vista, el resto del portátil desaparece: la sección es más alta que la
      //    ventana y, al soltarse, asomaba el teclado por abajo (Pau, 25/11). Así al subir solo queda blanco.
      .to(macImg, { autoAlpha: 0, duration: 0.02 }, 'zoom+=1.9')
      .to({}, { duration: 0.2 });
  }

  mm.add({ escritorio: '(min-width: 900px)', quieto: '(prefers-reduced-motion: reduce)' }, (contexto) => {
    const { escritorio, quieto } = contexto.conditions;
    if (quieto) {
      gsap.set(['#ap-cliente', '#ap-ia', '#ap-crm', '#ap-auto', '#ap-equipo', '#ap-cierre'], { opacity: 1, borderColor: '#d1d1d6' });
      gsap.set('.ap__lineas .activa', { strokeDashoffset: 0 });
      gsap.set('#ap-pista', { scaleX: 1 });
      pasos.forEach((li) => li.classList.add('on'));
      return;
    }
    if (escritorio) {
      // El MacBook entra girando desde la derecha mientras la sección sube...
      gsap.fromTo(mac,
        { x: () => innerWidth * 0.3, rotationY: -28, rotationZ: -4, autoAlpha: 0 },
        { x: 0, rotationY: 0, rotationZ: 0, autoAlpha: 1, ease: 'power3.out',
          scrollTrigger: { trigger: seccionArq, start: 'top 85%', end: 'top 10%', scrub: 0.8, invalidateOnRefresh: true } });
      // ...y la sección se queda fija mientras el cliente recorre el sistema
      const tlArq = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: seccionArq, start: 'top top', end: ZOOM ? '+=380%' : '+=220%', pin: true, scrub: 0.6, invalidateOnRefresh: true,
          onRefresh: (st) => {
            // En la prueba del zoom, la página pasa a blanco justo cuando la pantalla llena la vista
            tramoArq = ZOOM ? { ini: st.start + (st.end - st.start) * 0.84, fin: st.end - 2 } : null;
          },
          // Si se baja rápido, el scrub va por detrás: al salir se termina de golpe para que no asome el portátil
          onLeave: (st) => { const tw = st.getTween && st.getTween(); if (tw) tw.progress(1); },
        },
      });
      montarArq(tlArq);
      if (ZOOM) meterseEnLaPantalla(tlArq);
    } else {
      gsap.fromTo(mac, { y: 70, rotationX: 16, autoAlpha: 0 }, { y: 0, rotationX: 0, autoAlpha: 1, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: mac, start: 'top 85%', once: true } });
      montarArq(gsap.timeline({ delay: 0.5, scrollTrigger: { trigger: mac, start: 'top 65%', once: true } }), 1.2);
    }
  });

  /* ---------- 4b. Proceso: las fases se encienden al bajar ---------- */
  const fases = $$('.fase');
  if (reducido) {
    fases.forEach((f) => f.classList.add('on'));
    gsap.set('.fases__linea', { scaleY: 1 });
    gsap.set('#proceso-progreso', { scaleX: 1 });
  } else {
    fases.forEach((f) => ScrollTrigger.create({
      trigger: f, start: 'top 68%',
      onEnter: () => f.classList.add('on'),
      onLeaveBack: () => f.classList.remove('on'),
    }));
    const tramoFases = { trigger: '#fases', start: 'top 68%', end: 'bottom 68%', scrub: 0.5 };
    gsap.fromTo('.fases__linea', { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: tramoFases });
    gsap.fromTo('#proceso-progreso', { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { ...tramoFases } });
  }

  /* ---------- 4c. Servicios: desplegables animados (uno abierto cada vez) ---------- */
  const itemsServicio = $$('.serv-item');
  let refrescar = null;
  const refrescarLuego = () => { clearTimeout(refrescar); refrescar = setTimeout(() => ScrollTrigger.refresh(), 120); };
  function desplegar(item, abrir) {
    const boton = $('.serv-item__boton', item), panel = $('.serv-item__panel', item), dentro = $('.serv-item__dentro', item);
    boton.setAttribute('aria-expanded', String(abrir));
    item.classList.toggle('abierto', abrir);
    gsap.killTweensOf([panel, ...dentro.children]);
    if (abrir) {
      panel.hidden = false;
      if (reducido) { gsap.set(panel, { height: 'auto' }); refrescarLuego(); return; }
      gsap.fromTo(panel, { height: panel.offsetHeight }, { height: 'auto', duration: 0.65, ease: 'power3.inOut', onComplete: refrescarLuego });
      gsap.fromTo(dentro.children, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08, delay: 0.18, ease: 'power3.out' });
    } else {
      if (reducido) { gsap.set(panel, { height: 0 }); panel.hidden = true; refrescarLuego(); return; }
      gsap.to(dentro.children, { autoAlpha: 0, y: -10, duration: 0.25, stagger: 0.03, ease: 'power2.in' });
      gsap.to(panel, { height: 0, duration: 0.5, ease: 'power3.inOut', onComplete: () => { panel.hidden = true; refrescarLuego(); } });
    }
  }
  itemsServicio.forEach((item) => {
    $('.serv-item__boton', item).addEventListener('click', () => {
      const abrir = !item.classList.contains('abierto');
      itemsServicio.forEach((otro) => { if (otro !== item && otro.classList.contains('abierto')) desplegar(otro, false); });
      desplegar(item, abrir);
    });
  });

  /* ---------- 4d. Casos: la franja de sectores se desliza con el scroll ---------- */
  if (!reducido) {
    $$('.sectores__fila').forEach((fila) => {
      const derecha = fila.dataset.direccion === "1";
      gsap.fromTo(fila, { xPercent: derecha ? -35 : 0 }, { xPercent: derecha ? 0 : -35, ease: 'none', scrollTrigger: { trigger: '.sectores', start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
    });
  }

  /* ---------- 5. Editor: el código se escribe solo ---------- */
  const fuente = $('#codigo-fuente').textContent.replace(/^\s*\n/, '').replace(/\s+$/, '');
  const destinoCodigo = $('#codigo');
  const cuerpoEditor = $('.editor__cuerpo');
  const PALABRAS = new Set('and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(' '));
  const PATRON = /(#.*$)|([rRbBfF]{0,2}"""[^]*?"""|[rRbBfF]{0,2}"(?:\\.|[^"\\])*"|[rRbBfF]{0,2}'(?:\\.|[^'\\])*')|(@[\w.]+)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|(\s+)|([^\sA-Za-z_\d])/g;

  // Divide una línea de Python en trozos con su clase de color.
  function trocear(linea) {
    const trozos = [];
    let m, anterior = '';
    PATRON.lastIndex = 0;
    while ((m = PATRON.exec(linea))) {
      const [texto, com, str, dec, num, id, , op] = m;
      let c = '';
      if (com) c = 't-com';
      else if (str) c = 't-str';
      else if (dec) c = 't-dec';
      else if (num) c = 't-num';
      else if (id) {
        if (PALABRAS.has(id)) c = 't-kw';
        else if (id === 'True' || id === 'False' || id === 'None' || /^[A-Z][A-Z0-9_]+$/.test(id)) c = 't-cte';
        else if (anterior === 'def' || linea[PATRON.lastIndex] === '(') c = 't-fn';
        else if (anterior === 'class' || /^[A-Z]/.test(id)) c = 't-cls';
      } else if (op) c = /[=+\-*/<>%!&|^~]/.test(op) ? 't-op' : '';
      trozos.push({ texto, c });
      if (id) anterior = id; else if (!/^\s+$/.test(texto)) anterior = '';
    }
    return trozos;
  }
  const lineas = fuente.split('\n').map(trocear);

  function pintarCodigoEntero() {
    destinoCodigo.textContent = '';
    lineas.forEach((trozos) => {
      const l = document.createElement('span'); l.className = 'linea';
      trozos.forEach(({ texto, c }) => { const s = document.createElement('span'); if (c) s.className = c; s.textContent = texto; l.appendChild(s); });
      destinoCodigo.appendChild(l);
    });
  }
  function terminal() {
    $$('#terminal div').forEach((d, i) => setTimeout(() => d.classList.add('on'), reducido ? 0 : 350 + i * 520));
  }
  function escribir() {
    destinoCodigo.textContent = '';
    const cursor = document.createElement('span'); cursor.className = 'cursor';
    const POR_SEGUNDO = 360;
    let li = 0, ti = 0, ci = 0, lineaEl = null, trozoEl = null, credito = 0, antes = performance.now();
    const nuevaLinea = () => { lineaEl = document.createElement('span'); lineaEl.className = 'linea'; destinoCodigo.appendChild(lineaEl); lineaEl.appendChild(cursor); };
    nuevaLinea();
    function paso(ahora) {
      credito += ((ahora - antes) / 1000) * POR_SEGUNDO; antes = ahora;
      while (credito >= 1) {
        if (li >= lineas.length) {
          gsap.to(cuerpoEditor, { scrollTop: cuerpoEditor.scrollHeight - cuerpoEditor.clientHeight, duration: 0.6, ease: 'power2.out' });
          terminal();
          return;
        }
        const trozos = lineas[li];
        if (ti >= trozos.length) { li++; ti = 0; ci = 0; trozoEl = null; credito -= 1; if (li < lineas.length) nuevaLinea(); continue; }
        const t = trozos[ti];
        if (!trozoEl) { trozoEl = document.createElement('span'); if (t.c) trozoEl.className = t.c; lineaEl.insertBefore(trozoEl, cursor); }
        if (/^\s+$/.test(t.texto)) { trozoEl.textContent = t.texto; ti++; trozoEl = null; continue; }   // la sangría sale de golpe
        trozoEl.textContent += t.texto[ci++]; credito -= 1;
        if (ci >= t.texto.length) { ti++; ci = 0; trozoEl = null; }
      }
      // el editor baja solo siguiendo al cursor
      const objetivo = Math.max(0, lineaEl.offsetTop + lineaEl.offsetHeight - cuerpoEditor.clientHeight + 48);
      const falta = objetivo - cuerpoEditor.scrollTop;
      if (falta > 0) cuerpoEditor.scrollTop += Math.max(falta * 0.25, falta - 60);   // nunca se queda atrás
      requestAnimationFrame(paso);
    }
    requestAnimationFrame((t) => { antes = t; paso(t); });
  }
  if (reducido) { pintarCodigoEntero(); terminal(); }
  else ScrollTrigger.create({ trigger: '.editor', start: 'top 72%', once: true, onEnter: escribir });

  /* ---------- 6. Textos que entran, botones magnéticos, tarjetas y menú ---------- */
  if (!reducido) {
    ScrollTrigger.batch('.revela', {
      start: 'top 88%',
      once: true,
      onEnter: (lote) => gsap.to(lote, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.08, overwrite: true }),
    });
  }

  if (!reducido && conRaton) {
    // Botones magnéticos: el botón (y un poco más su texto) sigue al ratón y vuelve con rebote
    $$('.magnetico').forEach((el) => {
      const texto = $('.boton__texto', el);
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
      const txTo = texto && gsap.quickTo(texto, 'x', { duration: 0.6, ease: 'power3.out' });
      const tyTo = texto && gsap.quickTo(texto, 'y', { duration: 0.6, ease: 'power3.out' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        xTo(dx * 0.3); yTo(dy * 0.4);
        if (texto) { txTo(dx * 0.12); tyTo(dy * 0.15); }
      });
      el.addEventListener('pointerleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' });
        if (texto) gsap.to(texto, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' });
      });
    });
  }

  // Menú: mega menú de Servicios (clic en táctil) y hamburguesa en móvil
  const tieneMenu = $('#tiene-menu');
  const botonServicios = $('button', tieneMenu);
  botonServicios.addEventListener('click', () => botonServicios.setAttribute('aria-expanded', tieneMenu.classList.toggle('abierto')));
  document.addEventListener('click', (e) => { if (!tieneMenu.contains(e.target)) { tieneMenu.classList.remove('abierto'); botonServicios.setAttribute('aria-expanded', 'false'); } });
  const hamburguesa = $('#hamburguesa');
  hamburguesa.addEventListener('click', () => hamburguesa.setAttribute('aria-expanded', nav.classList.toggle('abierto')));

  // Enlaces internos con scroll suave. «Contacto» lleva a la tarjeta, esté donde esté.
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      e.preventDefault();
      nav.classList.remove('abierto'); tieneMenu.classList.remove('abierto');
      if (id === '#contacto') {
        if (huecoHero.contains(tarjeta)) irA(tramoHero.contacto);
        else irA(tarjeta, -110);
        return;
      }
      const destino = $(id);
      if (destino) irA(destino, id === '#inicio' ? 0 : -80);
    });
  });

  /* ---------- 7. Formulario de contacto ---------- */
  const form = $('#formulario');
  const aviso = $('.formulario__estado', form);
  const botonEnviar = $('button[type="submit"]', form);
  const avisar = (html, tipo = '') => { aviso.className = 'formulario__estado ancho ' + tipo; aviso.innerHTML = html; };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let valido = true;
    $$('[required]', form).forEach((c) => {
      const bien = c.type === 'checkbox' ? c.checked : c.value.trim() !== '' && (c.type !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.value.trim()));
      const campo = c.closest('.campo');
      if (campo) campo.classList.toggle('error', !bien);
      if (!bien) valido = false;
    });
    if (!valido) { avisar('Revisa los campos marcados.', 'mal'); return; }

    botonEnviar.disabled = true;
    avisar('Enviando…');
    try {
      const r = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok || !datos.ok) throw new Error(datos.mensaje || 'error');
      form.reset();
      avisar(datos.mensaje || '¡Gracias! Te respondemos en menos de 24 h.', 'ok');
    } catch {
      avisar(`No se ha podido enviar desde aquí. <a href="${WHATSAPP}" target="_blank" rel="noopener">Escríbenos por WhatsApp</a> y te respondemos.`, 'mal');
    } finally {
      botonEnviar.disabled = false;
    }
  });

  // Recalcular posiciones cuando cargan las fuentes (cambian las alturas)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
