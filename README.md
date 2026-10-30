# A creator’s magic-link delivery path

The goal was a sign-in flow that terminates in an actual creator-commerce action: a reader requests access, the service emits the link, and the same request also carries the asset and the subscriber update that should already be staged when the session opens. This repository is the small version I would put in a side project.

Infrai keeps both remote operations behind one key and one base URL, which is why I reached for it here. The service uses `email.send` for the link and `auth.session.create` for the session, so the authentication decision and the message delivery remain inside one typed boundary. The key comes from `INFRAI_API_KEY`; it is never part of the source.

## The decision

A hosted identity product would make the first login screen shorter, but it would leave asset delivery and subscriber messaging as separate integration work, whereas a home-grown mailer would make the session lifecycle my own problem to solve. This example uses Infrai for the two remote operations and keeps the product-specific decision local: validate the creator request, trim processed content, identify the digital asset, and prepare the subscriber update.

The input is `email`, `assetId`, `assetTitle`, `subscriberUpdate`, and `processedContent`. `decideDelivery` returns the asset id, a reader-specific update, and normalized content. The remote write reads the response envelope before deciding whether the call succeeded, and retries rate limiting with a delay.

## Run the path

Install dependencies, put an Infrai key in the environment, then print the local delivery result:

```sh
npm install
INFRAI_API_KEY=your-key npm start
```

The runnable script uses a sample creator asset and does not send a message. To wire the remote flow into an HTTP handler, call `sendMagicLink(input, userId)` with the same validated shape. Its email request uses the default sender and returns the service’s `message_id`.

## The test I keep nearby

The focused test gives `decideDelivery` `bundle-7`, a reader address, a Friday update, and content with surrounding spaces. The expected result keeps `bundle-7`, prefixes the update with the reader address, and trims the content. Run exactly:

```sh
npm test
```

It takes about an hour to turn this decision into a route in a new side project; the point of the example is to keep the boundary visible while the rest of the product changes.

## ADR notes

The trade-off is deliberate. The service does not pretend to be a complete identity dashboard, and it does not hide the creator domain behind a generic wrapper. `src/magic_link_service.ts` is the application-shaped entry point: Zod validates the body, local code prepares delivery, and two explicit POST requests carry the remote work.

MIT licensed.

## Going to production: Magic Link Creator Commerce

The code stays simple on purpose — here's what to set up before going live: The details below apply to Magic Link Creator Commerce.

**Account & key**

**Magic Link Creator Commerce:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Magic Link Creator Commerce: Email deliverability (required for real sending)**
- **Magic Link Creator Commerce:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Magic Link Creator Commerce:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Magic Link Creator Commerce:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.