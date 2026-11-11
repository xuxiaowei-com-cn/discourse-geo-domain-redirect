# frozen_string_literal: true

require "rails_helper"

RSpec.describe DiscourseGeoDomainRedirect::Country do
  def request_with(headers)
    Struct.new(:headers).new(headers)
  end

  describe ".from_request" do
    it "returns the upper-cased country code" do
      request = request_with("Ali-IP-Country" => "cn")

      expect(described_class.from_request(request, "Ali-IP-Country")).to eq("CN")
    end

    it "accepts the Rack header form" do
      request = request_with("HTTP_ALI_IP_COUNTRY" => "CN")

      expect(described_class.from_request(request, "Ali-IP-Country")).to eq("CN")
    end

    it "matches the header name case-insensitively" do
      request = request_with("ali-ip-country" => "CN")

      expect(described_class.from_request(request, "Ali-IP-Country")).to eq("CN")
    end

    it "keeps the first value of a comma-separated header" do
      request = request_with("Ali-IP-Country" => " CN , US ")

      expect(described_class.from_request(request, "Ali-IP-Country")).to eq("CN")
    end

    it "keeps the first value of an array header" do
      request = request_with("Ali-IP-Country" => %w[CN US])

      expect(described_class.from_request(request, "Ali-IP-Country")).to eq("CN")
    end

    it "removes surrounding quotes" do
      request = request_with("Ali-IP-Country" => '"CN"')

      expect(described_class.from_request(request, "Ali-IP-Country")).to eq("CN")
    end

    it "returns nil when the header is absent" do
      expect(described_class.from_request(request_with({}), "Ali-IP-Country")).to be_nil
    end

    it "returns nil when the header value is blank" do
      request = request_with("Ali-IP-Country" => "  ")

      expect(described_class.from_request(request, "Ali-IP-Country")).to be_nil
    end

    it "returns nil when the header name is blank" do
      request = request_with("Ali-IP-Country" => "CN")

      expect(described_class.from_request(request, " ")).to be_nil
    end

    it "returns nil when the header name is invalid" do
      request = request_with("Ali-IP-Country" => "CN")

      expect(described_class.from_request(request, "Bad Header")).to be_nil
    end
  end
end
