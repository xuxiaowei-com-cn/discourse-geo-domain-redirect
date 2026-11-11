# frozen_string_literal: true

module DiscourseGeoDomainRedirect
  # Reads the visitor's country from the request header configured in the site
  # settings. The frontend only receives the country code, never the raw
  # headers.
  module Country
    MAX_LENGTH = 32
    HEADER_NAME_PATTERN = /\A[A-Za-z0-9_-]+\z/

    module_function

    def from_request(request, header_name = SiteSetting.geo_domain_redirect_header)
      name = header_name.to_s.strip
      return if !valid_header_name?(name)

      normalize(header_value(request, name))
    end

    def valid_header_name?(name)
      HEADER_NAME_PATTERN.match?(name.to_s.strip)
    end

    # Ali-IP-Country normally contains a single upper-case code. Be tolerant of
    # quotes, repeated headers, and comma-separated values from an intermediary.
    def normalize(value)
      raw = value.is_a?(Array) ? value.first : value
      code = raw.to_s.split(",").first.to_s.strip
      code = code.delete_prefix('"').delete_suffix('"').strip
      code.upcase[0, MAX_LENGTH].presence
    end

    def header_value(request, name)
      headers = request.headers
      value = headers[name]
      return value unless value.nil?

      # Plain hashes used in tests and some middleware do not normalize header
      # names, so fall back to a case-insensitive Rack-style comparison.
      wanted = normalize_name(name)
      headers.each { |key, header| return header if normalize_name(key) == wanted }

      nil
    end

    def normalize_name(name)
      name.to_s.strip.sub(/\AHTTP_/i, "").upcase.tr("-", "_")
    end
  end
end
