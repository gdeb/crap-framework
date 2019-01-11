import { escape } from "./utils";

type RawTemplate = string;
type Template = (context: any) => DocumentFragment;

// Evaluation Context
export type EvalContext = { [key: string]: any };

const RESERVED_WORDS = "true,false,NaN,null,undefined,debugger,console,window,in,instanceof,new,function,return,this,typeof,eval,void,Math,RegExp,Array,Object,Date".split(
  ","
);

// Compilation Context
class Context {
  nextID: number = 1;
  code: string[] = [];
  variables: { [key: string]: any } = {};
  escaping: boolean = false;
  parentNode: string | undefined;
  indentLevel: number = 0;
  rootContext: Context;
  caller: Element | undefined;
  fragmentID: string;

  constructor() {
    this.rootContext = this;
    this.fragmentID = this.generateID();
  }

  generateID(): string {
    const id = `_${this.rootContext.nextID}`;
    this.rootContext.nextID++;
    return id;
  }

  withParent(node: string): Context {
    const newContext = Object.create(this);
    newContext.parentNode = node;
    return newContext;
  }

  withVariables(variables: { [key: string]: any }) {
    const newContext = Object.create(this);
    newContext.variables = Object.create(variables);
    return newContext;
  }

  withCaller(node: Element): Context {
    const newContext = Object.create(this);
    newContext.caller = node;
    return newContext;
  }

  withEscaping(): Context {
    const newContext = Object.create(this);
    newContext.escaping = true;
    return newContext;
  }

  indent() {
    this.indentLevel++;
  }

  dedent() {
    this.indentLevel--;
  }

  addNode(nodeID: string) {
    if (this.parentNode) {
      this.addLine(`${this.parentNode}.appendChild(${nodeID})`);
    } else {
      this.addLine(`${this.fragmentID}.appendChild(${nodeID})`);
    }
  }
  addLine(line: string) {
    for (let i = 0; i < this.indentLevel; i++) {
      line = "  " + line;
    }
    if (line[line.length - 1] !== "}" && line[line.length - 1] !== "{") {
      line = line + ";";
    }
    this.code.push(line);
  }
}

/**
 * Template rendering engine
 */
export default class QWeb {
  rawTemplates: { [name: string]: RawTemplate } = {};
  nodeTemplates: { [name: string]: Document } = {};
  templates: { [name: string]: Template } = {};
  escape: ((str: string) => string) = escape;
  exprCache: { [key: string]: string } = {};

  /**
   * Add a template to the internal template map.  Note that it is not
   * immediately compiled.
   */
  addTemplate(name: string, template: RawTemplate) {
    this.rawTemplates[name] = template;
    const parser = new DOMParser();
    const doc = parser.parseFromString(template, "text/xml");
    if (!doc.firstChild) {
      throw new Error("Invalid template (should not be empty)");
    }
    if (doc.firstChild.nodeName === "parsererror") {
      throw new Error("Invalid XML in template");
    }
    var tbranch = doc.querySelectorAll("[t-elif], [t-else]");
    for (var i = 0, ilen = tbranch.length; i < ilen; i++) {
      var node = tbranch[i];
      var prev_elem = node.previousElementSibling!;
      var pattr = function(name) {
        return prev_elem.getAttribute(name);
      };
      var nattr = function(name) {
        return +!!node.getAttribute(name);
      };
      if (prev_elem && (pattr("t-if") || pattr("t-elif"))) {
        if (pattr("t-foreach")) {
          throw new Error(
            "t-if cannot stay at the same level as t-foreach when using t-elif or t-else"
          );
        }
        if (
          ["t-if", "t-elif", "t-else"].map(nattr).reduce(function(a, b) {
            return a + b;
          }) > 1
        ) {
          throw new Error(
            "Only one conditional branching directive is allowed per node"
          );
        }
        // All text nodes between branch nodes are removed
        var text_node;
        while ((text_node = node.previousSibling) !== prev_elem) {
          if (text_node.nodeValue.trim().length) {
            throw new Error("text is not allowed between branching directives");
          }
          // IE <= 11.0 doesn't support ChildNode.remove
          text_node.parentNode.removeChild(text_node);
        }
      } else {
        throw new Error(
          "t-elif and t-else directives must be preceded by a t-if or t-elif directive"
        );
      }
    }

    this.nodeTemplates[name] = doc;
  }

  /**
   * Render a template
   *
   * @param {string} name the template should already have been added
   */
  render(name: string, context: any = {}): DocumentFragment {
    const template = this.templates[name] || this._compile(name);
    return template(context);
  }

  renderToString(name: string, context: EvalContext = {}): string {
    const node = this.render(name, context);
    return this._renderNodeToString(node);
  }

  _renderNodeToString(node: Node): string {
    switch (node.nodeType) {
      case 3: // text node
        return node.textContent!;
      case 11: // document.fragment
        const children = Array.from((<DocumentFragment>node).childNodes);
        return children.map(this._renderNodeToString).join("");
      default:
        return (<HTMLElement>node).outerHTML;
    }
  }

