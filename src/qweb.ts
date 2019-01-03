type RawTemplate = string;
type Template = (context: any) => HTMLElement;

interface CompilationCtxt {
  nextID: number;
  code: string[];
}

/**
 * Template rendering engine
 */
export default class QWeb {
  rawTemplates: { [name: string]: RawTemplate } = {};
  templates: { [name: string]: Template } = {};

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
  render(name: string, context: any = {}): HTMLElement {
    const template =
      name in this.templates
        ? this.templates[name]
        : this._compileTemplate(name);
    return template(context);
  }

  _compileTemplate(name: string): Template {
    const rawTemplate = this.rawTemplates[name];
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawTemplate, "text/xml");
    if (!doc.firstChild) {
      throw new Error("invalid template");
    }
    const ctx: CompilationCtxt = {
      code: [],
      nextID: 1
    };

    this._compileNode(doc.firstChild, ctx);
    ctx.code.push("return _1");
    const functionCode = ctx.code.join(";");
    const template: Template = new Function(
      "context",
      functionCode
    ) as Template;
    this.templates[name] = template;
    return template;
  }

  _compileNode(node: ChildNode, ctx: CompilationCtxt) {
    const nodeID = ctx.nextID++;
    ctx.code.push(
      `let _${nodeID} = document.createElement('${node.nodeName}')`
    );
    for (let child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        // text node
        ctx.code.push(
          `_${nodeID}.appendChild(document.createTextNode('${
            child.textContent
          }'))`
        );
      }
    }
  }
}
