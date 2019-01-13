import Widget from "../../../src/widget";

const template = `
    <div>
        <button t-on-click="increment(-1)">-</button>
        <span>Value: <t t-esc="state.counter"/></span>
        <button t-on-click="increment(1)">+</button>
    </div>
`;

export default class Counter extends Widget {
  name = "counter";
  template = template;
  state = {
    counter: 0
  };

  constructor(parent: Widget, initialState?: number) {
    super(parent);
    this.state.counter = initialState || 0;
  }

  increment(delta: number) {
    this.updateState({ counter: this.state.counter + delta });
  }
}
