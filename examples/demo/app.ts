///<amd-module name="main" />

// import RootWidget from "./RootWidget";
import Counter from "./Counter";
import { Environment } from "../../src/widget";
import QWeb from "../../src/qweb";

function makeEnv(): Environment {
  const qweb = new QWeb();
  return {
    qweb: qweb,
    services: {}
  };
}

document.addEventListener("DOMContentLoaded", async function() {
  const rootWidget = new Counter(null);
  const env = makeEnv();
  rootWidget.setEnvironment(env);
  const mainDiv = document.getElementById("app")!;
  await rootWidget.appendTo(mainDiv);
});
