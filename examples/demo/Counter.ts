import Widget from "../../src/widget";

const template = `
    <div>
        <button t-on-click="decrement">-</button>
        <span>Value: <t t-esc="state.counter"/></span>
        <button t-on-click="increment">+</button>
    </div>
`;

export default class Counter extends Widget {
  id = "counter";
  template = template;

  state = {
    counter: 0
  };

  constructor(parent: Widget, initialState?: number) {
    super(parent);
    if (initialState) {
      this.state.counter = initialState;
    }
  }

  async increment() {
    this.state.counter++;
    await this.render();
  }

  async decrement() {
    this.state.counter--;
    await this.render();
  }
}
