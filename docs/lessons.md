# Implementation lessons

- Tests and isolated captures must not persist their fixture encryption key into the normal installation's key file. An in-memory or alternate database does not isolate configuration side effects. Guard key persistence as well as database selection.
- Beli ranking scores and personal-score values can have different precision. Keep the original values and compare with a tolerance matching the observed four-decimal score endpoint; do not reject a complete snapshot for rounding alone.
- Private integrations must account for response-replay stores and exported database copies, not only their primary tables. Beli responses bypass persistent idempotency caching, and backup redaction runs only on a disposable snapshot with no fallback to the live database.
- In planner captures, expand the actual desktop places panel before clicking controls inside it. A transformed, collapsed panel can satisfy visibility checks while the map intercepts its pointer events. Verify responsive forms visually; native selects can otherwise squeeze the origin field to an unusable width.

- Authentication errors must distinguish a fresh-login rejection from a rejected saved session. HTTP 401 alone does not establish token expiry; an unexpired JWT can still be rejected. Compare the unchanged client before attributing a failure to a port, and never log credentials or raw authentication error bodies.

- Preserve the original connector identifier formats when porting authentication: the reviewed Beli helper accepts either email or `phone_no`. Map fresh-login and refresh failures separately, and retain only whitelisted upstream reason codes for diagnosis; never log raw authentication responses.
