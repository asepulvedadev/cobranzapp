"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { heroMotionFrame, heroScrollProgress } from "../lib/hero-motion";

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

export function ScrollWorldExperience() {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    const image = imageRef.current;
    const progress = progressRef.current;
    if (!section || !sticky || !image || !progress) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const shortViewport = window.matchMedia("(max-width: 860px) and (max-height: 600px)");
    let frame = 0;
    let activeScene = -1;
    let previousRatio = -1;

    const render = () => {
      frame = 0;
      if (reduceMotion.matches || shortViewport.matches) {
        section.dataset.motion = "static";
        image.style.transform = "none";
        progress.style.transform = "scaleX(1)";
        section.dataset.scene = "0";
        activeScene = -1;
        previousRatio = -1;
        return;
      }

      section.dataset.motion = "animated";
      const bounds = section.getBoundingClientRect();
      const ratio = heroScrollProgress(bounds.top, section.offsetHeight, sticky.offsetHeight);
      if (ratio === previousRatio) return;
      previousRatio = ratio;
      const { x, y, scale, scene: nextScene } = heroMotionFrame(ratio);

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
    shortViewport.addEventListener("change", requestRender);

    return () => {
      window.removeEventListener("scroll", requestRender);
      window.removeEventListener("resize", requestRender);
      reduceMotion.removeEventListener("change", requestRender);
      shortViewport.removeEventListener("change", requestRender);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section
      className="scroll-world"
      id="como-funciona"
      ref={sectionRef}
      data-scene="0"
      data-motion="animated"
    >
      <div className="scroll-world-sticky" ref={stickyRef}>
        <div className="scroll-world-camera" ref={imageRef}>
          <Image
            src="/images/cobranzaap-world.webp"
            alt="Recorrido ilustrado por la oficina, la ruta, la supervisión y el cierre de cobranza"
            fill
            priority
            unoptimized
            sizes="100vw"
          />
        </div>
        <div className="scroll-world-shade" aria-hidden="true" />
        <div className="scroll-world-heading">
          <span className="eyebrow">Control de cartera hecho en Colombia</span>
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
