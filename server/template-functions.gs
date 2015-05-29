/**
 * Simple include()
 *
 * @return {string} The HTML output.
 */
function include (filename, vars) {
  var t = HtmlService.createTemplateFromFile(filename);
  t.vars = vars;
  return t.evaluate()
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .getContent();
}