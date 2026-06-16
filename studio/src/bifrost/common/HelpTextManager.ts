import matter from 'gray-matter';

type HelpText = {
  markdown: string;
  metadata: { [key: string]: any };
};
type HelpTextMap = { [helpTextId: string]: HelpText };
type HelpTextsAsObject = { [helpTextId: string]: string };

type MarkdownContentWithOptionalFrontmatter = string | { default: string };

/**
 * Holds all help texts viewable via Bifrost.
 *
 * Registering a help text under an ID then works like this:
 *
 *    // help texts are just markdown formatted strings:
 *    bifrost.helpTexts.registerHelpText('foo/bar', "# Welcome\n\nThis is a markdown help text.")
 *
 *    // Thanks to Webpack, help texts can be loaded using `require`:
 *    bifrost.helpTexts.registerHelpText('foo/bar', require('my-plugin/foo/bar.md'))
 *
 * The corresponding markdown file `bar.md` might look like this:
 *
 *    ---
 *    title: "Help Texts 101"
 *    ---
 *
 *    # Welcome
 *
 *    This is a markdown help text.
 *
 * Retrieving the help texts is as easy:
 *
 *    > bifrost.helpTexts.getHelpText('foo/bar')
 *    {markdown: "# Welcome\n\nThis is a markdown help text.", metadata: {title: "Help Texts 101"}}
 */
export class HelpTextManager {
  private texts: HelpTextMap = {};

  /**
   * Registers given `markdownContentWithOptionalFrontmatter` with the given `helpTextId`.
   *
   *    bifrost.helpTexts.registerHelpText('foo/bar', require('something-that-returns-a-string'))
   *
   * When using Webpack, you can utilize `file-loader` to be able to require Markdown files directly:
   *
   *    bifrost.helpTexts.registerHelpText('foo/bar', require('my-plugin/foo/bar.md'))
   *
   */
  registerHelpText(
    helpTextId: string,
    markdownContentWithOptionalFrontmatter: MarkdownContentWithOptionalFrontmatter,
  ): void {
    if (this.texts[helpTextId] != null) {
      throw new Error(`Help text already registered: ${helpTextId}`);
    }

    const markdownContentWithOptionalFrontmatterAsString =
      typeof markdownContentWithOptionalFrontmatter === 'string'
        ? markdownContentWithOptionalFrontmatter
        : markdownContentWithOptionalFrontmatter.default;

    const contentWithFrontmatter = matter(markdownContentWithOptionalFrontmatterAsString);
    this.texts[helpTextId] = { metadata: contentWithFrontmatter.data, markdown: contentWithFrontmatter.content };
  }

  /**
   * Works like `registerHelpText`, but does allow the registration of multiple help texts at once.
   *
   *      bifrost.helpTexts.registerHelpTexts({
   *        'foo/bar': require('my-plugin/foo/bar.md'),
   *        'baz': require('my-plugin/baz.md')
   *      })
   *
   */
  registerHelpTexts(helpTextsAsObject: HelpTextsAsObject): void {
    for (const helpTextId of Object.keys(helpTextsAsObject)) {
      this.registerHelpText(helpTextId, helpTextsAsObject[helpTextId]);
    }
  }

  /**
   * Checks if a Help text with the given `helpTextId` exists.
   */
  helpTextIsRegistered(helpTextId: string): boolean {
    return this.texts[helpTextId] != null;
  }

  /**
   * Returns the help text for the given `helpTextId`.
   */
  getHelpText(helpTextId: string): HelpText {
    const helpText = this.texts[helpTextId];
    if (helpText == null) {
      throw new Error(`Could not find help text with id: ${helpTextId}`);
    }
    return helpText;
  }
}
