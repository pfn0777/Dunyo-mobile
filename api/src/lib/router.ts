// Minimal internal router: matches "METHOD /path/:param" style routes
// against a request pathname. Pure and dependency-free so it can be unit
// tested without spinning up a server.

export type RouteParams = Record<string, string>;

export interface RouteMatch {
  params: RouteParams;
}

/** Matches a `/segment/:param/segment` pattern against a pathname. Returns
 * the extracted params on match, or null. Both pattern and pathname are
 * matched by segment count and literal segments; `:name` segments capture. */
export function matchPath(pattern: string, pathname: string): RouteMatch | null {
  const patternSegments = pattern.split('/').filter((segment) => segment.length > 0);
  const pathSegments = pathname.split('/').filter((segment) => segment.length > 0);

  if (patternSegments.length !== pathSegments.length) {
    return null;
  }

  const params: RouteParams = {};
  for (let i = 0; i < patternSegments.length; i += 1) {
    const patternSegment = patternSegments[i]!;
    const pathSegment = pathSegments[i]!;
    if (patternSegment.startsWith(':')) {
      if (pathSegment.length === 0) {
        return null;
      }
      params[patternSegment.slice(1)] = decodeURIComponent(pathSegment);
      continue;
    }
    if (patternSegment !== pathSegment) {
      return null;
    }
  }
  return { params };
}

/** Strips a fixed prefix (e.g. "/api") from a pathname, returning the rest
 * with a leading slash, or null if the pathname does not start with it. */
export function stripPrefix(prefix: string, pathname: string): string | null {
  if (pathname === prefix) {
    return '/';
  }
  if (!pathname.startsWith(`${prefix}/`)) {
    return null;
  }
  return pathname.slice(prefix.length) || '/';
}
