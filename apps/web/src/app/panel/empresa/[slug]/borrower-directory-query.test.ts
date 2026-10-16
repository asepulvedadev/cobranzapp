import { describe, expect, it } from "vitest";
import {
  borrowerDirectoryApiPath,
  borrowerDirectoryHref,
  parseBorrowerDirectoryQuery,
} from "./borrower-directory-query";

describe("borrower directory query", () => {
  it("keeps searches inside the customer directory", () => {
    expect(borrowerDirectoryHref("mi-negocio")).toBe("/panel/empresa/mi-negocio/clientes");
    expect(borrowerDirectoryHref("mi-negocio", "Ana Pérez", 2)).toBe(
      "/panel/empresa/mi-negocio/clientes?cliente=Ana+P%C3%A9rez&paginaCliente=2",
    );
  });

  it("normalizes customer filters and rejects invalid pages", () => {
    expect(parseBorrowerDirectoryQuery({ cliente: "  Ana Pérez  ", paginaCliente: "2" })).toEqual({
      search: "Ana Pérez",
      page: 2,
    });
    expect(parseBorrowerDirectoryQuery({ paginaCliente: "hoy" })).toEqual({
      search: "",
      page: 1,
    });
  });

  it("sends the normalized search and page to the borrowers API", () => {
    expect(borrowerDirectoryApiPath("tenant-1", "Ana Pérez", 2)).toBe(
      "/v1/tenants/tenant-1/borrowers?page=2&pageSize=20&q=Ana+P%C3%A9rez",
    );
  });
});
