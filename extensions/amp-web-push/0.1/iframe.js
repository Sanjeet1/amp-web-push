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

import {setStyle} from '../../../src/style';
import {loadPromise} from '../../../src/event-helper';

/**
 * Wraps the creation of an invisible sandboxed IFrame. Exposes a load() method
 * that resolves a Promise when the iFrame has finished loading.
 */
export default class IFrame {
  constructor(document, url) {
    this.document = document;
    this.url = url;
    this.domElement = null;
    this.loadPromise = null;
  }

  /**
   * Returns a Promise that resolves when the IFrame has finished constructing
   * and loading.
   *
   * @return {!Promise}
   */
  load() {
    this.domElement = this.document.createElement('iframe');
    setStyle(this.domElement, 'display', 'none');
    this.domElement.sandbox = 'allow-same-origin allow-scripts';
    this.domElement.src = this.url;

    this.document.body.appendChild(this.domElement);
    this.loadPromise = loadPromise(this.domElement);
    return this.whenReady();
  }

  whenReady() {
    return this.loadPromise;
  }
}