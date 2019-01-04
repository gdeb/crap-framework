import { escape } from "./utils";

type RawTemplate = string;
type Template = (context: any) => Node;

// Evaluation Context
export type EvalContext = { [key: string]: any };

// ACTIONS_PRECEDENCE: 'foreach,if,elif,else,call,set,tag,esc,raw,js,debug,log'.split(','),

// Compilation Context
class Context {
  nextID: number = 1;
  code: string[] = [];
  currentCodeTarget: string[];
  rootNodes: string[] = [];
  variables: { [key: string]: any } = {};
  escaping: boolean = false;
  parentNode: string | undefined;

  constructor() {
    this.currentCodeTarget = this.code;
  }

  generateID(): string {
    return `_${this.nextID++}`;
  }

  withParent(node: string): Context {
    const newContext = Object.create(this);
    newContext.parentNode = node;
    return newContext;
  }
  withEscaping(): Context {
    const newContext = Object.create(this);
    newContext.escaping = true;
    return newContext;
  }
}

/**
 * Template rendering engine
 */
export default class QWeb {
  rawTemplates: { [name: string]: RawTemplate } = {};
  templates: { [name: string]: Template } = {};
  escape: ((str: string) => string) = escape;

  /**
   * Add a template to the internal template map.  Note that it is not
   * immediately compiled.
   */
  addTemplate(name: string, template: RawTemplate) {
    this.rawTemplates[name] = template;
  }

  /**
   * Render a template
   *
   * @param {string} name the template should already have been added
   */
  render(name: string, context: any = {}): Node {
    const template = this.templates[name] || this._compile(name);
    return template(context);
  }

  renderToString(name: string, context: EvalContext = {}): string {
    const node = this.render(name, context);
    const isTextNode = node.nodeType === 3;
    return isTextNode ? node.textContent! : (<HTMLElement>node).outerHTML;
  }

  _compile(name: string): Template {
    const rawTemplate = this.rawTemplates[name];
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawTemplate, "text/xml");
    if (!doc.firstChild) {
      throw new Error("Invalid template (should not be empty)");
    }
    if (doc.firstChild.nodeName === "parsererror") {
      throw new Error("Invalid XML in template");
    }
    var ctx = new Context();

    this._compileNode(doc.firstChild, ctx);

    // console.log(ctx.mainNodes, ctx.code);
    if (ctx.rootNodes.length === 1) {
      ctx.code.push(`return ${ctx.rootNodes[0]}`);
    } else {
      console.log(ctx.code, ctx.rootNodes);
      throw new Error("need to think about this...");
    }
    const functionCode = ctx.code.join(";\n");
    // console.log(`Template: ${rawTemplate}\nCompiled code:\n` + functionCode);
    // console.log(ctx.variables.value[0]);
    // console.log(`Context: ${JSON.stringify(ctx)}`);
    const template: Template = (new Function(
      "context",
      functionCode
    ) as Template).bind(this);
    this.templates[name] = template;
    return template;
  }

  /**
   * Generate code from an xml node
   *
   */
  _compileNode(node: ChildNode, ctx: Context) {
    if (node.nodeName !== "t") {
      let nodeID = this._compileGenericNode(node, ctx);
      ctx = ctx.withParent(nodeID);
    }

    if (!(node instanceof Element)) {
      // this is a text node, there are no directive to apply
      return;
    }

    // t-set
    if (node.attributes.hasOwnProperty("t-set")) {
      const variable = node.getAttribute("t-set")!;
      let value = node.getAttribute("t-value")!;
      if (value) {
        ctx.variables[variable] = value;
      } else {
        ctx.variables[variable] = node.childNodes;
      }
    }

    // t-esc
    if (node.attributes.hasOwnProperty("t-esc")) {
      let value = this._getValue(node.getAttribute("t-esc")!, ctx);
      this._evalExpression(value, ctx.withEscaping());
    }

    // t-raw
    if (node.attributes.hasOwnProperty("t-raw")) {
      let value = this._getValue(node.getAttribute("t-raw")!, ctx);
      this._evalExpression(value, ctx);
    }

    if (node.nodeName === "t" && !node.attributes.hasOwnProperty("t-set")) {
      this._compileChildren(node, ctx);
    }
  }

  _getValue(val: any, ctx: Context): any {
    if (val in ctx.variables) {
      return this._getValue(ctx.variables[val], ctx);
    }
    return val;
  }
  _compileChildren(node: ChildNode, ctx: Context) {
    if (node.childNodes.length > 0) {
      for (let child of Array.from(node.childNodes)) {
        this._compileNode(child, ctx);
      }
    }
  }
  _compileGenericNode(node: ChildNode, ctx: Context): string {
    const nodeID: string = ctx.generateID();

    switch (node.nodeType) {
      case 1: // generic tag;
        ctx.currentCodeTarget.push(
          `let ${nodeID} = document.createElement('${node.nodeName}')`
        );
        break;
      case 3: // text node
        ctx.currentCodeTarget.push(
          `let ${nodeID} = document.createTextNode('${node.textContent}')`
        );
        break;
      default:
        throw new Error("unknown node type");
    }

    if (ctx.parentNode) {
      ctx.currentCodeTarget.push(`${ctx.parentNode}.appendChild(${nodeID})`);
    } else {
      ctx.rootNodes.push(nodeID);
    }
    if (node.childNodes.length > 0) {
      const subCtx = ctx.withParent(nodeID);
      this._compileChildren(node, subCtx);
    }
    return nodeID;
  }

  _evalExpression(value: any, ctx: Context): any {
    if (typeof value === "string") {
      if (value[0] === '"' || value[0] === "'") {
        this._makeTextNode(value, ctx);
        return;
      }
      this._makeTextNode(`context["${value}"]`, ctx);
      return;
    }
    if (value instanceof NodeList) {
      for (let node of Array.from(value)) {
        this._compileNode(<ChildNode>node, ctx);
      }
      return;
    }
  }

  _makeTextNode(value: string, ctx: Context) {
    let text = value;
    if (ctx.escaping) {
      text = `this.escape(${text})`;
    }

    const nodeID = ctx.generateID();
    ctx.currentCodeTarget.push(
      `let ${nodeID} = document.createTextNode(${text})`
    );
    if (ctx.parentNode) {
      ctx.currentCodeTarget.push(`${ctx.parentNode}.appendChild(${nodeID})`);
    } else {
      ctx.rootNodes.push(nodeID);
    }
  }

  _makeFunctionNode(functionName: string, ctx: Context) {
    const nodeID = ctx.generateID();
    ctx.currentCodeTarget.push(
      `let ${nodeID} = ${functionName}(${ctx.escaping})`
    );
    if (ctx.parentNode) {
      ctx.currentCodeTarget.push(`${ctx.parentNode}.appendChild(${nodeID})`);
    } else {
      ctx.rootNodes.push(nodeID);
    }
  }
}
