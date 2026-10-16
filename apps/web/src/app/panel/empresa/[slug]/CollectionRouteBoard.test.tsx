import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ReauthenticationProvider } from "../../ReauthenticationProvider";
import { CollectionRouteBoard } from "./CollectionRouteBoard";

describe("CollectionRouteBoard", () => {
  it("shows only the automatic route rule when there are not enough due clients", () => {
    const html = renderToStaticMarkup(
      <ReauthenticationProvider username="cobrador">
        <CollectionRouteBoard
          canReorder
          onChanged={vi.fn()}
          routes={[]}
          tenantId="4cde1a7b-46d3-4405-914f-6e4b9aeed985"
        />
      </ReauthenticationProvider>,
    );

    expect(html).toContain("dos o más clientes con pago para el mismo día");
    expect(html).not.toContain("Nueva ruta");
    expect(html).not.toContain("Agregar parada");
  });
});
