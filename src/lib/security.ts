import { timingSafeEqual } from "node:crypto";
function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
// One shared lab password. No users, cookies, session signing, or persistence.
export function labAuth(req: Request) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  const expected = "Basic " + Buffer.from("lab:" + password).toString("base64");
  return equal(req.headers.get("authorization") || "", expected);
}
export function webhookAuth(req: Request) {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  return (
    !!secret &&
    equal(req.headers.get("authorization") || "", "Bearer " + secret)
  );
}
