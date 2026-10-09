import { friendlyAuthError } from "../../features/auth/Account";

describe("friendlyAuthError", () => {
  it("explains the email rate limit", () => {
    expect(friendlyAuthError("email rate limit exceeded")).toMatch(/Too many sign-in emails/);
    expect(friendlyAuthError("For security purposes, you can only request this after 45 seconds.")).toMatch(/wait a few minutes/);
  });
  it("explains a disabled provider", () => {
    expect(friendlyAuthError("Unsupported provider: provider is not enabled")).toMatch(/email link instead/);
  });
  it("passes other messages through", () => expect(friendlyAuthError("boom")).toBe("boom"));
});
