import { add } from "../src/qweb";

describe("greeter function", () => {
  test("basic", () => {
    expect(add(0, 0)).toBe(0);
  });

  test("basic again", () => {
    expect(add(1, 2)).toBe(3);
  });
});
// import test from "ava";

// test("Can do math", function(t) {
//   t.deepEqual(add(1, 2), 3);
// });
// import  QWeb  from "../src/qweb";

// test("can render simple template", function(t) {
//     const qweb = new QWeb();
//     const result = qweb.render('<div>hello</div>');
//     t.is(qweb.render())
//   t.deepEqual(add(1, 2), 3);
// });
