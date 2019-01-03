import QWeb from "../src/qweb";

describe("can render basic templates", () => {
  test("empty div", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", "<div></div>");

    const result = qweb.render("test");
    expect(result.outerHTML).toBe("<div></div>");
  });

  test("div with a text node", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", "<div>word</div>");

    const result = qweb.render("test");
    expect(result.outerHTML).toBe("<div>word</div>");
  });
});
