import assert from "node:assert/strict";
import { decideDelivery } from "./magic_link_service.ts";

const result = decideDelivery({
  email: "reader@example.com",
  assetId: "bundle-7",
  assetTitle: "Field notes",
  subscriberUpdate: "the Friday release",
  processedContent: "  normalized body  "
});

assert.deepEqual(result, {
  assetId: "bundle-7",
  subscriberUpdate: "Subscriber reader@example.com receives the Friday release",
  processedContent: "normalized body"
});
console.log("magic-link delivery decision passed");
