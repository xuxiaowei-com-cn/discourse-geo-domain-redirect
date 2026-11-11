# frozen_string_literal: true

# name: discourse-geo-domain-redirect
# about: Suggests switching to the configured China domain for visitors whose request header reports a matching country.
# version: 0.1.0
# authors: 徐晓伟
# url: https://cnb.cool/xuxiaowei.com.cn/discourse-geo-domain-redirect

enabled_site_setting :geo_domain_redirect_enabled

register_asset "stylesheets/common/geo-domain-redirect.scss"

module ::DiscourseGeoDomainRedirect
  PLUGIN_NAME = "discourse-geo-domain-redirect"
end

require_relative "lib/discourse_geo_domain_redirect/country"

after_initialize do
  require_relative "app/controllers/discourse_geo_domain_redirect/country_controller"

  Discourse::Application.routes.append do
    get "/geo-domain-redirect/country" => "discourse_geo_domain_redirect/country#show"
  end
end
