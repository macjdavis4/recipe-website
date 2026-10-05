import { afterEach, describe, expect, it, vi } from "vitest";
import { createResendSender } from "./resend";

const message = { to: "ada@example.com", subject: "Hi", text: "Hello", html: "<p>Hello</p>" };

afterEach(() => vi.unstubAllGlobals());

describe("createResendSender", () => {
  it("posts the message with the key as a bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await createResendSender({ apiKey: "re_test", from: "Site <no-reply@example.com>" }).send(
      message,
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body)).toEqual({
      from: "Site <no-reply@example.com>",
      to: ["ada@example.com"],
      subject: "Hi",
      text: "Hello",
      html: "<p>Hello</p>",
    });
  });

  it("throws on a rejected request without including the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response('{"message":"Domain not verified"}', { status: 403 })),
    );
    const send = createResendSender({ apiKey: "re_secret", from: "a@example.com" }).send(message);
    await expect(send).rejects.toThrow(/403.*Domain not verified/);
    await expect(send).rejects.not.toThrow(/re_secret/);
  });
});
