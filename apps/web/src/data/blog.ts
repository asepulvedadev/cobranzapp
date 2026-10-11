export type BlogPost = {
  slug: string;
  category: string;
  title: string;
  summary: string;
  publishedAt: string;
  dateLabel: string;
  readingTime: string;
  intro: string;
  sections: Array<{ title: string; paragraphs: string[]; bullets?: string[] }>;
};

export const blogPosts: BlogPost[] = [
  {
    slug: "organizar-una-ruta-de-cobro",
    category: "Operación",
    title: "Cómo organizar una ruta de cobro sin perder el control del día",
    summary:
      "Una guía práctica para ordenar visitas, registrar novedades y cerrar la jornada con información verificable.",
    publishedAt: "2026-10-08",
    dateLabel: "8 de octubre de 2026",
    readingTime: "6 min",
    intro:
      "Una ruta ordenada no empieza en la calle. Empieza con una cartera segmentada, responsables claros y un cierre que permita explicar cada movimiento.",
    sections: [
      {
        title: "Prioriza con criterios visibles",
        paragraphs: [
          "Separa las obligaciones por vencimiento, zona y compromiso pendiente. La prioridad debe poder explicarse al supervisor y al cliente, no depender de la memoria del cobrador.",
          "Evita mezclar en una misma lista visitas confirmadas, casos en disputa y datos incompletos. Cada grupo necesita una acción distinta.",
        ],
      },
      {
        title: "Entrega una ruta ejecutable",
        paragraphs: [
          "El cobrador necesita ver solo la información necesaria para la jornada: cliente, punto autorizado, obligación relacionada y acción esperada.",
        ],
        bullets: [
          "Orden sugerido y zona de trabajo.",
          "Estado actual de la obligación.",
          "Canal autorizado para comunicarse.",
          "Motivo claro cuando una visita no puede realizarse.",
        ],
      },
      {
        title: "Cierra con evidencia, no con mensajes sueltos",
        paragraphs: [
          "Al finalizar, compara cobros registrados, efectivo entregado, transferencias y novedades. Las diferencias deben quedar asignadas para revisión, con hora y responsable.",
          "Un buen cierre protege al propietario, al cobrador y al cliente con un registro común.",
        ],
      },
    ],
  },
  {
    slug: "controlar-cartera-vencida",
    category: "Cartera",
    title: "Cartera vencida: qué revisar antes de volver a cobrar",
    summary:
      "Cinco datos que ayudan a preparar una gestión de cobro respetuosa y basada en el historial real.",
    publishedAt: "2026-10-03",
    dateLabel: "3 de octubre de 2026",
    readingTime: "5 min",
    intro:
      "Cobrar más veces no siempre significa cobrar mejor. Antes de contactar a un cliente conviene reconstruir qué debía ocurrir, qué ocurrió y qué información falta.",
    sections: [
      {
        title: "Confirma el estado de la obligación",
        paragraphs: [
          "Revisa el plan acordado, los pagos aplicados, los comprobantes y cualquier novedad pendiente de conciliación. Una cifra desactualizada destruye confianza y aumenta el trabajo de soporte.",
        ],
      },
      {
        title: "Distingue atraso de inconsistencia",
        paragraphs: [
          "No todo saldo discutido es mora. Puede existir un pago sin conciliar, una fecha mal registrada o un acuerdo todavía no reflejado. Separa esos casos antes de asignarlos a una ruta.",
        ],
        bullets: [
          "Fecha de la última obligación vencida.",
          "Último pago confirmado y su comprobante.",
          "Promesas de pago vigentes o incumplidas.",
          "Novedades que requieren revisión del supervisor.",
        ],
      },
      {
        title: "Registra el resultado del contacto",
        paragraphs: [
          "Una gestión útil termina con un resultado concreto: pago recibido, compromiso con fecha, dato corregido, caso escalado o contacto no logrado. Ese resultado alimenta la siguiente decisión.",
        ],
      },
    ],
  },
  {
    slug: "conciliacion-diaria-de-cobranza",
    category: "Control",
    title: "Conciliación diaria: cómo saber dónde quedó cada peso",
    summary:
      "Una rutina de cierre para comparar recaudo, medios de pago y entregas sin reconstruir el día desde cero.",
    publishedAt: "2026-09-27",
    dateLabel: "27 de septiembre de 2026",
    readingTime: "7 min",
    intro:
      "La conciliación diaria convierte una lista de pagos en una explicación completa del dinero recaudado. Su objetivo no es solo cuadrar una cifra, sino detectar diferencias a tiempo.",
    sections: [
      {
        title: "Separa registro, pago y entrega",
        paragraphs: [
          "El cobro capturado en campo, el pago aceptado por el negocio y el efectivo entregado son hechos relacionados, pero no idénticos. Cada uno necesita su propia hora, estado y responsable.",
        ],
      },
      {
        title: "Compara por medio de pago",
        paragraphs: [
          "Agrupa efectivo, transferencias y otros medios autorizados. Así puedes contrastar cada subtotal con su evidencia sin esconder una diferencia dentro del total del día.",
        ],
        bullets: [
          "Total registrado por cobrador y ruta.",
          "Pagos anulados o pendientes de revisión.",
          "Efectivo entregado y recibido.",
          "Transferencias con referencia verificable.",
        ],
      },
      {
        title: "Cierra solo cuando la diferencia tenga dueño",
        paragraphs: [
          "Si existe una diferencia, conserva el cierre en revisión y asigna el caso. Marcar todo como terminado sin explicar la novedad solo traslada el problema al día siguiente.",
          "La trazabilidad permite resolver sin borrar el historial ni modificar pagos confirmados a escondidas.",
        ],
      },
    ],
  },
];

export function getBlogPost(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}
