import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SecurityActivityList } from "./SecurityActivityList";

describe("SecurityActivityList", () => {
  it("renders account security events in Colombian Spanish", () => {
    const html = renderToStaticMarkup(
      <SecurityActivityList
        activity={[
          {
            id: "f79b5505-44cc-465c-ac4f-4bd60acbdf62",
            action: "auth.password_changed",
            happenedAt: "2026-10-11T20:00:00.000Z",
          },
          {
            id: "a6387c0f-66e7-45fd-8b07-653651744d6e",
            action: "auth.mfa_enabled",
            happenedAt: "2026-10-11T20:05:00.000Z",
          },
        ]}
      />,
    );

    expect(html).toContain("Cambio de contraseña");
    expect(html).toContain("Activación de la verificación en dos pasos");
    expect(html).toContain('dateTime="2026-10-11T20:00:00.000Z"');
  });

  it("explains the empty state", () => {
    expect(renderToStaticMarkup(<SecurityActivityList activity={[]} />)).toContain(
      "Aún no hay actividad registrada.",
    );
  });
});
