import { escape } from "./utils";

type RawTemplate = string;
type Template = (context: any) => Node;
export type EvalContext = { [key: string]: any };

interface CompilationCtxt {
  nextID: number;
  code: string[];
  variables: { [key: string]: any };
  mainNodes: string[];
}

// ACTIONS_PRECEDENCE: 'foreach,if,elif,else,call,set,tag,esc,raw,js,debug,log'.split(','),

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
    const template =
      name in this.templates
        ? this.templates[name]
        : this._compileTemplate(name);
    return template(context);
  }

  renderToString(name: string, context: EvalContext = {}): string {
    const node = this.render(name, context);
    if (node.nodeType === 3) {
      return node.textContent!;
    } else {
      return (<HTMLElement>node).outerHTML;
    }
  }

  _compileTemplate(name: string): Template {
    const rawTemplate = this.rawTemplates[name];
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawTemplate, "text/xml");
    if (!doc.firstChild) {
      throw new Error("Invalid template (should not be empty)");
    }
    if (doc.firstChild.nodeName === "parsererror") {
      throw new Error("Invalid XML in template");
    }
    const ctx: CompilationCtxt = {
      code: [],
      nextID: 1,
      mainNodes: [],
      variables: {}
    };

    const nodeID = this._compileNode(<Element>doc.firstChild, undefined, ctx);
    if (nodeID) {
      ctx.mainNodes.push(`_${nodeID}`);
    } else {
      ctx.mainNodes.push(`_1`);
    }
    if (ctx.mainNodes.length === 1) {
      ctx.code.push(`return ${ctx.mainNodes[0]}`);
    }
    const functionCode = ctx.code.join(";\n");
    console.log(`Template: ${rawTemplate}\nCompiled code:\n` + functionCode);
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
   * @param {CompilationCtxt} ctx note that it is modified!
   * @returns {number} The id of the generated node
   */
  _compileNode(
    node: Element,
    parentID: number | undefined,
    ctx: CompilationCtxt
  ): number | undefined {
    let nodeID: number | undefined;

    // t-set
    if (node.attributes.hasOwnProperty("t-set")) {
      const variable = node.getAttribute("t-set")!;
      let value = node.getAttribute("t-value")!;
      if (!value) {
        value = `"${node.textContent!}"`;
      }
      ctx.variables[variable] = value;
      return;
    }

    if (node.nodeName === "t") {
      this._compileNodeList(parentID, node.childNodes, ctx);
    } else {
      nodeID = this._compileGenericNode(node, parentID, ctx);
    }

    // t-esc
    if (node.attributes.hasOwnProperty("t-esc")) {
      const value = node.getAttribute("t-esc")!;
      const textNodeID = this._makeTextNode(value, true, ctx);
      if (nodeID) {
        ctx.code.push(`_${nodeID}.appendChild(_${textNodeID})`);
      }
    }

    // t-raw
    if (node.attributes.hasOwnProperty("t-raw")) {
      const value = node.getAttribute("t-raw")!;
      const textNodeID = this._makeTextNode(value, false, ctx);
      if (nodeID) {
        ctx.code.push(`_${nodeID}.appendChild(_${textNodeID})`);
      }
    }

    return nodeID;
  }

  _compileGenericNode(
    node: Element,
    parentID: number | undefined,
    ctx: CompilationCtxt
  ): number {
    const nodeID = ctx.nextID++;
    ctx.code.push(
      `let _${nodeID} = document.createElement('${node.nodeName}')`
    );
    this._compileNodeList(nodeID, node.childNodes, ctx);
    return nodeID;
  }

  _compileNodeList(
    parentID: number | undefined,
    nodeList: NodeListOf<ChildNode>,
    ctx: CompilationCtxt
  ) {
    for (let child of Array.from(nodeList)) {
      if (child.nodeType === 3) {
        // text node
        ctx.code.push(
          `_${parentID}.appendChild(document.createTextNode('${
            child.textContent
          }'))`
        );
      } else if (child.nodeType === 1) {
        // node type
        const childID = this._compileNode(<Element>child, parentID, ctx);
        if (childID) {
          ctx.code.push(`_${parentID}.appendChild(_${childID})`);
        }
      }
    }
  }

  _makeTextNode(value: string, escape: boolean, ctx: CompilationCtxt): number {
    let text = value;
    if (value[0] !== '"' && value[0] !== "'") {
      if (value in ctx.variables) {
        text = ctx.variables[value];
      } else {
        text = `context["${value}"]`;
      }
    }
    if (escape) {
      text = `this.escape(${text})`;
    }

    const nodeID = ctx.nextID++;
    ctx.code.push(`let _${nodeID} = document.createTextNode(${text})`);
    return nodeID;
  }
}
