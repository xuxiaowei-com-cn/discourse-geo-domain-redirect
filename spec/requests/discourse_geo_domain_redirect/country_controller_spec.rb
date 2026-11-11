# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Geo domain redirect country endpoint", type: :request do
  after do
    SiteSetting.geo_domain_redirect_enabled = true
    SiteSetting.geo_domain_redirect_header = "Ali-IP-Country"
  end

  describe "GET /geo-domain-redirect/country.json" do
    it "returns the country from Ali-IP-Country" do
      get "/geo-domain-redirect/country.json", headers: { "Ali-IP-Country" => "CN" }

      expect(response.status).to eq(200)
      expect(response.parsed_body).to eq("country" => "CN")
      expect(response.headers["Cache-Control"]).to include("no-store")
      expect(response.headers["Vary"]).to include("Ali-IP-Country")
      expect(response.headers["Access-Control-Allow-Origin"]).to eq("*")
    end

    it "allows cross-origin requests from the current site" do
      get "/geo-domain-redirect/country.json",
          headers: {
            "Ali-IP-Country" => "CN",
            "Origin" => "https://www.xuxiaowei.io",
          }

      expect(response.status).to eq(200)
      expect(response.headers["Access-Control-Allow-Origin"]).to eq("*")
    end

    it "normalizes the header value" do
      get "/geo-domain-redirect/country.json", headers: { "Ali-IP-Country" => '"cn"' }

      expect(response.parsed_body["country"]).to eq("CN")
    end

    it "returns null when the header is absent" do
      get "/geo-domain-redirect/country.json"

      expect(response.status).to eq(200)
      expect(response.parsed_body["country"]).to be_nil
    end

    it "uses the configured request header" do
      SiteSetting.geo_domain_redirect_header = "X-Country"

      get "/geo-domain-redirect/country.json", headers: { "X-Country" => "CN" }

      expect(response.parsed_body["country"]).to eq("CN")
      expect(response.headers["Vary"]).to include("X-Country")
    end

    it "returns 404 when the plugin is disabled" do
      SiteSetting.geo_domain_redirect_enabled = false

      get "/geo-domain-redirect/country.json", headers: { "Ali-IP-Country" => "CN" }

      expect(response.status).to eq(404)
    end
  end
end
