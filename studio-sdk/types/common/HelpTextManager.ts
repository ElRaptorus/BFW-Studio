declare type HelpText = {
  markdown: string;
  metadata: {
    [key: string]: any;
  };
};
declare type HelpTextsAsObject = {
  [helpTextId: string]: string;
};
declare type MarkdownContentWithOptionalFrontmatter =
  | string
  | {
      default: string;
    };
/**
 * Holds all help texts viewable via Studio.
 *
 * Registering a help text under an ID then works like this:
 *
 *    // help texts are just markdown formatted strings:
 *    studio.helpTexts.registerHelpText('foo/bar', "# Welcome\n\nThis is a markdown help text.")
 *
 *    // Thanks to Webpack, help texts can be loaded using `require`:
 *    studio.helpTexts.registerHelpText('foo/bar', require('my-plugin/foo/bar.md'))
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
 *    > studio.helpTexts.getHelpText('foo/bar')
 *    {markdown: "# Welcome\n\nThis is a markdown help text.", metadata: {title: "Help Texts 101"}}
 */
export declare class HelpTextManager {
  /**
   * Registers given `markdownContentWithOptionalFrontmatter` with the given `helpTextId`.
   *
   *    studio.helpTexts.registerHelpText('foo/bar', require('something-that-returns-a-string'))
   *
   * When using Webpack, you can utilize `file-loader` to be able to require Markdown files directly:
   *
   *    studio.helpTexts.registerHelpText('foo/bar', require('my-plugin/foo/bar.md'))
   *
   */
  registerHelpText(
    helpTextId: string,
    markdownContentWithOptionalFrontmatter: MarkdownContentWithOptionalFrontmatter,
  ): void;

  /**
   * Works like `registerHelpText`, but does allow the registration of multiple help texts at once.
   *
   *    studio.helpTexts.registerHelpTexts({
   *      'foo/bar': require('my-plugin/foo/bar.md'),
   *      'baz': require('my-plugin/baz.md')
   *    })
   *
   */

  registerHelpTexts(helpTextsAsObject: HelpTextsAsObject): void;

  /**
   * Checks if a Help text with the given `helpTextId` exists.
   */
  helpTextIsRegistered(helpTextId: string): boolean;

  /**
   * Returns the help text for the given `helpTextId`.
   */
  getHelpText(helpTextId: string): HelpText;
}
export {};