  _compile(name: string): Template {
    if (name in this.templates) {
      return this.templates[name];
    }
    const doc = this.nodeTemplates[name];

    let ctx = new Context();

    ctx.addLine(`${ctx.fragmentID} = document.createDocumentFragment()`);
    this._compileNode(doc.firstChild!, ctx);

    ctx.addLine(`return ${ctx.fragmentID}`);
    const functionCode = ctx.code.join("\n");
    // console.log(
    //   `Template: ${this.rawTemplates[name]}\nCompiled code:\n` + functionCode
    // );
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
    if (!(node instanceof Element)) {
      // this is a text node, there are no directive to apply
      this._compileGenericNode(node, ctx);
      return;
    }

    // t-foreach
    if (node.attributes.hasOwnProperty("t-foreach")) {
      const elems = node.getAttribute("t-foreach")!;
      const name = node.getAttribute("t-as")!;
      let arrayID = ctx.generateID();
      ctx.addLine(`let ${arrayID} = ${this._formatExpression(elems)}`);
      ctx.addLine(
        `if (typeof ${arrayID} === 'number') { ${arrayID} = Array.from(Array(${arrayID}).keys())}`
      );
      let keysID = ctx.generateID();
      ctx.addLine(
        `let ${keysID} = ${arrayID} instanceof Array ? ${arrayID} : Object.keys(${arrayID})`
      );
      let valuesID = ctx.generateID();
      ctx.addLine(
        `let ${valuesID} = ${arrayID} instanceof Array ? ${arrayID} : Object.values(${arrayID})`
      );
      ctx.addLine(`for (let i = 0; i < ${keysID}.length; i++) {`);
      ctx.indent();
      ctx.addLine(`context.${name}_first = i === 0`);
      ctx.addLine(`context.${name}_last = i === ${keysID}.length - 1`);
      ctx.addLine(`context.${name}_parity = i % 2 === 0 ? 'even' : 'odd'`);
      ctx.addLine(`context.${name}_index = i`);
      ctx.addLine(`context.${name} = ${keysID}[i]`);
      ctx.addLine(`context.${name}_value = ${valuesID}[i]`);
      const nodes = Array.from(node.childNodes);
      for (let i = 0; i < nodes.length; i++) {
        this._compileNode(nodes[i], ctx);
      }
      ctx.dedent();
      ctx.addLine("}");
      return;
    }

    // t-if
    if (node.attributes.hasOwnProperty("t-if")) {
      let cond = this._getValue(node.getAttribute("t-if")!, ctx);
      ctx.addLine(`if (${this._formatExpression(cond)}) {`);
      ctx.indent();
    }

    // t-elif
    if (node.attributes.hasOwnProperty("t-elif")) {
      // node.previousSibling.
      let cond = this._getValue(node.getAttribute("t-elif")!, ctx);
      ctx.addLine(`else if (${this._formatExpression(cond)}) {`);
      ctx.indent();
    }

    // t-else
    if (node.attributes.hasOwnProperty("t-else")) {
      ctx.addLine(`else {`);
      ctx.indent();
    }

    // t-call
    if (node.attributes.hasOwnProperty("t-call")) {
      const subTemplate = node.getAttribute("t-call")!;
      const nodeTemplate = this.nodeTemplates[subTemplate];
      const nodeCopy = <Element>node.cloneNode(true);
      nodeCopy.removeAttribute("t-call");

      // extract variables from nodecopy
      const tempCtx = new Context();
      this._compileNode(nodeCopy, tempCtx);
      const vars = Object.assign({}, ctx.variables, tempCtx.variables);
      const subCtx = ctx.withCaller(nodeCopy).withVariables(vars);

      this._compileNode(nodeTemplate.firstChild!, subCtx);
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

    if (node.nodeName !== "t") {
      let nodeID = this._compileGenericNode(node, ctx);
      if (nodeID) {
        ctx = ctx.withParent(nodeID);
      }
    }

    // t-esc
    if (node.attributes.hasOwnProperty("t-esc")) {
      let value = this._getValue(node.getAttribute("t-esc")!, ctx);
      this._compileValueNode(value, node, ctx.withEscaping());
    }

    // t-raw
    if (node.attributes.hasOwnProperty("t-raw")) {
      let value = this._getValue(node.getAttribute("t-raw")!, ctx);
      this._compileValueNode(value, node, ctx);
    }

    // add children for ts
    if (node.nodeName === "t" && !node.attributes.hasOwnProperty("t-set")) {
      this._compileChildren(node, ctx);
    }

    // t-if
    if (node.attributes.hasOwnProperty("t-if")) {
      ctx.dedent();
      ctx.addLine(`}`);
    }

    // t-elif
    if (node.attributes.hasOwnProperty("t-elif")) {
      ctx.dedent();
      ctx.addLine(`}`);
    }

    // t-else
    if (node.attributes.hasOwnProperty("t-else")) {
      ctx.dedent();
      ctx.addLine(`}`);
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
  _compileGenericNode(node: ChildNode, ctx: Context): string | undefined {
    let nodeID: string | undefined;
    let hasTEscOrTRaw = false;
    switch (node.nodeType) {
      case 1: // generic tag;
        nodeID = ctx.generateID();
        ctx.addLine(
          `let ${nodeID} = document.createElement('${node.nodeName}')`
        );

        const attributes = (<Element>node).attributes;
        for (let i = 0; i < attributes.length; i++) {
          const name = attributes[i].name;
          const value = attributes[i].textContent!;
          if (!name.startsWith("t-")) {
            ctx.addLine(
              `${nodeID}.setAttribute('${name}', '${escape(value)}')`
            );
          }
          if (name.startsWith("t-att-")) {
            const attName = name.slice(6);
            const formattedValue = this._formatExpression(value!);
            const attID = ctx.generateID();
            ctx.addLine(`let ${attID} = ${formattedValue}`);
            ctx.addLine(
              `if (${attID}) {${nodeID}.setAttribute('${attName}', ${attID})}`
            );
          }
          if (name.startsWith("t-attf-")) {
            const exprName = name.slice(7);
            const formattedExpr = value!.replace(
              /\{\{.*?\}\}/g,
              s => "${" + this._formatExpression(s.slice(2, -2)) + "}"
            );
            ctx.addLine(
              `${nodeID}.setAttribute('${exprName}', \`${formattedExpr}\`)`
            );
          }
          if (name.startsWith("t-on-")) {
            const eventName = name.slice(5);
            const handler = value;
            ctx.addLine(
              `${nodeID}.addEventListener('${eventName}', context['${handler}'].bind(context))`
            );
          }
          if (name === "t-att") {
            const id = ctx.generateID();
            ctx.addLine(`let ${id} = ${this._formatExpression(value!)}`);
            ctx.addLine(`if (${id} instanceof Array) {`);
            ctx.indent();
            ctx.addLine(`${nodeID}.setAttribute(${id}[0], ${id}[1])`);
            ctx.dedent();
            ctx.addLine(`} else {`);
            ctx.indent();
            ctx.addLine(`for (let key in ${id}) {`);
            ctx.indent();
            ctx.addLine(`${nodeID}.setAttribute(key, ${id}[key])`);
            ctx.dedent();
            ctx.addLine(`}`);
            ctx.dedent();
            ctx.addLine(`}`);
          }
          if (name === "t-esc" || name === "t-raw") {
            hasTEscOrTRaw = true;
          }
        }
        break;
      case 3: // text node
        let text = node.textContent!;
        nodeID = ctx.generateID();
        ctx.addLine(`let ${nodeID} = document.createTextNode(\`${text}\`)`);
        break;
      default:
        throw new Error("unknown node type");
    }

    ctx.addNode(nodeID);
    if (node.childNodes.length > 0 && !hasTEscOrTRaw) {
      const subCtx = ctx.withParent(nodeID);
      this._compileChildren(node, subCtx);
    }
    return nodeID;
  }

  _compileValueNode(value: any, node: Element, ctx: Context) {
    if (value === "0" && ctx.caller) {
      this._compileNode(ctx.caller, ctx);
      return;
    }

    if (typeof value === "string") {
      const exprID = ctx.generateID();
      ctx.addLine(`let ${exprID} = ${this._formatExpression(value)}`);
      ctx.addLine(`if (${exprID} || ${exprID} === 0) {`);
      ctx.indent();
      this._makeTextNode(exprID, ctx);
      ctx.dedent();
      if (node.childNodes.length) {
        ctx.addLine("} else {");
        ctx.indent();
        this._compileChildren(node, ctx);
        ctx.dedent();
      }
      ctx.addLine("}");
      return;
    }
    if (value instanceof NodeList) {
      for (let node of Array.from(value)) {
        this._compileNode(<ChildNode>node, ctx);
      }
    }
  }

  _makeTextNode(value: string, ctx: Context) {
    let text = value;
    if (ctx.escaping) {
      text = `this.escape(${text})`;
    }

    const nodeID = ctx.generateID();
    ctx.addLine(`let ${nodeID} = document.createTextNode(${text})`);
    ctx.addNode(nodeID);
  }

  _formatExpression(e: string): string {
    if (e in this.exprCache) {
      return this.exprCache[e];
    }
    // Thanks CHM for this code...
    const chars = e.split("");
    let instring = "";
    let invar = "";
    let invarPos = 0;
    let r = "";
    chars.push(" ");
    for (var i = 0, ilen = chars.length; i < ilen; i++) {
      var c = chars[i];
      if (instring.length) {
        if (c === instring && chars[i - 1] !== "\\") {
          instring = "";
        }
      } else if (c === '"' || c === "'") {
        instring = c;
      } else if (c.match(/[a-zA-Z_\$]/) && !invar.length) {
        invar = c;
        invarPos = i;
        continue;
      } else if (c.match(/\W/) && invar.length) {
        // TODO: Should check for possible spaces before dot
        if (chars[invarPos - 1] !== "." && RESERVED_WORDS.indexOf(invar) < 0) {
          invar = "context['" + invar + "']";
        }
        r += invar;
        invar = "";
      } else if (invar.length) {
        invar += c;
        continue;
      }
      r += c;
    }
    const result = r.slice(0, -1);
    this.exprCache[e] = result;
    return result;
  }
}
