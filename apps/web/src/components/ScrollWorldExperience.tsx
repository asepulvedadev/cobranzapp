"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

const scenes = [
  {
    time: "06:45",
    eyebrow: "Preparar",
    title: "La cartera define la jornada",
    text: "El propietario y el supervisor priorizan vencimientos, asignan responsables y separan las excepciones antes de salir.",
    detail: "Ruta Norte · 12 gestiones asignadas",
  },
  {
    time: "09:20",
    eyebrow: "Gestionar",
    title: "La ruta conecta cada visita",
    text: "El cobrador recibe una jornada ordenada y registra el resultado contra el cliente y la obligación correctos.",
    detail: "Avance de ruta · 7 de 12 gestiones",
  },
  {
    time: "14:10",
    eyebrow: "Supervisar",
    title: "Las novedades llegan con contexto",
    text: "El supervisor identifica diferencias, compromisos y casos detenidos sin reconstruir el día por llamadas o mensajes.",
    detail: "Revisión · 2 casos necesitan atención",
  },
  {
    time: "18:05",
    eyebrow: "Conciliar",
    title: "El cierre muestra dónde quedó el recaudo",
    text: "Pagos, efectivo, transferencias y novedades se comparan antes de dar la jornada por terminada.",
    detail: "Cierre diario · sin diferencias abiertas",
  },
];

const cameraPoints = [
  { x: 0, y: 0, scale: 1 },
  { x: 13, y: 8, scale: 1.34 },
  { x: -3, y: -1, scale: 1.48 },
  { x: -18, y: -8, scale: 1.36 },
];

function interpolate(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

export function ScrollWorldExperience() {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const image = imageRef.current;
    const progress = progressRef.current;
    if (!section || !image || !progress) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let activeScene = -1;

    const render = () => {
      frame = 0;
      const mobile = window.innerWidth <= 860;
      if (mobile || reduceMotion.matches) {
        image.style.transform = "none";
        progress.style.transform = "scaleX(1)";
        section.dataset.scene = "0";
        return;
      }

      const bounds = section.getBoundingClientRect();
      const scrollable = Math.max(section.offsetHeight - window.innerHeight, 1);
      const ratio = Math.min(Math.max(-bounds.top / scrollable, 0), 1);
      const position = ratio * (cameraPoints.length - 1);
      const segment = Math.min(Math.floor(position), cameraPoints.length - 2);
      const localProgress = position - segment;
      const eased = localProgress * localProgress * (3 - 2 * localProgress);
      const from = cameraPoints[segment];
      const to = cameraPoints[segment + 1];
      const x = interpolate(from.x, to.x, eased);
      const y = interpolate(from.y, to.y, eased);
      const scale = interpolate(from.scale, to.scale, eased);
      const nextScene = Math.min(Math.round(position), scenes.length - 1);

      image.style.transform = `translate3d(${x}%, ${y}%, 0) scale(${scale})`;
      progress.style.transform = `scaleX(${ratio})`;
      if (nextScene !== activeScene) {
        activeScene = nextScene;
        section.dataset.scene = String(nextScene);
      }
    };

    const requestRender = () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    render();
    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", requestRender);
    reduceMotion.addEventListener("change", requestRender);

    return () => {
      window.removeEventListener("scroll", requestRender);
      window.removeEventListener("resize", requestRender);
      reduceMotion.removeEventListener("change", requestRender);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section className="scroll-world" id="como-funciona" ref={sectionRef} data-scene="0">
      <div className="scroll-world-sticky">
        <div className="scroll-world-camera" ref={imageRef}>
          <Image
            src="/images/cobranzaap-world.webp"
            alt="Recorrido ilustrado por la oficina, la ruta, la supervisión y el cierre de cobranza"
            fill
            priority
            sizes="100vw"
          />
        </div>
        <div className="scroll-world-shade" aria-hidden="true" />
        <div className="scroll-world-heading">
          <span className="eyebrow">Control de cartera hecho en Cúcuta</span>
          <p>Desplázate para seguir un día de operación</p>
        </div>
        <div className="scroll-world-captions">
          {scenes.map((scene, index) => (
            <article key={scene.time} data-scene-card={index}>
              <span className="scroll-world-time">{scene.time}</span>
              <span className="card-kicker">{scene.eyebrow}</span>
              {index === 0 ? <h1>{scene.title}</h1> : <h2>{scene.title}</h2>}
              <p>{scene.text}</p>
              <strong>{scene.detail}</strong>
            </article>
          ))}
        </div>
        <div className="scroll-world-route" aria-hidden="true">
          <span className="scroll-world-progress" ref={progressRef} />
          {scenes.map((scene, index) => (
            <i key={scene.time} data-route-point={index} />
          ))}
        </div>
        <span className="scroll-world-hint" aria-hidden="true">
          Desliza para avanzar
        </span>
      </div>
    </section>
  );
}
