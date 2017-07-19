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

 /*
  This file is an example implementation for a service worker compatible with
  amp-web-push. This means the service worker accepts window messages (listened
  to via the service worker's 'message' handler), performs some action, and
  replies with a result.

  The service worker listens to postMessage() messages sent from a lightweight
  invisible iframe on the canonical origin. The AMP page sends messages to this
  "helper" iframe, which then forwards the message to the service worker.
  Broadcast replies from the service worker are received by the helper iframe,
  which broadcasts the reply back to the AMP page.
 */

const WorkerMessengerCommand = {
  /*
    Used to request the current subscription state.
   */
  AMP_SUBSCRIPION_STATE: "amp-web-push-subscription-state",
  /*
    Used to request the service worker to subscribe the user to push.
    Notification permissions are already granted at this point.
   */
  AMP_SUBSCRIBE: "amp-web-push-subscribe",
  /*
    Used to unsusbcribe the user from push.
   */
  AMP_UNSUBSCRIBE: "amp-web-push-unsubscribe"
};

/*
  According to
  https://w3c.github.io/ServiceWorker/#run-service-worker-algorithm:

  "user agents are encouraged to show a warning that the event listeners
  must be added on the very first evaluation of the worker script."

  We have to register our event handler statically (not within an
  asynchronous method) so that the browser can optimize not waking up the
  service worker for events that aren't known for sure to be listened for.

  Also see: https://github.com/w3c/ServiceWorker/issues/1156
*/
self.addEventListener('message', event => {
  /*
    Messages sent from amp-web-push have the format:

    - command: A string describing the message topic (e.g.
      'amp-web-push-subscribe')

    - payload: An optional JavaScript object containing extra data relevant to
      the command.
   */
  const { command, payload } = event.data;

  switch (command) {
    case WorkerMessengerCommand.AMP_SUBSCRIPION_STATE:
      onMessageReceived_SubscriptionState(payload);
      break;
    case WorkerMessengerCommand.AMP_SUBSCRIBE:
      onMessageReceived_Subscribe(payload);
      break;
    case WorkerMessengerCommand.AMP_UNSUBSCRIBE:
      onMessageReceived_Unsubscribe(payload);
      break;
  }
});

/*
  Broadcasts a single boolean describing whether the user is subscribed.
 */
async function onMessageReceived_SubscriptionState(payload) {
  const pushSubscription = await self.registration.pushManager.getSubscription();
  if (!pushSubscription) {
    broadcastReply(WorkerMessengerCommand.AMP_SUBSCRIPION_STATE, false);
  } else {
    const permission = await self.registration.pushManager.permissionState(pushSubscription.options);
    const isSubscribed = !!pushSubscription && permission === "granted";
    broadcastReply(WorkerMessengerCommand.AMP_SUBSCRIPION_STATE, isSubscribed);
  }
}
/*
  Subscribes the visitor to push.

  The broadcast value is null (not used in the AMP page).
 */
async function onMessageReceived_Subscribe(payload) {
  const subscription = await self.registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: 'fake-demo-key',
  });
  // IMPLEMENT: Forward the push subscription to your server here
  broadcastReply(WorkerMessengerCommand.AMP_SUBSCRIBE, null);
}


/*
  Unsubscribes the subscriber from push.

  The broadcast value is null (not used in the AMP page).
 */
async function onMessageReceived_Unsubscribe(payload) {
  const subscription = await self.registration.pushManager.getSubscription();
  await subscription.unsubscribe();
  // OPTIONALLY IMPLEMENT: Forward the unsubscription to your server here
  broadcastReply(WorkerMessengerCommand.AMP_UNSUBSCRIBE, null);
}

/*
  Sends a postMessage() to all window frames the service worker controls.
 */
async function broadcastReply(command, payload) {
  const clients = await self.clients.matchAll({});
  for (let client of clients) {
    client.postMessage({
      command: command,
      payload: payload
    });
  }
}