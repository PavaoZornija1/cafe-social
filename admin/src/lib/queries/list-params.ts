export type AdminVenuesListParams = {
  page: number;
  limit: number;
  search?: string;
  location?: string;
  lockedOnly?: boolean;
  organizationId?: string;
  countries?: string[];
};

export type AdminOrganizationsListParams = {
  page: number;
  limit: number;
  search?: string;
  locationKind?: "" | "SINGLE_LOCATION" | "MULTI_LOCATION";
  billingStatus?: string;
};

export function buildAdminVenuesSearchParams(params: AdminVenuesListParams): string {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("limit", String(params.limit));
  if (params.search) sp.set("search", params.search);
  if (params.location) sp.set("location", params.location);
  if (params.lockedOnly) sp.set("lockedOnly", "true");
  if (params.organizationId) sp.set("organizationId", params.organizationId);
  if (params.countries?.length) sp.set("countries", params.countries.join(","));
  return sp.toString();
}

export function buildAdminOrganizationsSearchParams(params: AdminOrganizationsListParams): string {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("limit", String(params.limit));
  if (params.search) sp.set("search", params.search);
  if (params.locationKind) sp.set("locationKind", params.locationKind);
  if (params.billingStatus) sp.set("billingStatus", params.billingStatus);
  return sp.toString();
}
