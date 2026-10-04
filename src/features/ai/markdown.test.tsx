import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiMarkdown } from "./markdown";

const render = (text: string) => renderToStaticMarkup(<AiMarkdown>{text}</AiMarkdown>);

describe("AiMarkdown", () => {
  it("renders basic Markdown", () => {
    const html = render("**Salt** the water.\n\n- one\n- two");
    expect(html).toContain("<strong>Salt</strong>");
    expect(html).toContain("<li");
  });

  it("never renders raw HTML from the model", () => {
    const html = render(
      'Hi <script>alert(1)</script><img src=x onerror="alert(1)"><b onclick="x">bold</b>',
    );
    expect(html).not.toMatch(/<script|<img|onerror|onclick|<b /);
  });

  it("drops Markdown images and neutralizes javascript: links", () => {
    const html = render("![tracker](https://evil.example/pixel.png) [click](javascript:alert(1))");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("javascript:");
  });

  it("opens links in a new tab without passing the opener", () => {
    expect(render("[USDA](https://www.usda.gov)")).toContain('rel="noopener noreferrer nofollow"');
  });

  it("flattens headings so AI text cannot add page headings", () => {
    expect(render("# Big title")).not.toContain("<h1");
  });
});
