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
 * @fileoverview Display - CSS Display Module
 */
import * as Css from "./css";

export const FLOW_ROOT_ATTR = "data-vivliostyle-flow-root";

export function isFlowRoot(element: Element): boolean {
  return element.getAttribute(FLOW_ROOT_ATTR) === "true";
}

/**
 * 'Blockify' a display value.
 * cf. https://drafts.csswg.org/css-display/#transformations
 *     https://drafts.csswg.org/css2/visuren.html#dis-pos-flo
 */
export function blockify(display: Css.Ident): Css.Ident {
  const displayStr = display?.toString() || "block";
  let blockifiedStr: string;
  switch (displayStr) {
    case "inline-flex":
      blockifiedStr = "flex";
      break;
    case "inline-grid":
      blockifiedStr = "grid";
      break;
    case "inline-table":
      blockifiedStr = "table";
      break;
    case "inline":
    case "table-row-group":
    case "table-column":
    case "table-column-group":
    case "table-header-group":
    case "table-footer-group":
    case "table-row":
    case "table-cell":
    case "table-caption":
    case "inline-block":
      blockifiedStr = "block";
      break;
    default:
      blockifiedStr = displayStr;
  }
  return Css.getName(blockifiedStr);
}

/**
 * Judge if the generated box is absolutely positioned.
 */
export function isAbsolutelyPositioned(position: Css.Val): boolean {
  return position === Css.ident.absolute || position === Css.ident.fixed;
}

/**
 * Check if the position value is 'running()'.
 * https://drafts.csswg.org/css-gcpm/#running-elements
 */
export function isRunning(position: Css.Val): boolean {
  return position instanceof Css.Func && position.name === "running";
}

/**
 * Get computed values of display, position and float.
 * cf. https://drafts.csswg.org/css-display/#transformations
 *     https://drafts.csswg.org/css2/visuren.html#dis-pos-flo
 */
export function getComputedDisplayValue(
  display: Css.Ident,
  position: Css.Ident,
  float: Css.Val,
  isRoot: boolean,
): { display: Css.Ident; position: Css.Ident; float: Css.Val } {
  if (display === Css.ident.none) {
    // no need to convert values when 'display' is 'none'
  } else if (isAbsolutelyPositioned(position)) {
    float = Css.ident.none;
    display = blockify(display);
  } else if (
    (float && float !== Css.ident.none && !Css.isDefaultingValue(float)) ||
    isRoot
  ) {
    display = blockify(display);
  }
  return { display, position, float };
}

/**
 * Judges if the generated box is block.
 */
export function isBlock(
  display: Css.Ident,
  position: Css.Ident,
  float: Css.Val,
  isRoot: boolean,
): boolean {
  return (
    getComputedDisplayValue(display, position, float, isRoot).display ===
    Css.ident.block
  );
}

export function isInlineLevel(display: Css.Ident | string): boolean {
  switch (display.toString()) {
    case "inline":
    case "inline-block":
    case "inline-list-item":
    case "inline-flex":
    case "inline-grid":
    case "ruby":
    case "inline-table":
      return true;
    default:
      return false;
  }
}

export function isRubyInternalDisplay(display: Css.Ident | string): boolean {
  switch (display.toString()) {
    case "ruby-base":
    case "ruby-text":
    case "ruby-base-container":
    case "ruby-text-container":
      return true;
    default:
      return false;
  }
}

/**
 * Judges if the generated box establishes a new block formatting context.
 */
export function establishesBFC(
  display: Css.Ident,
  position: Css.Ident,
  float: Css.Val,
  overflow: Css.Ident,
  writingMode?: Css.Ident,
  parentWritingMode?: Css.Ident,
  isFlowRoot?: boolean,
): boolean {
  writingMode = writingMode || parentWritingMode || Css.ident.horizontal_tb;
  return (
    !!isFlowRoot ||
    (!!float && float !== Css.ident.none && !Css.isDefaultingValue(float)) ||
    isAbsolutelyPositioned(position) ||
    display === Css.ident.inline_block ||
    display === Css.ident.table_cell ||
    display === Css.ident.table_caption ||
    display == Css.ident.flex ||
    display == Css.ident.grid ||
    display == Css.ident.flow_root ||
    ((display === Css.ident.block || display === Css.ident.list_item) &&
      !!overflow &&
      overflow !== Css.ident.visible &&
      overflow !== Css.ident.clip &&
      !Css.isDefaultingValue(overflow)) ||
    (!!parentWritingMode && writingMode !== parentWritingMode)
  );
}

/**
 * Judges if the generated box establishes a containing block for descendant
 * boxes with 'position: absolute'.
 */
export function establishesCBForAbsolute(position: Css.Ident): boolean {
  return (
    position === Css.ident.relative ||
    position === Css.ident.absolute ||
    position === Css.ident.fixed
  );
}
