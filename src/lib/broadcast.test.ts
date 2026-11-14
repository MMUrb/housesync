import { describe, expect, it } from "vitest";
import {
  bodyToHtml,
  canReceive,
  firstNameOf,
  personalise,
  pickRecipients,
  renderBody,
  hasEmbeddedImages,
  sanitizeEmailHtml,
  type Person,
} from "./broadcast";

const person = (over: Partial<Person> & { id: string }): Person => ({
  email: `${over.id}@example.com`,
  name: null,
  house: null,
  emailOn: true,
  newsOn: true,
  ...over,
});

const people = [
  person({ id: "a", name: "Genevieve Newell" }),
  person({ id: "b", newsOn: false }), // switched News off
  person({ id: "c", emailOn: false }), // switched all email off
  person({ id: "d", email: null }), // no email at all
];

describe("who gets an email", () => {
  it("sends news only to people with email and News both on", () => {
    expect(pickRecipients(people, "news", null).map((p) => p.id)).toEqual(["a"]);
  });

  it("sends a service notice to everyone with an email", () => {
    expect(pickRecipients(people, "service", null).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("lets a person's opt-out win over being picked", () => {
    expect(pickRecipients(people, "news", ["a", "b"]).map((p) => p.id)).toEqual(["a"]);
  });

  it("treats an empty pick as nobody, never as everyone", () => {
    expect(pickRecipients(people, "news", [])).toEqual([]);
    expect(pickRecipients(people, "service", [])).toEqual([]);
  });

  it("never emails someone with no address", () => {
    expect(canReceive(people[3], "service")).toBe(false);
  });
});

describe("HTML emails", () => {
  it("keeps your layout, images and links", () => {
    const html = '<img src="https://housesync.co.uk/og.png" alt="x" width="100%"><p>Hi <b>{first name}</b></p><a href="https://housesync.co.uk">Go</a>';
    const out = renderBody(html, "html", "Genevieve");
    expect(out).toContain('<img src="https://housesync.co.uk/og.png"');
    expect(out).toContain("<p>Hi <b>Genevieve</b></p>");
    expect(out).toContain('<a href="https://housesync.co.uk">Go</a>');
  });

  it("strips anything that could run or embed something", () => {
    const out = sanitizeEmailHtml(
      '<p onclick="steal()">Hi</p><script>alert(1)</script><iframe src="https://x"></iframe>' +
        '<img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a><form action="https://x"><input></form>',
    );
    expect(out).not.toMatch(/script|iframe|onclick|onerror|javascript:|<form/i);
    expect(out).toContain("<p>Hi</p>");
  });

  it("never touches ordinary words that look like attributes (14/11/2026 bug)", () => {
    const out = sanitizeEmailHtml('<p>Pay online = easy. Click onward=now.</p><a href="https://x.co" onclick="y()">Go</a>');
    expect(out).toBe('<p>Pay online = easy. Click onward=now.</p><a href="https://x.co">Go</a>');
  });

  it("finds images pasted into the HTML itself", () => {
    expect(hasEmbeddedImages('<img src="data:image/png;base64,AAAA">')).toBe(true);
    expect(hasEmbeddedImages('<img src="https://housesync.co.uk/og.png">')).toBe(false);
  });

  it("escapes the name it fills in, so a name can't inject markup", () => {
    expect(renderBody("<p>Hi {first name}</p>", "html", "<b>Bob</b>")).toBe("<p>Hi &lt;b&gt;Bob&lt;/b&gt;</p>");
  });

  it("still lays out plain text the old way", () => {
    expect(renderBody("Hi {first name}", "text", "Genevieve")).toBe('<p style="margin:0 0 14px">Hi Genevieve</p>');
  });
});

describe("building the message", () => {
  it("fills in the first name, however {first name} is typed", () => {
    expect(personalise("Hi {first name}, {First Name}! {firstname}", "Genevieve")).toBe(
      "Hi Genevieve, Genevieve! Genevieve",
    );
    expect(firstNameOf({ name: "Genevieve Newell" })).toBe("Genevieve");
    expect(firstNameOf({ name: null })).toBe("there");
  });

  it("escapes the text so a message can't inject markup", () => {
    const html = bodyToHtml('<script>alert(1)</script> & "quotes"');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });

  it("makes paragraphs, line breaks and links", () => {
    const html = bodyToHtml("Hi,\n\nLine one\nline two.\n\nSee https://housesync.co.uk/bills.");
    expect(html.match(/<p /g)).toHaveLength(3);
    expect(html).toContain("Line one<br>line two.");
    // The full stop after the link isn't swallowed into it.
    expect(html).toContain('<a href="https://housesync.co.uk/bills" style="color:#5f3fe0">https://housesync.co.uk/bills</a>.');
  });
});
