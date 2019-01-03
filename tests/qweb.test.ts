import QWeb from "../src/qweb";
import { EvalContext } from "../src/qweb";

function renderToString(t: string, context: EvalContext = {}): string {
  const qweb = new QWeb();
  qweb.addTemplate("test", t);
  return qweb.renderToString("test", context);
}

describe("static templates", () => {
  test("empty div", () => {
    const template = "<div></div>";
    const result = renderToString(template);
    expect(result).toBe(template);
  });

  test("div with a text node", () => {
    const template = "<div>word</div>";
    const result = renderToString(template);
    expect(result).toBe(template);
  });

  test("div with a span child node", () => {
    const template = "<div><span>word</span></div>";
    const result = renderToString(template);
    expect(result).toBe(template);
  });
});

describe("error handling", () => {
  test("invalid xml", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", "<div>");

    expect(() => qweb.render("test")).toThrow("Invalid XML in template");
  });
});

describe("t-esc", () => {
  test("literal", () => {
    const template = `<t t-esc="'ok'"/>`;
    const result = renderToString(template);
    expect(result).toBe("ok");
  });

  test("variable", () => {
    const template = `<t t-esc="var"/>`;
    const result = renderToString(template, { var: "ok" });
    expect(result).toBe("ok");
  });

  test("escaping", () => {
    const template = `<t t-esc="var"/>`;
    const result = renderToString(template, { var: "<ok>" });
    expect(result).toBe("&lt;ok&gt;");
  });

  test("escaping on a node", () => {
    const template = `<span t-esc="'ok'"/>`;
    const result = renderToString(template);
    expect(result).toBe("<span>ok</span>");
  });
});

describe("t-raw", () => {
  test("literal", () => {
    const template = `<t t-raw="'ok'"/>`;
    const result = renderToString(template);
    expect(result).toBe("ok");
  });

  test("variable", () => {
    const template = `<t t-raw="var"/>`;
    const result = renderToString(template, { var: "ok" });
    expect(result).toBe("ok");
  });

  test("not escaping", () => {
    const template = `<t t-raw="var"/>`;
    const result = renderToString(template, { var: "<ok>" });
    expect(result).toBe("<ok>");
  });
});

describe("t-set", () => {
  test("set from attribute literal", () => {
    const template = `<t><t t-set="value" t-value="'ok'"/><t t-esc="value"/></t>`;
    const result = renderToString(template);
    expect(result).toBe("ok");
  });
});
