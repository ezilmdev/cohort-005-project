# Third-party notification services for Cadence

Research for issue #5 (part of #1). This file records facts only. It does not recommend a service. Gathered 2026-11-10 from official docs, pricing pages, and the published npm packages. Prices and limits change, so check the linked page before relying on a number.

Cadence context: React Router `8.3.0` with React 19 (see `package.json`; the ticket says "React Router 7"). Email already goes through Postmark in `app/lib/mailer.server.ts`. That code always sends with `MessageStream: "outbound"` (the default transactional stream) and writes to `.outbox/` when `POSTMARK_SERVER_TOKEN` is not set.

## Postmark: transactional vs broadcast streams

These facts hold whichever service sends the email.

- Transactional streams are for "one-to-one emails triggered by a user action". Broadcast streams are for one-to-many sends such as "policy updates, product announcements, and newsletters" and run on separate infrastructure. [Postmark: message streams](https://postmarkapp.com/support/article/1207-how-to-create-and-send-through-message-streams)
- "Postmark supports sending of bulk messages when they're sent through a Broadcast Message Stream." A bulk email is "the same message content sent to multiple recipients at once". "Transactional and broadcast messages do not mix in Postmark." [Postmark: can I send bulk emails?](https://postmarkapp.com/support/article/can-i-send-bulk-emails)
- Postmark asks that "all bulk messaging be sent through a Broadcast Message Stream". It warns that bulk mail sent through a transactional stream "can cause issues with deliverability and harm to our transactional IPs". "All emails that are sent through a Broadcast Message Stream are required to have an unsubscribe link", and Postmark adds one by default. [Postmark office hours recap](https://postmarkapp.com/blog/postmark-office-hours)
- None of these pages names "a notification about a new course sent to every Student who opted in" as a case. Such a send is the same content to many recipients, so it fits Postmark's definition of bulk. That is an inference from the definitions above, not a quoted rule. Postmark tells customers who are unsure to contact them.
- The API picks the stream through the `MessageStream` field. If the field is left out, Postmark uses the server's default transactional stream. [Postmark: message streams](https://postmarkapp.com/support/article/1207-how-to-create-and-send-through-message-streams)
- Over SMTP, you pick the stream with an `X-PM-Message-Stream` header or with an SMTP token tied to that stream. [Postmark: broadcast streams via SMTP](https://postmarkapp.com/blog/expanded-support-for-using-broadcast-message-streams-via-smtp)

## Short comparison

| | Knock | Novu | Courier | MagicBell | SuprSend |
|---|---|---|---|---|---|
| React inbox | `@knocklabs/react` 0.15.1 | `@novu/react` 3.19.2 (`<Inbox />`) | `@trycourier/courier-react` 9.3.5 | `@magicbell/react` 1.14.0 | `@suprsend/react` 1.5.0 |
| Node SDK | `@knocklabs/node` 1.41.1 | `@novu/api` 3.19.1 (`@novu/node` is deprecated) | `@trycourier/courier` 10.0.0 | `magicbell-js` 1.8.0 | `@suprsend/node-sdk` 1.15.1 |
| Postmark provider | Yes. Stream set through payload override `{"MessageStream": ...}` | Yes. No stream setting documented; generic `_passthrough` overrides exist | Yes. `config.MessageStream` override | Not in the docs' provider list (SES, Mailgun, SendGrid, SMTP, Ping Email); generic SMTP channel | Yes. No stream field in the form |
| Topic fan-out | Objects + subscriptions | Topics (up to 100,000 subscribers per topic) | Lists (subscribe, send to list or pattern) | Topic subscriptions; broadcasts take 1–1,000 recipients | Lists + broadcasts; objects + subscriptions |
| Free tier | 10,000 messages/mo | 10,000 workflow runs/mo, 5 workflows | 10,000 sends/mo | 1,000 deliveries/mo | 10,000 notifications/mo |
| First paid tier | Starter $250/mo (50k, then $0.005) | Pro from $30/mo (30k+, $1.20 per 1k extra) | Business $0.005 per send | Startup $249/mo (50k, then $0.0025) | Essentials $100/mo (50k); preferences need Business $250/mo |
| Self-hosting | Not offered (Enterprise "dedicated infrastructure") | Open-source core (MIT) plus an Enterprise self-hosted option | Not mentioned | Not mentioned | Enterprise only (self-hosted or BYOC beta) |

Sources for the table: pricing pages for [Knock](https://knock.app/pricing), [Novu](https://novu.co/pricing), [Courier](https://www.courier.com/pricing), [MagicBell](https://www.magicbell.com/pricing), and [SuprSend](https://www.suprsend.com/pricing). Postmark integration docs for [Knock](https://docs.knock.app/integrations/email/postmark), [Novu](https://docs.novu.co/platform/integrations/email/postmark) (plus [trigger overrides](https://docs.novu.co/platform/integrations/trigger-overrides)), [Courier](https://www.courier.com/docs/external-integrations/email/postmark), and [SuprSend](https://docs.suprsend.com/docs/postmark), and the MagicBell [integrations list](https://www.magicbell.com/docs/integrations). Fan-out docs: [Novu topics](https://docs.novu.co/platform/concepts/topics), Courier [list subscriptions API](https://www.courier.com/docs/api-reference/lists/subscribe-users-to-a-list), [MagicBell broadcasts](https://www.magicbell.com/docs/primitive/broadcast), and [SuprSend lists](https://docs.suprsend.com/docs/lists). Self-hosting: the [Novu repo](https://github.com/novuhq/novu) and [Novu self-hosting](https://docs.novu.co/community/self-hosting-novu/overview). Package versions come from `npm view` on 2026-11-10.

Other notes from the same sources:

- **Novu**: the Free plan keeps the activity feed for 24 hours. Self-hosting needs MongoDB, Redis and S3-compatible storage, and "some features exclusive to Novu's cloud-managed solution will not be available" when self-hosted. The `enterprise/` folder is under a commercial licence.
- **Courier**: the pricing page does not say which plans include Inbox or preferences. Inbox auth uses a backend-signed JWT.
- **MagicBell**: deliveries are counted per channel.
- **SuprSend**: email needs your own provider account. Going over the free limit does not stop sending; SuprSend sends an alert instead.

## Knock in depth

### Pricing and free tier

- **Free, $0/mo**: up to 10,000 messages sent. Unlimited stored profiles, workflows, broadcasts, channels, team members and environments. Preferences, in-app feeds, batching and the Feed API are available on every plan. Knock branding cannot be removed on Free. [Knock pricing](https://knock.app/pricing)
- **Starter, $250/mo**: 50,000 messages, then $0.005 each. Removes the branding. **Enterprise**: custom pricing, with optional billing per notified user. [Knock pricing](https://knock.app/pricing)
- **What counts as a message**: "A message is counted each time a notification is successfully delivered to a single user on a single channel." So one workflow that sends both email and in-app to one Student counts as 2. Usage counts in every environment, development included. Sandboxed messages "do not count toward usage". [Knock plans and usage](https://docs.knock.app/manage-your-account/knock-plans)
- **Self-hosting**: the pricing page does not mention it. Enterprise lists "dedicated infrastructure" as "Contact us". [Knock pricing](https://knock.app/pricing)

### Node SDK and workflow trigger

- Install with `npm install @knocklabs/node` (v1.41.1, Apache-2.0, "The official TypeScript library for the Knock API"). The trigger signature is `client.workflows.trigger(key, { recipients, actor, data, tenant, cancellation_key, settings })`. The SDK's own example passes `settings: { sandbox_mode: true, skip_delay: true }`. Source: `resources/workflows.d.ts` in the published package.
- One trigger call takes "up to 1000 recipients at a time". For larger groups Knock points to subscriptions. `data` can be up to 10MB. An optional `Idempotency-Key` header makes retries safe for 24 hours. There is no bulk trigger, and you cannot yet trigger a workflow for an audience through the API. [Trigger via API](https://docs.knock.app/send-notifications/triggering-workflows/api)
- "A workflow run is *always* executed against a single recipient." [Workflows](https://docs.knock.app/concepts/workflows)
- Every endpoint is rate limited (tiers range from 1 to 1,000 req/s) and over-limit calls return `429`. With an API key, limits apply per environment. [Rate limits](https://docs.knock.app/api-reference/overview/rate-limits)

### Objects and Subscriptions ("notify me when a course is published")

- An Object models an entity such as a course or a topic. A Subscription links a recipient to an Object. When you trigger a workflow with the Object as recipient (`recipients: [{ collection, id }]`), Knock runs it for the Object and for every subscriber, and removes duplicate recipients. [Subscriptions](https://docs.knock.app/concepts/subscriptions)
- Calls: `knock.objects.addSubscriptions(collection, id, { recipients, properties })`, `deleteSubscriptions`, `listSubscriptions`, and `users.getSubscriptions`. The published SDK also has `client.objects.bulk.addSubscriptions(collection, ...)`. [Subscriptions](https://docs.knock.app/concepts/subscriptions); `resources/objects/*.d.ts` in `@knocklabs/node`.
- Limits: you can add or remove up to 100 recipients per call. The docs give no upper bound on subscribers per Object. Subscription hierarchies can be at most 2 levels deep. Subscribers cannot be filtered out of a fan-out. The actor is always excluded. In the dashboard you can view subscriptions but not manage them. [Subscriptions](https://docs.knock.app/concepts/subscriptions)
- Broadcasts are a separate feature. They are one-time sends to an audience, all users, or a CSV upload. They "can only be sent to a set of users, not objects" and cannot be called through the API. [Broadcasts](https://docs.knock.app/concepts/broadcasts)

### Preferences

- Each user has a `PreferenceSet` with keys `workflows`, `categories`, `channel_types` (for example `email`), and `channels` (a specific channel by UUID). Values are booleans and can carry conditions. The `default` set holds `commercial_subscribed`. [Preferences overview](https://docs.knock.app/preferences/overview)
- Evaluation: anything not set counts as `true`. A message sends only if every applicable preference is `true`. A `false` category blocks the message even if the channel is `true`. Channel settings override channel-type settings. The merge order runs from the recipient's own set, through the tenant default, to the environment default. [Preferences overview](https://docs.knock.app/preferences/overview)
- Writes: `client.users.setPreferences(userId, 'default', {...})` replaces the whole set unless the payload includes `__persistence_strategy__: "merge"`. You can also pass inline `preferences` on a trigger, and `users.bulk.setPreferences` updates up to 1,000 users. Knock also offers a hosted, no-code preference center reached by a signed URL; it covers only the `default` set. [Preferences overview](https://docs.knock.app/preferences/overview)
- Objects can have their own preferences too: `client.objects.setPreferences(collection, id, prefSetId, ...)`. Source: the `@knocklabs/node` types.

### React in-app feed (`@knocklabs/react`) and React Router SSR

- Components: `KnockProvider` (props `apiKey`, `user`, optional `userToken`), `KnockFeedProvider` (`feedId`), `NotificationIconButton`, `NotificationFeedPopover`, and `NotificationFeed`. You import the styles from `@knocklabs/react/dist/index.css`. The library is built on `@knocklabs/client`. [React feed](https://docs.knock.app/in-app-ui/react/feed), [React SDK overview](https://docs.knock.app/in-app-ui/react/sdk/overview)
- Package metadata (v0.15.1): peer dependencies are `react`/`react-dom` `^17 || ^18 || ^19`. `next` and `@tanstack/react-router` are optional peers. There are subpath exports `./next` and `./tanstack`, but each only exports `KnockGuideLocationSensor`, which belongs to the Guides product. There is no React Router-specific entry point. The ESM bundle starts with `"use client"`.
- **The Knock docs say nothing about SSR or React Router.** A local smoke test (scratch only, not committed) ran `renderToString` on `KnockProvider > KnockFeedProvider > NotificationIconButton + NotificationFeed` under Node 26 with React 19. It rendered HTML without throwing. That test did not cover hydration, the real-time socket, or a React Router build. A prototype in the app would answer those.
- Security: by default, "Knock feeds are accessible to anyone who has the feed ID". In production you turn on enhanced security mode. The server then signs an RS256 JWT (`sub` = user id) with `signUserToken` from `@knocklabs/node/lib/tokenSigner` (default expiry 3600s), and the client passes it as `userToken`. [Security and authentication](https://docs.knock.app/in-app-ui/security-and-authentication)

### Email channel via Postmark

- You set up a Postmark channel per environment. Settings: Postmark server **API key**, **From email address**, an incoming webhook for delivery status, and under Advanced: **Sandbox mode**, tracking, CSS inlining, and **Payload overrides**. [Knock + Postmark](https://docs.knock.app/integrations/email/postmark)
- Knock has no dedicated stream setting. By default Postmark uses the `outbound` transactional stream. To send through a broadcast stream, add a payload override such as `{"MessageStream": "broadcasts"}`. [Knock + Postmark](https://docs.knock.app/integrations/email/postmark)
- For marketing broadcasts, Knock recommends "a dedicated email channel that is separate from your transactional email channel". [Broadcasts](https://docs.knock.app/concepts/broadcasts) Payload overrides are set on each channel, so one way to split the streams is two Postmark channels, one transactional and one with the broadcast override. That combination is an inference; Knock does not document it as a pattern.
- If a workflow is marked **Commercial**, Knock adds "required unsubscribe headers to all emails sent through that workflow". Clicking unsubscribe sets `commercial_subscribed: false` on the user's `default` set. That page does not mention Postmark. [Commercial unsubscribe](https://docs.knock.app/preferences/commercial-unsubscribe) This is separate from the unsubscribe link Postmark adds on broadcast streams.

### Development, testing, not sending

- Each environment (Development, Production, and others) has its own data, API keys and channel credentials. Content is built in Development and promoted to Production. [Environments](https://docs.knock.app/concepts/environments)
- **Sandbox mode** generates and previews messages without passing them to the provider. You can turn it on in three places: per channel per environment, in the test runner (this overrides channel settings), or per trigger with `settings.sandbox_mode`. Sandboxed messages show the status "Not sent" and do not count toward usage. When sandbox mode is on, channel conditions are not evaluated. [Testing workflows](https://docs.knock.app/send-notifications/testing-workflows), [Plans and usage](https://docs.knock.app/manage-your-account/knock-plans)
- In-app (and guides) **do not support sandbox mode**. For in-app messages outside production, Knock suggests channel conditions, but those messages still count toward usage. [Plans and usage](https://docs.knock.app/manage-your-account/knock-plans)
- There is a built-in "Knock (testing only)" email channel. It can only send to members of your Knock account; any other address fails with `knock_recipient_not_allowed`. [Knock test channel](https://docs.knock.app/integrations/email/knock-test), [Email overview](https://docs.knock.app/integrations/email/overview)
- None of these pages describes an offline or local mode that works without Knock's API. Every trigger still calls Knock's hosted service.

## Open questions the sources did not answer

- Whether Postmark would treat a course-published notice sent to opted-in Students as transactional. Its docs define bulk but do not cover this exact case, and they say to contact Postmark.
- Whether `@knocklabs/react` hydrates cleanly under React Router 8 SSR. Only a server render was checked.
- Knock's per-endpoint rate-limit tier for `workflows.trigger` and for the subscription endpoints (the extracted docs did not show the mapping).
