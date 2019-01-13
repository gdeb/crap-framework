import QWeb from "./qweb";

export interface Environment {
  qweb: QWeb;
  services: { [key: string]: any };
}

export interface Meta {
  id: string;
  template: string;
  description?: string;
}

export default class Widget {
  name: string = "widget";
  template: string = "<div></div>";

  parent: Widget | null;
  children: Widget[] = [];
  env: Environment | null = null;
  el: ChildNode | null = null;

  //--------------------------------------------------------------------------
  // Lifecycle
  //--------------------------------------------------------------------------

  constructor(parent: Widget | null) {
    this.parent = parent;
    if (parent) {
      parent.children.push(this);
      this.setEnvironment(parent.env);
    }
  }

  async willStart() {}

  async render() {
    const fragment = await this.env!.qweb.render(this.name, this);
    this._setElement(fragment.firstChild!);
  }

  mounted() {}

  willUnmount() {}

  //--------------------------------------------------------------------------
  // Public
  //--------------------------------------------------------------------------

  async appendTo(target: HTMLElement) {
    await this.willStart();
    await this.render();
    target.appendChild(this.el!);
  }

  destroy() {}

  setEnvironment(env: Environment | null) {
    this.env = env ? Object.create(env) : null;
    if (this.env) {
      this.env.qweb.addTemplate(this.name, this.template);
    }
  }

  //--------------------------------------------------------------------------
  // Private
  //--------------------------------------------------------------------------

  private _setElement(el: ChildNode) {
    if (this.el) {
      this.el.replaceWith(el);
    }
    this.el = el;
  }
}
