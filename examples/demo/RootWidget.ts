import Widget from "../../src/widget";
import Counter from "./Counter";

const template = `
    <div>
        <span>Root Widget/></span>
        <t t-widget="Counter" initialState={{0}}>
    </div>
`;

export default class RootWidget extends Widget {
  id = "root";
  template = template;
  widgets = { Counter };
}
