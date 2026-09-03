const LOCAL_SITE_URL = "http://localhost:3000";

function parseSiteUrl(value: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be a valid absolute URL, such as https://example.com.",
    );
  }
}

export function getSiteUrl(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!configuredUrl) {
    if (process.env.NODE_ENV === "development") {
      return new URL(LOCAL_SITE_URL);
    }

    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be set to the public HTTPS origin for production builds.",
    );
  }

  const siteUrl = parseSiteUrl(configuredUrl);

  if (siteUrl.protocol !== "http:" && siteUrl.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use the http or https protocol.");
  }

  if (process.env.NODE_ENV === "production" && siteUrl.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use https for production builds.");
  }

  if (
    siteUrl.username ||
    siteUrl.password ||
    siteUrl.pathname !== "/" ||
    siteUrl.search ||
    siteUrl.hash
  ) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must contain only the origin, without credentials, a path, query, or fragment.",
    );
  }

  return siteUrl;
}
