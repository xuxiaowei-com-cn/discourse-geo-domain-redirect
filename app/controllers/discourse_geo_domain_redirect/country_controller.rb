# frozen_string_literal: true

module DiscourseGeoDomainRedirect
  class CountryController < ::ApplicationController
    requires_plugin "discourse-geo-domain-redirect"

    skip_before_action :preload_json, :check_xhr, :redirect_to_login_if_required

    def show
      # The response depends on a request header, so it must never be shared
      # between visitors or cached by a CDN or browser.
      response.headers["Cache-Control"] = "no-store, private"
      vary_header = SiteSetting.geo_domain_redirect_header.to_s.strip
      if DiscourseGeoDomainRedirect::Country.valid_header_name?(vary_header)
        response.headers["Vary"] = vary_header
      end

      render json: { country: DiscourseGeoDomainRedirect::Country.from_request(request) }
    end
  end
end
