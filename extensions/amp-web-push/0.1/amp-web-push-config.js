/**
 * Copyright 2017 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

import {TAG, CONFIG_TAG, SERVICE_TAG, AmpWebPushConfig} from './vars';
import {Layout} from '../../../src/layout';
import {getServiceForDoc} from '../../../src/service';
import {user, dev} from '../../../src/log';
import {parseUrl} from '../../../src/url';
import {scopedQuerySelectorAll} from '../../../src/dom';

/** @enum {string} */
export const WebPushConfigAttributes = {
  HELPER_FRAME_URL: 'helper-iframe-url',
  PERMISSION_DIALOG_URL: 'permission-dialog-url',
  SERVICE_WORKER_URL: 'service-worker-url',
};

/** @enum {string} */
export const WebPushWidgetActions = {
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
};

/**
 * @fileoverview
 * A <amp-web-push-config> element that exposes attributes for publishers to
 * configure the web push service.
 *
 * On buildCallback(), the element starts the web push service.
 *
 * Only a single <amp-web-push-config> is allowed in the document, and it must
 * have the ID "amp-web-push". Subscribe and unsubscribe actions dispatched from
 * various <amp-web-push-widgets> are all processed by <amp-web-push-config>
 * which then forwards the event to the web push service.
 */
export class WebPushConfig extends AMP.BaseElement {

  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);
  }

  /** @override */
  isLayoutSupported(layout) {
    return layout == Layout.NODISPLAY;
  }

  /**
   * Validates that this element instance has an ID attribute of 'amp-web-push'
   * and that there are no other elements of the same tag name.
   */
  validate() {
    this.ensureSpecificElementId_();
    this.ensureUniqueElement_();

    const config = {
      'helper-iframe-url': null,
      'permission-dialog-url': null,
      'service-worker-url': null,
    };

    for (const attribute in WebPushConfigAttributes) {
      const value = WebPushConfigAttributes[attribute];
      user().assert(this.element.getAttribute(value),
          `The ${value} attribute is required for <${CONFIG_TAG}>`);
      config[value] = this.element.getAttribute(value);
    }

    if (!this.isValidHelperOrPermissionDialogUrl_(
        config['helper-iframe-url'])) {
      throw user().createError(`<${CONFIG_TAG}> must have a valid ` +
        'helper-iframe-url attribute. It should begin with ' +
        'the https:// protocol and point to the provided lightweight ' +
        'template page provided for AMP messaging.');
    }

    if (!this.isValidHelperOrPermissionDialogUrl_(
        config['permission-dialog-url'])) {
      throw user().createError(`<${CONFIG_TAG}> must have a valid ` +
        'permission-dialog-url attribute. It should begin with ' +
        'the https:// protocol and point to the provided template page ' +
        'for showing the permission prompt.');
    }

    if (parseUrl(config['service-worker-url']).protocol !== 'https:') {
      throw user().createError(`<${CONFIG_TAG}> must have a valid ` +
        'service-worker-url attribute. It should begin with the ' +
        'https:// protocol and point to the service worker JavaScript file ' +
        'to be installed.');
    }

    if (parseUrl(config['service-worker-url']).origin !==
          parseUrl(config['permission-dialog-url']).origin ||
        parseUrl(config['permission-dialog-url']).origin !==
        parseUrl(config['helper-iframe-url']).origin) {
      throw user().createError(`<${CONFIG_TAG}> URL attributes ` +
        'service-worker-url, permission-dialog-url, and ' +
        'helper-iframe-url must all share the same origin.');
    }
  }

  /**
  * Parses the JSON configuration and returns a JavaScript object.
  * @return {AmpWebPushConfig}
  */
  parseConfig() {
    const config = {};

    for (const attribute in WebPushConfigAttributes) {
      const value = WebPushConfigAttributes[attribute];
      config[value] = this.element.getAttribute(value);
    }

    return config;
  }

  /** @override */
  buildCallback() {
    this.validate();
    const config = this.parseConfig();
    const webPushService = getServiceForDoc(this.getAmpDoc(), SERVICE_TAG);
    webPushService.start(config);

    this.registerAction(WebPushWidgetActions.SUBSCRIBE,
        this.onSubscribe_.bind(this));
    this.registerAction(WebPushWidgetActions.UNSUBSCRIBE,
        this.onUnsubscribe_.bind(this));
  }

  /**
   * Ensures this element is defined with TAG id.
   * @private
   */
  ensureSpecificElementId_() {
    if (this.element.getAttribute('id') !== TAG) {
      throw user().createError(`<${CONFIG_TAG}> must have an id ` +
        'attribute with value \'' + TAG + '\'.');
    }
  }

  /**
   * Ensures there isn't another page element with the same id.
   * @private
   */
  ensureUniqueElement_() {
    if (scopedQuerySelectorAll(
        dev().assertElement(this.win.document.body),
        '#' + TAG).length > 1) {
      throw user().createError(`Only one <${CONFIG_TAG}> element may exist ` +
        'on a page.');
    }
  }

  /** @private */
  onSubscribe_() {
    const webPushService = getServiceForDoc(this.getAmpDoc(), SERVICE_TAG);
    webPushService.subscribe();
  }

  /** @private */
  onUnsubscribe_() {
    const webPushService = getServiceForDoc(this.getAmpDoc(), SERVICE_TAG);
    webPushService.unsubscribe();
  }

  /**
   * @private
   * @param {string} url
   * @return {boolean}
  */
  isValidHelperOrPermissionDialogUrl_(url) {
    try {
      const parsedUrl = parseUrl(url);
      /*
        The helper-iframe-url must be to a specific lightweight page on the user's
        site for handling AMP postMessage calls without loading push
        vendor-specific SDKs or other resources. It should not be the site root.

        The permission-dialog-url can load push vendor-specific SDKs, but it
        should still not be the site root and should be a dedicated page for
        subscribing.
      */
      const isNotRootUrl = parsedUrl.pathname.length > 1;

      /*
        Similar to <amp-form> and <amp-iframe>, the helper and subscribe URLs
        must be HTTPS. This is because most AMP caches serve pages over HTTPS,
        and an HTTP iframe URL would not load due to insecure resources being
        blocked on a secure page.
      */
      const isSecureUrl = (parsedUrl.protocol === 'https:');

      return isSecureUrl && isNotRootUrl;
    } catch (e) {
      return false;
    }
  }
}
