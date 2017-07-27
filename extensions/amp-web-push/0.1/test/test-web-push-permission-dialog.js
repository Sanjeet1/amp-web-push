/**
 * Copyright 2017 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {getMode} from '../../../../src/mode';
import {WindowMessenger} from '../window-messenger';
import {IFrameHost} from '../iframehost';
import {AmpWebPushPermissionDialog} from '../permission-dialog';
import {WebPushService} from '../web-push-service';
import {WebPushWidgetVisibilities} from '../amp-web-push-widget';
import {TAG, CONFIG_TAG, NotificationPermission} from '../vars';
import {toggleExperiment} from '../../../../src/experiments';
import {WebPushConfigAttributes} from '../amp-web-push-config';
import {
  createIframeWithMessageStub,
  expectPostMessage,
} from '../../../../testing/iframe';
import * as sinon from 'sinon';

const FAKE_IFRAME_URL =
  '//ads.localhost:9876/test/fixtures/served/iframe-stub.html#';

describes.realWin('web-push-permission-dialog', {
  amp: true,
}, env => {
  let win;
  let webPush;
  const webPushConfig = {};
  let iframeWindow = null;
  let sandbox = null;

  function setDefaultConfigParams_() {
    webPushConfig[WebPushConfigAttributes.HELPER_FRAME_URL] =
      FAKE_IFRAME_URL;
    webPushConfig[WebPushConfigAttributes.PERMISSION_DIALOG_URL] =
      FAKE_IFRAME_URL;
    webPushConfig[WebPushConfigAttributes.SERVICE_WORKER_URL] =
      FAKE_IFRAME_URL;
  }

  function setupHelperIframe() {
    webPush.initializeConfig(webPushConfig);
    return webPush.installHelperFrame(webPushConfig).then(() => {
      const helperIframe = getHelperIframe();
      iframeWindow = helperIframe.contentWindow;
      iframeWindow.WindowMessenger = WindowMessenger;
      iframeWindow.AmpWebPushPermissionDialog = AmpWebPushPermissionDialog;
      iframeWindow.controller = new iframeWindow.AmpWebPushPermissionDialog({
        debug: true,
        windowContext: iframeWindow,
      });
      iframeWindow.controller.run(env.win.location.ancestorOrigins[0]);
      return webPush.frameMessenger_.connect(
        iframeWindow,
        '*'
      );
    });
  }

  /**
   * Returns the iframe in this testing AMP iframe that partially matches the
   * URL set in the test config. Partial matches are possible only since query
   * parameters are appended to the iframe URL.
   */
  function getHelperIframe() {
    return env.win.document.querySelector('iframe');
  }

  beforeEach(() => {
    win = env.win;
    setDefaultConfigParams_();
    toggleExperiment(env.win, TAG, true);
    webPush = new WebPushService(env.ampdoc);
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    toggleExperiment(env.win, TAG, false);
    sandbox.restore();
  });

  it('should create helper iframe on document', () => {
    webPush.initializeConfig(webPushConfig);
    return webPush.installHelperFrame(webPushConfig).then(() => {
      expect(getHelperIframe()).to.not.be.null;
    });
  });

  it('should receive real reply from helper iframe for permission status query', () => {
    return setupHelperIframe().then(() => {
      return webPush.queryNotificationPermission();
    }).then(permission => {
      expect(permission).to.eq(NotificationPermission.DEFAULT);
    });
  });
});

