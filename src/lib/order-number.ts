const digits: Record<string, string> = {
  zero: "0",
  oh: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};
const small: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};
const tens: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
// Explicit historical aliases only; never extract digits from arbitrary text.
const legacy: Record<string, string> = {
  "sei-1001": "123",
  "sei-1002": "234",
  "sei-1003": "345",
  "sei-1004": "456",
};
export function normalizeOrderNumber(input: unknown): string {
  const invalid = () => {
    throw new Error(
      "Invalid or ambiguous order number. Please ask the caller to repeat the three digits separately.",
    );
  };
  if (typeof input !== "string") return invalid();
  const value = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (Object.hasOwn(legacy, value)) return legacy[value];
  if (/^\d{3}$/.test(value)) return value;
  if (/^\d \d \d$/.test(value)) return value.replaceAll(" ", "");
  const words = value.split(" ");
  if (words.length === 3 && words.every((w) => Object.hasOwn(digits, w)))
    return words.map((w) => digits[w]).join("");
  const match = value.match(
    /^(one|two|three|four|five|six|seven|eight|nine) hundred(?: (?:and )?([a-z]+(?:[ -][a-z]+)?))?$/,
  );
  if (!match) return invalid();
  let remainder = 0;
  if (match[2]) {
    if (Object.hasOwn(small, match[2])) remainder = small[match[2]];
    else {
      const [t, u, ...extra] = match[2].split(/[ -]/);
      if (
        extra.length ||
        !Object.hasOwn(tens, t) ||
        (u && !(small[u] >= 1 && small[u] <= 9))
      )
        return invalid();
      remainder = tens[t] + (u ? small[u] : 0);
    }
  }
  return String(small[match[1]] * 100 + remainder);
}
export function orderNumberFromArguments(raw: unknown): string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error(
      "Provide order_number as a string containing the three-digit order number.",
    );
  const args = raw as Record<string, unknown>;
  if (args.order_number === undefined && args.orderNumber === undefined)
    throw new Error(
      "Missing order_number. Ask the caller for the three digits separately.",
    );
  const canonical = normalizeOrderNumber(
    args.order_number !== undefined ? args.order_number : args.orderNumber,
  );
  if (
    args.order_number !== undefined &&
    args.orderNumber !== undefined &&
    canonical !== normalizeOrderNumber(args.orderNumber)
  )
    throw new Error(
      "Conflicting order numbers. Ask the caller to repeat the three digits separately.",
    );
  return canonical;
}
