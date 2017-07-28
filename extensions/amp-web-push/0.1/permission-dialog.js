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

import {tryDecodeUriComponent, parseQueryString} from '../../../src/url.js';
import {WindowMessenger} from './window-messenger';
import {getMode} from '../../../src/mode';

/**
 * @fileoverview
 * The script for the web push notification permission dialog. This script will
 * eventually live on the publisher's origin. It shows the notification prompt
 * and forwards results to the AMP page.
 */
export class AmpWebPushPermissionDialog {
  constructor(options) {
    // Debug enables verbose logging for this page and the window and worker
    // messengers
    this.debug_ = options && options.debug;

    this.window_ = options.windowContext || window;

    // For communication between the AMP page and this permission dialog
    this.ampMessenger = new WindowMessenger({
      debug: this.debug_,
      windowContext: this.window_,
    });
  }

  /**
   * @return {boolean}
   */
  isCurrentDialogPopup() {
    return !!this.window_.opener &&
      this.window_.opener !== this.window_;
  }

  /**
   * @private
   * @return {!Promise<string>}
   */
  requestNotificationPermission_() {
    return new Promise((resolve, reject) => {
      try {
        this.window_.Notification.requestPermission(permission => resolve(permission));
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Requests notoification permissions and reports the result back to the AMP
   * page.
   *
   * If this dialog was redirected instead of opened as a pop up, the page is
   * redirected back.
   */
  run() {
    if (this.isCurrentDialogPopup()) {
      this.ampMessenger.connect(opener, '*');

      return this.requestNotificationPermission_().then(permission => {
        return this.ampMessenger.send(
            WindowMessenger.Topics.NOTIFICATION_PERMISSION_STATE,
            permission
        );
      }).then(result => {
        const message = result[0];
        if (message && message.closeFrame) {
          this.window_.close();
        }
      });
    } else {
      const winLocation = this.window_.fakeLocation || this.window_.location;
      const queryParams = parseQueryString(winLocation.search);
      if (!queryParams['return']) {
        throw new Error(
          'Expecting return URL query parameter to redirect back.');
      }
      const redirectLocation = tryDecodeUriComponent(queryParams['return']);
      return this.requestNotificationPermission_().then(() => {
        this.redirectToUrl(redirectLocation);
      });
    }
  }

  redirectToUrl(url) {
    this.window_.location.href = url;
  }
}

if (!getMode().test) {
  window.controller = new AmpWebPushPermissionDialog({
    debug: false,
  });
  window.controller.run();
}