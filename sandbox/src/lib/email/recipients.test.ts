import { describe, expect, it } from "vitest";
import { parseRecipientEmails } from "./recipients";

describe("parseRecipientEmails", () => {
  it("parses a single email", () => {
    expect(parseRecipientEmails("a@car-1996.com")).toEqual({ emails: ["a@car-1996.com"], invalid: [] });
  });
  it("splits multiple emails on comma and trims whitespace", () => {
    expect(parseRecipientEmails(" a@x.com , b@y.com ")).toEqual({ emails: ["a@x.com", "b@y.com"], invalid: [] });
  });
  it("also splits on semicolon and newline", () => {
    expect(parseRecipientEmails("a@x.com; b@y.com\nc@z.com")).toEqual({
      emails: ["a@x.com", "b@y.com", "c@z.com"],
      invalid: [],
    });
  });
  it("collects invalid addresses separately", () => {
    const r = parseRecipientEmails("good@x.com, not-an-email, bad@");
    expect(r.emails).toEqual(["good@x.com"]);
    expect(r.invalid).toEqual(["not-an-email", "bad@"]);
  });
  it("drops empty segments and dedups", () => {
    expect(parseRecipientEmails("a@x.com,,a@x.com,")).toEqual({ emails: ["a@x.com"], invalid: [] });
  });
  it("returns empty arrays for blank input", () => {
    expect(parseRecipientEmails("   ")).toEqual({ emails: [], invalid: [] });
  });
});
