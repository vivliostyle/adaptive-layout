/**
 * Copyright 2016 Daishinsha Inc.
 * Copyright 2019 Vivliostyle Foundation
 *
 * Vivliostyle.js is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Vivliostyle.js is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Vivliostyle.js.  If not, see <http://www.gnu.org/licenses/>.
 *
 * @fileoverview Plugin - Plugin mechanism
 */
import * as Base from "./base";
import * as Css from "./css";
import * as LayoutProcessor from "./layout-processor";
import * as Logging from "./logging";
import * as Task from "./task";
import { Layout, Vtree } from "./types";

/**
 * Type of implemented hooks.
 * @enum {string}
 */
export enum HOOKS {
  /**
   * Called when a single property declaration is parsed.
   *
   * The hook is called with an object with the following properties:
   *   {string} name: Property name
   *   {!Css.Val} value: Property value
   *   {boolean} important: Whether '!important' flag is present or not
   * Functions called by this hook are expected to return a value with the same
   * type as the above. The declaration is then replaced by the returned value.
   *
   * Note that a shorthand declaration is not directly passed to this hook.
   * After the shorthand declaration is interpreted and broken into
   * non-shorthand declarations, the hook is called for each of the
   * non-shorthand declarations.
   */
  SIMPLE_PROPERTY = "SIMPLE_PROPERTY",

  /**
   * Called when a single document (i.e. a single spine item) has been fetched,
   * before parsing.
   *
   * The hook is called with the Document object.
   */
  PREPROCESS_SINGLE_DOCUMENT = "PREPROCESS_SINGLE_DOCUMENT",

  /**
   * Called before creating a text node for modifying a text content.
   *
   * The hook is called with an object with the following properties:
   *   {Vtree.NodeContext} nodeContext
   *   {string} sourceTextContent
   *
   * Functions called by this hook are expected to return a
   * Task.Result.<string>. The text content is then replaced by the
   * returned value.
   */
  PREPROCESS_TEXT_CONTENT = "PREPROCESS_TEXT_CONTENT",

  /**
   * Called before creating a element for modifying a element style.
   *
   * The hook is called with an object with the following properties:
   *   {Vtree.NodeContext} nodeContext
   *   {!Object} style
   */
  PREPROCESS_ELEMENT_STYLE = "PREPROCESS_ELEMENT_STYLE",

  /**
   * Called before geting CssCascade.polyfilledInheritedProps.
   *
   * The hook return a array of polyfilled inherited property name.
   */
  POLYFILLED_INHERITED_PROPS = "POLYFILLED_INHERITED_PROPS",

  /**
   * Called when a Viewer is configured.
   *
   * The hook is called with an object with the following properties:
   *  {Base.JSON} command
   */
  CONFIGURATION = "CONFIGURATION",

  /**
   * Called when resolving a text node breaker
   * which detects an acceptable breakpoint and break text node at this point.
   *
   * The hook is called with an object with the following properties:
   *  {Vtree.NodeContext} nodeContext
   *
   * Functions called by this hook are expected to
   * return an instnce of {Layout.TextNodeBreaker} or null.
   */
  RESOLVE_TEXT_NODE_BREAKER = "RESOLVE_TEXT_NODE_BREAKER",

  /**
   * Called when resolving a formatting context.
   *
   * The hook is called with the following parameters:
   *   nodeContext: a NodeContext object
   *   firstTime: a boolean flag representing whether this node is encountered
   * for the first time or not display: an Css.Ident value representing
   * 'display' value of the node position: an Css.Ident value representing
   * 'position' value of the node float: an Css.Ident value representing
   * 'float' value of the node isRoot: a boolean flag representing whether this
   * node is a root (of a flow) or not Functions called by this hook are
   * expected to return a formatting context for the NodeContext.
   */
  RESOLVE_FORMATTING_CONTEXT = "RESOLVE_FORMATTING_CONTEXT",

  /**
   * Called when resolving a layout processor (LayoutProcessor) for
   * a formatting context.
   *
   * The hook is called with a formatting context
   * (Vtree.FormattingContext). Functions called by this hook are expected
   * to return a layout processor corresponding to the formatting context.
   */
  RESOLVE_LAYOUT_PROCESSOR = "RESOLVE_LAYOUT_PROCESSOR",

  /**
   * Called after laid out a block contents.
   *
   * The hook is called with an object with the following properties:
   *  {Vtree.NodeContext} nodeContext
   *  {Array.<Vtree.NodeContext>} checkPoints
   *  {Layout.Column} column
   */
  POST_LAYOUT_BLOCK = "POST_LAYOUT_BLOCK",
}

export type PreProcessSingleDocumentHook = (p1: Document) => any;

export type PreProcessTextContentHook = (
  p1: Vtree.NodeContext,
  p2: string,
) => Task.Result<string>;

export type PreProcessElementStyleHook = (
  p1: Vtree.NodeContext,
  p2: object,
) => void;

export type PolyfilledInheritedPropsHook = () => string[];

export type ConfigurationHook = (p1: Base.JSON) => {
  needResize: boolean | null | undefined;
  needRefresh: boolean | null | undefined;
};

export type ResolveTextNodeBreakerHook = (
  p1: Vtree.NodeContext,
) => Layout.TextNodeBreaker;

export type ResolveFormattingContextHook = (
  p1: Vtree.NodeContext,
  p2: boolean,
  p3: Css.Ident,
  p4: Css.Ident,
  p5: Css.Val,
  p6: boolean,
) => Vtree.FormattingContext;

export type ResolveLayoutProcessorHook = (
  p1: Vtree.FormattingContext,
) => LayoutProcessor.LayoutProcessor;

export type PostLayoutBlockHook = (
  p1: Vtree.NodeContext,
  p2: Vtree.NodeContext[],
  p3: Layout.Column,
) => void;

const hooks = {};

/**
 * Register a function to a hook with the specified name.
 * The registered function is called at appropriate timings by the core code.
 * Arguments passed to the function depend on the hook.
 * When multiple functions are registered, they are called by the order in which
 * they are registered.
 * @param name Name of the hook.
 * @param fn Function to be registered to the hook.
 * @param atFirst If true, the function is registered at the first of the hook array.
 */
export function registerHook(
  name: string,
  fn: (...p1) => any,
  atFirst?: boolean,
): void {
  if (!HOOKS[name]) {
    Logging.logger.warn(new Error(`Skipping unknown plugin hook '${name}'.`));
  } else {
    let hooksForName = hooks[name];
    if (!hooksForName) {
      hooksForName = hooks[name] = [];
    }
    if (atFirst) {
      hooksForName.unshift(fn);
    } else {
      hooksForName.push(fn);
    }
  }
}

/**
 * Remove a function already registered to the specified name.
 * Note that even if the same function are registered multiple times, this
 * method removes only the first one.
 * @param name Name of the hook.
 * @param fn Function to be removed from the hook.
 */
export function removeHook(name: string, fn: (...p1) => any): void {
  if (!HOOKS[name]) {
    Logging.logger.warn(new Error(`Ignoring unknown plugin hook '${name}'.`));
  } else {
    const hooksForName = hooks[name];
    if (hooksForName) {
      const index = hooksForName.indexOf(fn);
      if (index >= 0) {
        hooksForName.splice(index, 1);
      }
    }
  }
}

/**
 * Get all hooks registered to the specified name.
 * This method is for internal use (from the core code).
 */
export function getHooksForName(name: string): ((...p1) => any)[] {
  const hooksForName = hooks[name];
  return hooksForName || [];
}

/**
 * Pubilc members of the bundled library.
 */
export const plugin = {
  registerHook,
  removeHook,
};
