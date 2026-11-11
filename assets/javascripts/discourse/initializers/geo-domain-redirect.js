import { schedule } from "@ember/runloop";
import getURL from "discourse/lib/get-url";
import { withPluginApi } from "discourse/lib/plugin-api";
import GeoDomainRedirectModal from "../components/modal/geo-domain-redirect";
import {
  addCacheBuster,
  buildCountryEndpoint,
  buildRedirectUrl,
  isPromptSuppressed,
  normalizeHost,
  parseAllowedDomains,
  parseSnoozeOptions,
  shouldForceMainDomain,
  shouldPrompt,
} from "../lib/geo-domain-redirect";

let hasChecked = false;

function forceMainDomainIfNeeded(siteSettings) {
  if (!siteSettings.geo_domain_redirect_enabled) {
    return false;
  }

  const currentHost = normalizeHost(window.location.hostname);
  const targetHost = normalizeHost(
    siteSettings.geo_domain_redirect_target_domain
  );
  const configuredMainHost = String(
    siteSettings.geo_domain_redirect_main_domain ?? ""
  ).trim();
  const mainHost = normalizeHost(configuredMainHost || targetHost);
  const allowedDomains = parseAllowedDomains(
    siteSettings.geo_domain_redirect_allowed_domains
  );

  if (!shouldForceMainDomain({ currentHost, allowedDomains, mainHost })) {
    return false;
  }

  const url = buildRedirectUrl(mainHost);

  if (url) {
    window.location.replace(url);
  }

  return true;
}

function checkGeoDomainRedirect(api) {
  const siteSettings = api.container.lookup("service:site-settings");
  if (!siteSettings.geo_domain_redirect_enabled) {
    return;
  }

  const targetHost = normalizeHost(
    siteSettings.geo_domain_redirect_target_domain
  );
  const currentHost = normalizeHost(window.location.hostname);

  if (!targetHost || currentHost === targetHost) {
    return;
  }

  // Avoid a request while the visitor has already opted out.
  if (isPromptSuppressed(targetHost)) {
    return;
  }

  const countryCode = (siteSettings.geo_domain_redirect_country_code || "CN")
    .trim()
    .toUpperCase();
  const snoozeOptions = parseSnoozeOptions(
    siteSettings.geo_domain_redirect_snooze_options
  );
  const countryEndpoint = addCacheBuster(
    (siteSettings.geo_domain_redirect_use_target_domain_for_country &&
      buildCountryEndpoint(targetHost)) ||
      getURL("/geo-domain-redirect/country.json")
  );

  fetch(countryEndpoint, {
    cache: "no-store",
    credentials: "omit",
    headers: { Accept: "application/json" },
    mode: "cors",
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Country endpoint returned ${response.status}`);
      }

      return response.json();
    })
    .then((data) => {
      if (
        !shouldPrompt({
          country: data?.country,
          countryCode,
          currentHost,
          targetHost,
        })
      ) {
        return;
      }

      const modal = api.container.lookup("service:modal");
      return modal.show(GeoDomainRedirectModal, {
        model: { targetHost, snoozeOptions },
      });
    })
    .catch(() => {
      // The prompt is an enhancement: a failed check must never break the page.
    });
}

export default {
  name: "geo-domain-redirect",

  initialize() {
    withPluginApi((api) => {
      const siteSettings = api.container.lookup("service:site-settings");

      if (forceMainDomainIfNeeded(siteSettings)) {
        return;
      }

      api.onPageChange(() => {
        if (hasChecked) {
          return;
        }

        hasChecked = true;
        schedule("afterRender", () => checkGeoDomainRedirect(api));
      });
    });
  },
};
