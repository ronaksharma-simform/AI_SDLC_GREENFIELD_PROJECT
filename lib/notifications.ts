/**
 * Notification trigger helper (REQ-16 / REQ-19d).
 *
 * The Ride Request module decides WHEN a notification must fire (a request was
 * created, accepted, or rejected). HOW it is delivered — push / email / in-app —
 * is owned by the separate Notifications module and is out of scope here, so
 * this helper is an explicit, testable trigger point that currently records the
 * intent in the server log.
 */
export async function notifyUser(
  userId: string,
  type: string,
  payload: unknown
): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[notification] user=${userId} type=${type} payload=${JSON.stringify(payload)}`);
}