describes.realWin('web-push-service widget visibilities', {
  amp: true,
}, env => {
  let win;
  let webPush;
  const webPushConfig = {};
  let iframeWindow = null;
  let sandbox = null;

  function setDefaultConfigParams_() {
    webPushConfig[WebPushConfigAttributes.HELPER_FRAME_URL] =
      FAKE_IFRAME_URL;
    webPushConfig[WebPushConfigAttributes.PERMISSION_DIALOG_URL] =
      FAKE_IFRAME_URL;
    webPushConfig[WebPushConfigAttributes.SERVICE_WORKER_URL] =
      FAKE_IFRAME_URL;
  }

  function setupHelperIframe() {
    webPush.initializeConfig(webPushConfig);
    return webPush.installHelperFrame(webPushConfig).then(() => {
      const helperIframe = getHelperIframe();
      iframeWindow = helperIframe.contentWindow;
      iframeWindow.WindowMessenger = WindowMessenger;
      iframeWindow.AmpWebPushHelperFrame = AmpWebPushHelperFrame;
      iframeWindow.controller = new iframeWindow.AmpWebPushHelperFrame({
        debug: true,
        windowContext: iframeWindow,
      });
      iframeWindow.controller.run(env.win.location.ancestorOrigins[0]);
      return webPush.frameMessenger_.connect(
        iframeWindow,
        '*'
      );
    });
  }

  /**
   * Returns the iframe in this testing AMP iframe that partially matches the
   * URL set in the test config. Partial matches are possible only since query
   * parameters are appended to the iframe URL.
   */
  function getHelperIframe() {
    return env.win.document.querySelector('iframe');
  }

  beforeEach(() => {
    win = env.win;
    setDefaultConfigParams_();
    toggleExperiment(env.win, TAG, true);
    webPush = new WebPushService(env.ampdoc);
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    toggleExperiment(env.win, TAG, false);
    sandbox.restore();
  });

  it('should show blocked widget if permission status query returns blocked', () => {
    let setWidgetVisibilitiesMock = null;
    let spy1 = null;

    return setupHelperIframe().then(() => {
      spy = sandbox.spy(webPush, "setWidgetVisibilities");

      const queryNotificationPermissionStub = sandbox.stub(webPush, 'queryNotificationPermission', () => Promise.resolve(NotificationPermission.DENIED));

      // We've mocked default notification permissions
      return webPush.updateWidgetVisibilities();
    }).then(() => {
      expect(spy.withArgs(WebPushWidgetVisibilities.UNSUBSCRIBED, false).calledOnce).to.eq(true);
      expect(spy.withArgs(WebPushWidgetVisibilities.SUBSCRIBED, false).calledOnce).to.eq(true);
      expect(spy.withArgs(WebPushWidgetVisibilities.BLOCKED, true).calledOnce).to.eq(true);
    });
  });

  it('should show unsubscription widget if reachable SW returns subscribed', () => {
    let spy = null;

    return setupHelperIframe().then(() => {
      spy = sandbox.spy(webPush, "setWidgetVisibilities");

      sandbox.stub(webPush, 'querySubscriptionStateRemotely', () => Promise.resolve(true));
      sandbox.stub(webPush, 'isServiceWorkerActivated', () => Promise.resolve(true));
      sandbox.stub(webPush, 'queryNotificationPermission', () => Promise.resolve(NotificationPermission.DEFAULT));

      // We've mocked default notification permissions
      return webPush.updateWidgetVisibilities();
    }).then(() => {
      expect(spy.withArgs(WebPushWidgetVisibilities.UNSUBSCRIBED, false).calledOnce).to.eq(true);
      expect(spy.withArgs(WebPushWidgetVisibilities.SUBSCRIBED, true).calledOnce).to.eq(true);
      expect(spy.withArgs(WebPushWidgetVisibilities.BLOCKED, false).calledOnce).to.eq(true);
    });
  });

  it('should show subscription widget if permission status query returns default', () => {
    let spy = null;

    return setupHelperIframe().then(() => {
      spy = sandbox.spy(webPush, "setWidgetVisibilities");

      sandbox.stub(webPush, 'isServiceWorkerActivated', () => Promise.resolve(false));
      sandbox.stub(webPush, 'queryNotificationPermission', () => Promise.resolve(NotificationPermission.DEFAULT));

      // We've mocked default notification permissions
      return webPush.updateWidgetVisibilities();
    }).then(() => {
      expect(spy.withArgs(WebPushWidgetVisibilities.UNSUBSCRIBED, true).calledOnce).to.eq(true);
      expect(spy.withArgs(WebPushWidgetVisibilities.SUBSCRIBED, false).calledOnce).to.eq(true);
      expect(spy.withArgs(WebPushWidgetVisibilities.BLOCKED, false).calledOnce).to.eq(true);
    });
  });

  it('should show subscription widget if reachable SW returns unsubscribed', () => {
    let spy = null;

    return setupHelperIframe().then(() => {
      spy = sandbox.spy(webPush, "setWidgetVisibilities");

      sandbox.stub(webPush, 'querySubscriptionStateRemotely', () => Promise.resolve(false));
      sandbox.stub(webPush, 'isServiceWorkerActivated', () => Promise.resolve(true));
      sandbox.stub(webPush, 'queryNotificationPermission', () => Promise.resolve(NotificationPermission.DEFAULT));

      // We've mocked default notification permissions
      return webPush.updateWidgetVisibilities();
    }).then(() => {
      expect(spy.withArgs(WebPushWidgetVisibilities.UNSUBSCRIBED, true).calledOnce).to.eq(true);
      expect(spy.withArgs(WebPushWidgetVisibilities.SUBSCRIBED, false).calledOnce).to.eq(true);
      expect(spy.withArgs(WebPushWidgetVisibilities.BLOCKED, false).calledOnce).to.eq(true);
    });
  });

  it('should forward amp-web-push-subscription-state message to service worker if reachable', done => {
    let iframeWindowControllerMock = null;

    return setupHelperIframe().then(() => {
      sandbox.stub(webPush, 'isServiceWorkerActivated', () => Promise.resolve(true));
      sandbox.stub(webPush, 'queryNotificationPermission', () => Promise.resolve(NotificationPermission.GRANTED));

      iframeWindowControllerMock = sandbox.mock(iframeWindow.controller);
      iframeWindowControllerMock.expects('waitUntilWorkerControlsPage')
        .returns(Promise.resolve(true));
      sandbox.stub(iframeWindow.controller, 'messageServiceWorker', (message) => {
        if (message.topic === 'amp-web-push-subscription-state') {
          done();
        }
      });
      return webPush.updateWidgetVisibilities();
    });
  });
});

