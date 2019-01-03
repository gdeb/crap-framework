const escapeMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "`": "&#x60;"
};

const source = "(?:" + Object.keys(escapeMap).join("|") + ")";
const testRegexp = new RegExp(source);
const replaceRegexp = new RegExp(source, "g");

function escaper(match: string): string {
  return escapeMap[match];
}

export function escape(str: string): string {
  return testRegexp.test(str) ? str.replace(replaceRegexp, escaper) : str;
}
