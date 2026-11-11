import { module, test } from "qunit";
import {
  buildCountryEndpoint,
  buildRedirectUrl,
  ignorePrompt,
  isHostAllowed,
  isPromptSuppressed,
  normalizeHost,
  parseAllowedDomains,
  parseSnoozeOptions,
  shouldForceMainDomain,
  shouldPrompt,
  snoozePrompt,
  STORAGE_KEYS,
} from "discourse/plugins/discourse-geo-domain-redirect/discourse/lib/geo-domain-redirect";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function memoryStorage() {
  const data = new Map();

  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
  };
}

module("Unit | Lib | geo-domain-redirect", function () {
  test("normalizeHost normalizes domains", function (assert) {
    assert.strictEqual(
      normalizeHost("https://WWW.Example.com/path?q=1"),
      "www.example.com",
      "removes the scheme, path, and casing"
    );
    assert.strictEqual(
      normalizeHost("//www.example.com/path"),
      "www.example.com",
      "handles protocol-relative values"
    );
    assert.strictEqual(
      normalizeHost("www.example.com:443"),
      "www.example.com",
      "removes the default HTTPS port"
    );
    assert.strictEqual(
      normalizeHost("www.example.com."),
      "www.example.com",
      "removes the trailing dot"
    );
    assert.strictEqual(
      normalizeHost("https://localhost:3000/path"),
      "localhost:3000",
      "keeps a non-default port"
    );
  });

  test("parseSnoozeOptions accepts ordered positive day values", function (assert) {
    assert.deepEqual(
      parseSnoozeOptions("7|1|30|7"),
      [7, 1, 30],
      "preserves the configured order and removes duplicates"
    );
    assert.deepEqual(
      parseSnoozeOptions("1|abc|0|-2|4000|15"),
      [1, 15],
      "drops invalid, non-positive, and oversized values"
    );
    assert.deepEqual(
      parseSnoozeOptions(["3", 14]),
      [3, 14],
      "accepts an array"
    );
    assert.deepEqual(parseSnoozeOptions(""), [], "returns an empty list");
  });

  test("parseAllowedDomains normalizes and preserves wildcards", function (assert) {
    assert.deepEqual(
      parseAllowedDomains(
        " https://WWW.Example.com/path | *.example.com | www.example.com "
      ),
      ["www.example.com", "*.example.com"],
      "normalizes entries and removes duplicates"
    );
    assert.deepEqual(
      parseAllowedDomains(["example.com", "*.example.com"]),
      ["example.com", "*.example.com"],
      "accepts an array"
    );
    assert.deepEqual(parseAllowedDomains(""), [], "returns an empty list");
  });

  test("isHostAllowed supports exact hosts and wildcards", function (assert) {
    const allowed = parseAllowedDomains(
      "example.com|*.example.com|www.foo.test"
    );

    assert.true(isHostAllowed("example.com", allowed), "matches the apex");
    assert.true(
      isHostAllowed("WWW.EXAMPLE.COM", allowed),
      "matches case-insensitively"
    );
    assert.true(
      isHostAllowed("foo.example.com", allowed),
      "matches one subdomain"
    );
    assert.true(
      isHostAllowed("a.b.example.com", allowed),
      "matches nested subdomains"
    );
    assert.true(
      isHostAllowed("www.foo.test", allowed),
      "matches an exact host with a dot"
    );
    assert.false(
      isHostAllowed("example.com.evil.com", allowed),
      "does not match a suffix"
    );
    assert.false(
      isHostAllowed("evil-example.com", allowed),
      "does not match a partial label"
    );
    assert.false(
      isHostAllowed("example.com", parseAllowedDomains("*.example.com")),
      "a wildcard does not include the apex"
    );
    assert.false(isHostAllowed("other.com", allowed), "rejects unlisted hosts");
  });

  test("shouldForceMainDomain redirects only unlisted hosts", function (assert) {
    const allowedDomains = parseAllowedDomains("www.example.com|*.example.com");
    const mainHost = "www.example.com";

    assert.true(
      shouldForceMainDomain({
        currentHost: "evil.com",
        allowedDomains,
        mainHost,
      }),
      "forces an unlisted host"
    );
    assert.false(
      shouldForceMainDomain({
        currentHost: "foo.example.com",
        allowedDomains,
        mainHost,
      }),
      "keeps an allowed subdomain"
    );
    assert.false(
      shouldForceMainDomain({
        currentHost: mainHost,
        allowedDomains,
        mainHost,
      }),
      "never redirects the main host to itself"
    );
    assert.false(
      shouldForceMainDomain({
        currentHost: "evil.com",
        allowedDomains: [],
        mainHost,
      }),
      "does nothing when the allowlist is empty"
    );
    assert.false(
      shouldForceMainDomain({
        currentHost: "evil.com",
        allowedDomains,
        mainHost: "",
      }),
      "does nothing without a main host"
    );
  });

  test("buildCountryEndpoint builds an absolute endpoint", function (assert) {
    assert.strictEqual(
      buildCountryEndpoint("https://www.xuxiaowei.com.cn/"),
      "https://www.xuxiaowei.com.cn/geo-domain-redirect/country.json",
      "uses the configured target domain"
    );
    assert.strictEqual(
      buildCountryEndpoint("www.xuxiaowei.com.cn", "/custom.json"),
      "https://www.xuxiaowei.com.cn/custom.json",
      "supports a custom path"
    );
    assert.strictEqual(
      buildCountryEndpoint(""),
      null,
      "returns null without a target domain"
    );
  });

  test("buildRedirectUrl keeps the current path, query, and hash", function (assert) {
    assert.strictEqual(
      buildRedirectUrl("https://www.xuxiaowei.com.cn/", {
        pathname: "/t/topic/1",
        search: "?q=1",
        hash: "#post-2",
      }),
      "https://www.xuxiaowei.com.cn/t/topic/1?q=1#post-2"
    );
  });

  test("shouldPrompt requires the configured country and a different host", function (assert) {
    const options = {
      countryCode: "CN",
      currentHost: "www.xuxiaowei.com",
      targetHost: "www.xuxiaowei.com.cn",
      storage: memoryStorage(),
    };

    assert.true(
      shouldPrompt({ ...options, country: "CN" }),
      "prompts in China"
    );
    assert.true(
      shouldPrompt({ ...options, country: "cn" }),
      "compares the country case-insensitively"
    );
    assert.false(
      shouldPrompt({ ...options, country: "US" }),
      "does not prompt outside China"
    );
    assert.false(
      shouldPrompt({
        ...options,
        country: "CN",
        currentHost: "www.xuxiaowei.com.cn",
      }),
      "does not prompt on the target host"
    );
    assert.false(
      shouldPrompt({ ...options, country: "CN", countryCode: "" }),
      "does not prompt without a configured country"
    );
  });

  test("snoozePrompt suppresses the prompt until the period expires", function (assert) {
    const storage = memoryStorage();
    const target = "www.xuxiaowei.com.cn";
    const now = Date.UTC(2026, 0, 1);

    assert.false(
      isPromptSuppressed(target, { now, storage }),
      "is not suppressed initially"
    );

    assert.true(snoozePrompt(target, 7, { now, storage }), "stores the snooze");
    assert.true(
      isPromptSuppressed(target, {
        now: now + 6 * DAY_IN_MS,
        storage,
      }),
      "is suppressed during the period"
    );
    assert.false(
      isPromptSuppressed(target, {
        now: now + 8 * DAY_IN_MS,
        storage,
      }),
      "is no longer suppressed after the period"
    );
    assert.false(
      isPromptSuppressed("www.other.example", { now, storage }),
      "does not apply to another target domain"
    );
  });

  test("ignorePrompt suppresses the prompt permanently", function (assert) {
    const storage = memoryStorage();
    const target = "www.xuxiaowei.com.cn";

    assert.true(ignorePrompt(target, { storage }), "stores the opt-out");
    assert.true(
      isPromptSuppressed(target, { now: Date.UTC(2030, 0, 1), storage }),
      "still suppressed in the future"
    );
    assert.false(
      isPromptSuppressed("www.other.example", { storage }),
      "does not apply to another target domain"
    );
    assert.true(
      snoozePrompt(target, 7, { storage }),
      "a snooze can still be stored after opting out"
    );
  });

  test("invalid stored values are ignored", function (assert) {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEYS.ignore, "{not-json");

    assert.false(
      isPromptSuppressed("www.xuxiaowei.com.cn", { storage }),
      "malformed JSON does not suppress the prompt"
    );
  });

  test("shouldPrompt respects a stored preference", function (assert) {
    const storage = memoryStorage();
    const targetHost = "www.xuxiaowei.com.cn";

    ignorePrompt(targetHost, { storage });

    assert.false(
      shouldPrompt({
        country: "CN",
        countryCode: "CN",
        currentHost: "www.xuxiaowei.com",
        targetHost,
        storage,
      }),
      "does not prompt after being ignored"
    );
  });
});