describes.realWin('web-push-service subscribing', {
  amp: true,
}, env => {
  let win;
  let webPush;
  const webPushConfig = {};
  let iframeWindow = null;
  let sandbox = null;

  function setDefaultConfigParams_() {
    webPushConfig[WebPushConfigAttributes.HELPER_FRAME_URL] =
      FAKE_IFRAME_URL;
    webPushConfig[WebPushConfigAttributes.PERMISSION_DIALOG_URL] =
      FAKE_IFRAME_URL;
    webPushConfig[WebPushConfigAttributes.SERVICE_WORKER_URL] =
      FAKE_IFRAME_URL;
  }

  function setupHelperIframe() {
    webPush.initializeConfig(webPushConfig);
    return webPush.installHelperFrame(webPushConfig).then(() => {
      const helperIframe = getHelperIframe();
      iframeWindow = helperIframe.contentWindow;
      iframeWindow.WindowMessenger = WindowMessenger;
      iframeWindow.AmpWebPushHelperFrame = AmpWebPushHelperFrame;
      iframeWindow.controller = new iframeWindow.AmpWebPushHelperFrame({
        debug: true,
        windowContext: iframeWindow,
      });
      iframeWindow.controller.run(env.win.location.ancestorOrigins[0]);
      return webPush.frameMessenger_.connect(
        iframeWindow,
        '*'
      );
    });
  }

  /**
   * Returns the iframe in this testing AMP iframe that partially matches the
   * URL set in the test config. Partial matches are possible only since query
   * parameters are appended to the iframe URL.
   */
  function getHelperIframe() {
    return env.win.document.querySelector('iframe');
  }

  beforeEach(() => {
    win = env.win;
    setDefaultConfigParams_();
    toggleExperiment(env.win, TAG, true);
    webPush = new WebPushService(env.ampdoc);
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    toggleExperiment(env.win, TAG, false);
    sandbox.restore();
  });

  it('should register service worker', () => {
    let helperFrameSwMessageMock = null;

    return setupHelperIframe().then(() => {
      helperFrameSwMessageMock = sandbox.mock(iframeWindow.navigator.serviceWorker);
      helperFrameSwMessageMock.expects('register')
        .once()
        .withArgs(webPushConfig[WebPushConfigAttributes.SERVICE_WORKER_URL], {
          scope: '/'
        })
        .returns(Promise.resolve(true));

      return webPush.registerServiceWorker();
    }).then(() => {
      helperFrameSwMessageMock.verify();
    });
  });

  it('should forward amp-web-push-subscribe message to service worker', done => {
    let iframeWindowControllerMock = null;

    return setupHelperIframe().then(() => {
      iframeWindowControllerMock = sandbox.mock(iframeWindow.controller);
      iframeWindowControllerMock.expects('waitUntilWorkerControlsPage')
        .returns(Promise.resolve(true));
      sandbox.stub(iframeWindow.controller, 'messageServiceWorker', (message) => {
        if (message.topic === 'amp-web-push-subscribe') {
          done();
        }
      });
      webPush.subscribeForPushRemotely();
    });
  });

  it('should try opening popup as a window and then as a redirect', () => {
    let openWindowMock = null;

    return setupHelperIframe().then(() => {
      openWindowMock = sandbox.mock(win);
      const returningPopupUrl =
        win.location.href +
        '?' +
        WebPushService.PERMISSION_POPUP_URL_FRAGMENT;
      openWindowMock.expects('open')
        .withArgs(
          webPushConfig['permission-dialog-url'] +
          `?return=${encodeURIComponent(returningPopupUrl)}`, '_blank')
        .onFirstCall()
        .returns();
      openWindowMock.expects('open')
        .withArgs(
          webPushConfig['permission-dialog-url'] +
          `?return=${encodeURIComponent(returningPopupUrl)}`, '_top')
        .onSecondCall()
        .returns();

      webPush.openPopupOrRedirect();
      openWindowMock.verify();
    });
  });

  it('should detect continuing subscription from permission dialog redirect', () => {
    env.ampdoc.win.testLocation.href =
      'https://a.com/?' + WebPushService.PERMISSION_POPUP_URL_FRAGMENT;
    expect(webPush.isContinuingSubscriptionFromRedirect()).to.eq(true);
  });

  it('should remove url fragment if continuing subscription', () => {
    webPush.initializeConfig(webPushConfig);

    const urlWithSingleParam =
      'https://a.com/?' + WebPushService.PERMISSION_POPUP_URL_FRAGMENT;
    const newUrlWithSingleParam =
      webPush.removePermissionPopupUrlFragmentFromUrl(urlWithSingleParam);
    expect(newUrlWithSingleParam).to.eq('https://a.com/');

    const urlWithMultipleParams =
      'https://a.com/?a=1&' + WebPushService.PERMISSION_POPUP_URL_FRAGMENT +
      '&b=2';
    const newUrlWithMultipleParams =
      webPush.removePermissionPopupUrlFragmentFromUrl(urlWithMultipleParams);
    expect(newUrlWithMultipleParams).to.eq('https://a.com/?a=1&b=2');
  });
});

