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
  {
    slug: "permisos-para-equipos-de-cobranza",
    category: "Equipo",
    title: "Permisos para equipos de cobranza: quién debe ver y hacer qué",
    summary:
      "Una forma práctica de separar las responsabilidades del propietario, supervisor y cobrador sin frenar la operación.",
    publishedAt: "2026-09-20",
    dateLabel: "20 de septiembre de 2026",
    readingTime: "6 min",
    intro:
      "Un cargo no debería abrir toda la información de una empresa. Los permisos útiles combinan el perfil de la persona con el equipo, la ruta y la operación concreta que tiene asignada.",
    sections: [
      {
        title: "Empieza por la responsabilidad, no por la pantalla",
        paragraphs: [
          "Define qué decisión toma cada persona y qué evidencia necesita para hacerlo. El propietario administra la empresa; el supervisor resuelve excepciones; el cobrador ejecuta su jornada.",
          "Dar acceso por comodidad suele terminar en exportaciones innecesarias, cambios sin responsable y datos personales visibles para quien no los necesita.",
        ],
      },
      {
        title: "Combina el rol con el alcance",
        paragraphs: [
          "Dos supervisores pueden tener el mismo rol y equipos distintos. De la misma manera, un cobrador debería consultar únicamente los clientes y gestiones de sus asignaciones vigentes.",
        ],
        bullets: [
          "Empresa y sucursal a la que pertenece.",
          "Equipo o ruta bajo su responsabilidad.",
          "Estado de la operación que intenta modificar.",
          "Acciones sensibles que requieren revisión adicional.",
        ],
      },
      {
        title: "Conserva quién hizo cada cambio",
        paragraphs: [
          "Un permiso evita acciones indebidas; la auditoría explica las acciones permitidas. Ambos controles son necesarios cuando se registran pagos, diferencias o cambios de condiciones.",
        ],
      },
    ],
  },
  {
    slug: "migrar-cartera-desde-excel",
    category: "Cartera",
    title: "Antes de migrar una cartera desde Excel, limpia estas cinco cosas",
    summary:
      "Cómo preparar clientes, obligaciones y saldos para evitar que los errores del archivo entren al nuevo sistema.",
    publishedAt: "2026-09-13",
    dateLabel: "13 de septiembre de 2026",
    readingTime: "7 min",
    intro:
      "Migrar no es copiar columnas. Es decidir cuál dato representa la realidad cuando hay nombres repetidos, pagos sin referencia y saldos que no coinciden entre archivos.",
    sections: [
      {
        title: "Identifica duplicados antes de sumar",
        paragraphs: [
          "Un mismo cliente puede aparecer con abreviaciones, teléfonos distintos o documentos incompletos. Define un identificador confiable y separa los casos dudosos para revisión manual.",
        ],
      },
      {
        title: "Separa clientes, obligaciones y pagos",
        paragraphs: [
          "Una fila que mezcla datos personales, condiciones del crédito y el último abono es fácil de leer, pero difícil de auditar. Cada concepto necesita su propio registro y relación.",
        ],
        bullets: [
          "Datos vigentes de contacto del cliente.",
          "Condiciones originales de cada obligación.",
          "Calendario o cuotas esperadas.",
          "Pagos con fecha, valor y referencia.",
          "Saldo de control para validar el resultado.",
        ],
      },
      {
        title: "Haz una conciliación de entrada",
        paragraphs: [
          "Compara el total de capital, pagos y saldos antes y después de la migración. Si existe una diferencia, no la ocultes con un ajuste global: conserva el caso y su explicación.",
        ],
      },
    ],
  },
  {
    slug: "comprobante-de-pago-en-cobranza",
    category: "Recaudo",
    title: "Qué debe permitir verificar un comprobante de pago",
    summary:
      "Los datos mínimos para que empresa, cobrador y cliente puedan relacionar un abono con la obligación correcta.",
    publishedAt: "2026-09-06",
    dateLabel: "6 de septiembre de 2026",
    readingTime: "5 min",
    intro:
      "Un comprobante no es solo un mensaje de confirmación. Debe ayudar a reconocer la operación sin revelar información innecesaria ni reemplazar la conciliación interna.",
    sections: [
      {
        title: "Relaciona el pago sin exponer de más",
        paragraphs: [
          "Incluye una referencia verificable, la fecha, el valor, el medio registrado y una identificación suficiente de la obligación. Evita mostrar notas internas o datos que el receptor no necesita.",
        ],
      },
      {
        title: "Distingue registro y confirmación",
        paragraphs: [
          "Si el pago todavía requiere revisión, el comprobante debe reflejar ese estado. Presentar como definitivo un movimiento pendiente crea una expectativa difícil de corregir.",
        ],
        bullets: [
          "Referencia única del movimiento.",
          "Fecha y hora del registro.",
          "Valor y medio de pago informado.",
          "Obligación a la que fue asociado.",
          "Estado actual del movimiento.",
        ],
      },
      {
        title: "Permite consultar la misma versión",
        paragraphs: [
          "La empresa y el cliente deberían poder llegar al mismo registro. Si una corrección es necesaria, conserva el historial en lugar de reemplazar silenciosamente el comprobante anterior.",
        ],
      },
    ],
  },
];

export function getBlogPost(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}
