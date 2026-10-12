import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActivityFeed, activityActionLabel } from "./ActivityFeed";

describe("ActivityFeed", () => {
  it("explains administrative events in Spanish", () => {
    const html = renderToStaticMarkup(
      <ActivityFeed
        activity={[
          {
            id: "branch-event",
            action: "branch.status_changed",
            actorDisplayName: "Propietaria",
            actorUsername: "propietaria",
            happenedAt: "2026-10-11T12:00:00.000Z",
          },
          {
            id: "team-event",
            action: "team.status_changed",
            actorDisplayName: "Supervisora",
            actorUsername: "supervisora",
            happenedAt: "2026-10-11T12:01:00.000Z",
          },
          {
            id: "capacity-event",
            action: "tenant.membership_capacity_changed",
            actorDisplayName: "Desarrollador",
            actorUsername: "desarrollador",
            happenedAt: "2026-10-11T12:02:00.000Z",
          },
          {
            id: "user-status-event",
            action: "user.status_changed",
            actorDisplayName: "Desarrollador",
            actorUsername: "desarrollador",
            happenedAt: "2026-10-11T12:03:00.000Z",
          },
        ]}
      />,
    );

    expect(html).toContain("Cambió el estado de una sede");
    expect(html).toContain("Cambió el estado de un equipo");
    expect(html).toContain("Actualizó la capacidad de empleados");
    expect(html).toContain("Cambió el acceso de un usuario");
  });

  it("provides readable labels for audit filters", () => {
    expect(activityActionLabel("auth.mfa_enabled")).toBe("Activó la verificación en dos pasos");
    expect(activityActionLabel("custom.event")).toBe("custom.event");
  });
});