describes.realWin('web-push-service unsubscribing', {
  amp: true,
}, env => {
  let win;
  let webPush;
  const webPushConfig = {};
  let iframeWindow = null;
  let sandbox = null;

  function setDefaultConfigParams_() {
    webPushConfig[WebPushConfigAttributes.HELPER_FRAME_URL] =
      FAKE_IFRAME_URL;
    webPushConfig[WebPushConfigAttributes.PERMISSION_DIALOG_URL] =
      FAKE_IFRAME_URL;
    webPushConfig[WebPushConfigAttributes.SERVICE_WORKER_URL] =
      FAKE_IFRAME_URL;
  }

  function setupHelperIframe() {
    webPush.initializeConfig(webPushConfig);
    return webPush.installHelperFrame(webPushConfig).then(() => {
      const helperIframe = getHelperIframe();
      iframeWindow = helperIframe.contentWindow;
      iframeWindow.WindowMessenger = WindowMessenger;
      iframeWindow.AmpWebPushHelperFrame = AmpWebPushHelperFrame;
      iframeWindow.controller = new iframeWindow.AmpWebPushHelperFrame({
        debug: true,
        windowContext: iframeWindow,
      });
      iframeWindow.controller.run(env.win.location.ancestorOrigins[0]);
      return webPush.frameMessenger_.connect(
        iframeWindow,
        '*'
      );
    });
  }

  /**
   * Returns the iframe in this testing AMP iframe that partially matches the
   * URL set in the test config. Partial matches are possible only since query
   * parameters are appended to the iframe URL.
   */
  function getHelperIframe() {
    return env.win.document.querySelector('iframe');
  }

  beforeEach(() => {
    win = env.win;
    setDefaultConfigParams_();
    toggleExperiment(env.win, TAG, true);
    webPush = new WebPushService(env.ampdoc);
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    toggleExperiment(env.win, TAG, false);
    sandbox.restore();
  });

  it('should forward amp-web-push-unsubscribe message to service worker', done => {
    let iframeWindowControllerMock = null;

    return setupHelperIframe().then(() => {
      iframeWindowControllerMock = sandbox.mock(iframeWindow.controller);
      iframeWindowControllerMock.expects('waitUntilWorkerControlsPage')
        .returns(Promise.resolve(true));
      sandbox.stub(iframeWindow.controller, 'messageServiceWorker', (message) => {
        if (message.topic === 'amp-web-push-unsubscribe') {
          done();
        }
      });
      webPush.unsubscribeFromPushRemotely();
    });
  });

  it('should update widget visibilities after unsubscribing', () => {
    let unsubscribeStub = null;
    let updateWidgetStub = null;

    return setupHelperIframe().then(() => {
      unsubscribeStub = sandbox.stub(webPush, "unsubscribeFromPushRemotely", () => Promise.resolve());
      updateWidgetStub = sandbox.stub(webPush, "updateWidgetVisibilities", () => Promise.resolve());

      // We've mocked default notification permissions
      return webPush.unsubscribe();
    }).then(() => {
      expect(unsubscribeStub.calledOnce).to.eq(true);
      expect(updateWidgetStub.calledOnce).to.eq(true);
    });
  });
});