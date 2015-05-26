/**
 * Simple include()
 *
 * @return {string} The HTML output.
 */
function include (filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .getContent();
}