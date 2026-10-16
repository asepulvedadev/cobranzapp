const DIRECTORY_PAGE_SIZE = 20;

type DirectorySearchParams = {
  cliente?: string | string[];
  paginaCliente?: string | string[];
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseBorrowerDirectoryQuery(params: DirectorySearchParams) {
  const search = (firstValue(params.cliente) ?? "").trim().slice(0, 80);
  const requestedPage = Number.parseInt(firstValue(params.paginaCliente) ?? "1", 10);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  return { page, search };
}

export function borrowerDirectoryApiPath(tenantId: string, search: string, page: number) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(DIRECTORY_PAGE_SIZE),
  });
  if (search) query.set("q", search);
  return `/v1/tenants/${tenantId}/borrowers?${query}`;
}

export function borrowerDirectoryHref(tenantSlug: string, search = "", page = 1) {
  const query = new URLSearchParams();
  if (search) query.set("cliente", search);
  if (page > 1) query.set("paginaCliente", String(page));
  const suffix = query.size ? `?${query}` : "";
  return `/panel/empresa/${tenantSlug}/clientes${suffix}`;
}
