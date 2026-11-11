import { schedule } from "@ember/runloop";
import { ajax } from "discourse/lib/ajax";
import getURL from "discourse/lib/get-url";
import { withPluginApi } from "discourse/lib/plugin-api";
import GeoDomainRedirectModal from "../components/modal/geo-domain-redirect";
import {
  isPromptSuppressed,
  normalizeHost,
  parseSnoozeOptions,
  shouldPrompt,
} from "../lib/geo-domain-redirect";

let hasChecked = false;

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

  ajax(getURL("/geo-domain-redirect/country.json"), {
    dataType: "json",
    cache: false,
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
