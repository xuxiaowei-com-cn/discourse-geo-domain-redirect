import Component from "@glimmer/component";
import { fn } from "@ember/helper";
import { action } from "@ember/object";
import DButton from "discourse/ui-kit/d-button";
import DModal from "discourse/ui-kit/d-modal";
import { i18n } from "discourse-i18n";
import {
  buildRedirectUrl,
  ignorePrompt,
  parseSnoozeOptions,
  snoozePrompt,
} from "../../lib/geo-domain-redirect";

export default class GeoDomainRedirectModal extends Component {
  get targetHost() {
    return this.args.model.targetHost;
  }

  get snoozeOptions() {
    const options = parseSnoozeOptions(this.args.model.snoozeOptions);
    return options.length > 0 ? options : [7];
  }

  get goLabel() {
    return i18n("geo_domain_redirect.go", { domain: this.targetHost });
  }

  @action
  goToTarget() {
    const url = buildRedirectUrl(this.targetHost);

    this.args.closeModal();

    if (url) {
      window.location.assign(url);
    }
  }

  @action
  snooze(days) {
    snoozePrompt(this.targetHost, days);
    this.args.closeModal();
  }

  @action
  ignore() {
    ignorePrompt(this.targetHost);
    this.args.closeModal();
  }

  <template>
    <DModal
      class="geo-domain-redirect-modal"
      @closeModal={{@closeModal}}
      @title={{i18n "geo_domain_redirect.title"}}
    >
      <:body>
        <p>{{i18n "geo_domain_redirect.description" domain=this.targetHost}}</p>
        <p class="geo-domain-redirect-modal__hint">
          {{i18n "geo_domain_redirect.hint"}}
        </p>
        <div class="geo-domain-redirect-modal__snooze">
          <p class="geo-domain-redirect-modal__snooze-label">
            {{i18n "geo_domain_redirect.snooze_heading"}}
          </p>
          <div class="geo-domain-redirect-modal__snooze-actions">
            {{#each this.snoozeOptions as |days|}}
              <DButton
                class="btn-default"
                @action={{fn this.snooze days}}
                @translatedLabel={{i18n "geo_domain_redirect.snooze" days=days}}
              />
            {{/each}}
          </div>
        </div>
      </:body>
      <:footer>
        <DButton
          class="btn-primary"
          @action={{this.goToTarget}}
          @translatedLabel={{this.goLabel}}
        />
        <DButton
          class="btn-transparent"
          @action={{this.ignore}}
          @label="geo_domain_redirect.ignore"
        />
      </:footer>
    </DModal>
  </template>
}
