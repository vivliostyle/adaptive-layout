/**
 * Copyright 2013 Google, Inc.
 * Copyright 2015 Daishinsha Inc.
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
 * @fileoverview Layout - Fills a column with styled content.
 * This file does not communicate with the styling system directly.
 * Instead it goes through the layout interface that gives it one view tree
 * node at a time.
 */
import * as LayoutRetryers from "./layout-retryers";
import * as Asserts from "./asserts";
import * as Shared from "./shared";
import * as Sizing from "./sizing";
import * as Break from "./break";
import * as Logging from "./logging";
import * as Diff from "./diff";
import * as Base from "./base";
import * as BreakPosition from "./break-position";
import * as Css from "./css";
import * as GeometryUtil from "./geometry-util";
import * as LayoutHelper from "./layout-helper";
import * as LayoutProcessor from "./layout-processor";
import * as PageFloats from "./page-floats";
import * as Plugin from "./plugin";
import * as Matchers from "./matchers";
import * as PseudoElement from "./pseudo-element";
import * as Task from "./task";
import * as Vgen from "./vgen";
import * as VtreeImpl from "./vtree";
import {
  FragmentLayoutConstraintType,
  Layout,
  RepetitiveElement,
  Selectors,
  Table,
  Vtree,
} from "./types";

export const isInstanceOfAfterIfContinuesLayoutConstraint =
  Selectors.isInstanceOfAfterIfContinuesLayoutConstraint;
export const registerFragmentIndex =
  Matchers.NthFragmentMatcher.registerFragmentIndex;
export const clearFragmentIndices =
  Matchers.NthFragmentMatcher.clearFragmentIndices;

export class AfterIfContinues implements Selectors.AfterIfContinues {
  constructor(
    public readonly sourceNode: Element,
    public readonly styler: PseudoElement.PseudoelementStyler,
  ) {}

  createElement(
    column: Layout.Column,
    parentNodeContext: Vtree.NodeContext,
  ): Task.Result<Element> {
    const doc = parentNodeContext.viewNode.ownerDocument;
    const viewRoot = doc.createElement("div");
    const pseudoColumn = new PseudoColumn(column, viewRoot, parentNodeContext);
    const initialPageBreakType = pseudoColumn.getColumn().pageBreakType;
    pseudoColumn.getColumn().pageBreakType = null;
    return pseudoColumn
      .layout(this.createNodePositionForPseudoElement(), true)
      .thenAsync(() => {
        this.styler.contentProcessed["after-if-continues"] = false;
        pseudoColumn.getColumn().pageBreakType = initialPageBreakType;
        const pseudoElement = viewRoot.firstChild as Element;
        Base.setCSSProperty(pseudoElement, "display", "block");
        return Task.newResult(pseudoElement);
      });
  }

  private createNodePositionForPseudoElement(): Vtree.ChunkPosition {
    const sourceNode = PseudoElement.document.createElementNS(
      Base.NS.XHTML,
      "div",
    );
    PseudoElement.setPseudoName(sourceNode, "after-if-continues");
    const shadowContext = this.createShadowContext(sourceNode);
    const step = {
      node: sourceNode,
      shadowType: shadowContext.type,
      shadowContext,
      nodeShadow: null,
      shadowSibling: null,
    };
    const nodePosition = {
      steps: [step],
      offsetInNode: 0,
      after: false,
      preprocessedTextContent: null,
    };
    return new VtreeImpl.ChunkPosition(nodePosition as any);
  }

  private createShadowContext(root: Element): Vtree.ShadowContext {
    return new VtreeImpl.ShadowContext(
      this.sourceNode,
      root,
      null,
      null,
      null,
      Vtree.ShadowType.ROOTED,
      this.styler,
    );
  }
}

export class AfterIfContinuesLayoutConstraint
  implements Selectors.AfterIfContinuesLayoutConstraint
{
  flagmentLayoutConstraintType: FragmentLayoutConstraintType =
    "AfterIfContinue";

  constructor(
    public nodeContext: Vtree.NodeContext,
    public afterIfContinues: Selectors.AfterIfContinues,
    public pseudoElementHeight: number,
  ) {}

  /** @override */
  allowLayout(
    nodeContext: Vtree.NodeContext,
    overflownNodeContext: Vtree.NodeContext,
    column: Layout.Column,
  ): boolean {
    if (
      (overflownNodeContext && !nodeContext) ||
      (nodeContext && nodeContext.overflow)
    ) {
      return false;
    } else {
      return true;
    }
  }

  /** @override */
  nextCandidate(nodeContext: Vtree.NodeContext): boolean {
    return false;
  }

  /** @override */
  postLayout(
    allowed: boolean,
    positionAfter: Vtree.NodeContext,
    initialPosition: Vtree.NodeContext,
    column: Layout.Column,
  ) {}

  /** @override */
  finishBreak(
    nodeContext: Vtree.NodeContext,
    column: Layout.Column,
  ): Task.Result<boolean> {
    if (!this.getRepetitiveElements().affectTo(nodeContext)) {
      return Task.newResult(true);
    }
    return this.afterIfContinues
      .createElement(column, this.nodeContext)
      .thenAsync((element) => {
        this.nodeContext.viewNode.appendChild(element);
        return Task.newResult(true);
      });
  }

  getRepetitiveElements() {
    return new AfterIfContinuesElementsOffset(
      this.nodeContext,
      this.pseudoElementHeight,
    );
  }

  /** @override */
  equalsTo(constraint: Layout.FragmentLayoutConstraint): boolean {
    if (!(constraint instanceof AfterIfContinuesLayoutConstraint)) {
      return false;
    }
    return (
      this.afterIfContinues ==
      (constraint as AfterIfContinuesLayoutConstraint).afterIfContinues
    );
  }

  /** @override */
  getPriorityOfFinishBreak(): number {
    return 9;
  }
}

export class AfterIfContinuesElementsOffset
  implements Selectors.AfterIfContinuesElementsOffset
{
  constructor(
    public nodeContext,
    public pseudoElementHeight,
  ) {}

  /** @override */
  calculateOffset(nodeContext: Vtree.NodeContext): number {
    if (!this.affectTo(nodeContext)) {
      return 0;
    }
    return this.pseudoElementHeight;
  }

  /** @override */
  calculateMinimumOffset(nodeContext: Vtree.NodeContext): number {
    return this.calculateOffset(nodeContext);
  }

  affectTo(nodeContext: Vtree.NodeContext): boolean {
    if (!nodeContext) {
      return false;
    }
    const sourceNode = nodeContext.shadowContext
      ? nodeContext.shadowContext.owner
      : nodeContext.sourceNode;
    if (sourceNode === this.nodeContext.sourceNode) {
      return !!nodeContext.after;
    }
    for (let n = sourceNode.parentNode; n; n = n.parentNode) {
      if (n === this.nodeContext.sourceNode) {
        return true;
      }
    }
    return false;
  }
}

function processAfterIfContinuesOfNodeContext(
  nodeContext: Vtree.NodeContext,
  column: Layout.Column,
): Task.Result<Vtree.NodeContext> {
  if (
    !nodeContext ||
    !nodeContext.afterIfContinues ||
    nodeContext.after ||
    column.isFloatNodeContext(nodeContext)
  ) {
    return Task.newResult(nodeContext);
  }
  const afterIfContinues = nodeContext.afterIfContinues;
  return afterIfContinues
    .createElement(column, nodeContext)
    .thenAsync((pseudoElement) => {
      Asserts.assert(nodeContext !== null);
      const pseudoElementHeight = calculatePseudoElementHeight(
        nodeContext,
        column,
        pseudoElement,
      );
      column.fragmentLayoutConstraints.push(
        new AfterIfContinuesLayoutConstraint(
          nodeContext as Vtree.NodeContext,
          afterIfContinues,
          pseudoElementHeight,
        ),
      );
      return Task.newResult(nodeContext);
    });
}

export function processAfterIfContinues(
  result: Task.Result<Vtree.NodeContext>,
  column: Layout.Column,
): Task.Result<Vtree.NodeContext> {
  return result.thenAsync((nodeContext) =>
    processAfterIfContinuesOfNodeContext(nodeContext, column),
  );
}

export function processAfterIfContinuesOfAncestors(
  nodeContext: Vtree.NodeContext,
  column: Layout.Column,
): Task.Result<boolean> {
  const frame: Task.Frame<boolean> = Task.newFrame(
    "processAfterIfContinuesOfAncestors",
  );
  let current: Vtree.NodeContext = nodeContext;
  frame
    .loop(() => {
      if (current !== null) {
        const result = processAfterIfContinuesOfNodeContext(current, column);
        current = current.parent;
        return result.thenReturn(true);
      } else {
        return Task.newResult(false);
      }
    })
    .then(() => {
      frame.finish(true);
    });
  return frame.result();
}

export function calculatePseudoElementHeight(
  nodeContext: Vtree.NodeContext,
  column: Layout.Column,
  pseudoElement: Element,
): number {
  const parentNode = nodeContext.viewNode as Element;
  parentNode.appendChild(pseudoElement);
  const height = LayoutHelper.getElementHeight(
    pseudoElement,
    column,
    nodeContext.vertical,
  );
  parentNode.removeChild(pseudoElement);
  return height;
}

/**
 * Represents a constraint on layout
 */
export type LayoutConstraint = Layout.LayoutConstraint;

/**
 * Represents a constraint that allows layout if all the constraints it contains
 * allow layout.
 */
export class AllLayoutConstraint implements LayoutConstraint {
  constructor(public readonly constraints: LayoutConstraint[]) {}

  /** @override */
  allowLayout(nodeContext: Vtree.NodeContext): boolean {
    return this.constraints.every((c) => c.allowLayout(nodeContext));
  }
}

/**
 * Represents constraints on laying out fragments
 */
export type FragmentLayoutConstraint = Layout.FragmentLayoutConstraint;

export type BreakPositionAndNodeContext = Layout.BreakPositionAndNodeContext;

/**
 * Potential breaking position inside CSS box (between lines).
 * @param checkPoints array of breaking points for breakable block
 */
export class BoxBreakPosition
  extends BreakPosition.AbstractBreakPosition
  implements Layout.BoxBreakPosition
{
  private alreadyEvaluated: boolean = false;
  breakNodeContext: Vtree.NodeContext = null;

  constructor(
    public readonly checkPoints: Vtree.NodeContext[],
    public readonly penalty: number,
  ) {
    super();
  }

  override findAcceptableBreak(
    column: Column,
    penalty: number,
  ): Vtree.NodeContext {
    if (penalty < this.getMinBreakPenalty()) {
      return null;
    }
    if (!this.alreadyEvaluated) {
      this.breakNodeContext = column.findBoxBreakPosition(this, penalty > 0);
      this.alreadyEvaluated =
        !!this.breakNodeContext || penalty > 0 || !!column.pseudoParent;
    }
    return this.breakNodeContext;
  }

  override getMinBreakPenalty(): number {
    return this.penalty;
  }

  override getNodeContext(): Vtree.NodeContext {
    return this.alreadyEvaluated
      ? this.breakNodeContext
      : this.checkPoints[this.checkPoints.length - 1];
  }
}

export function validateCheckPoints(checkPoints: Vtree.NodeContext[]): void {
  for (let i = 1; i < checkPoints.length; i++) {
    const cp0 = checkPoints[i - 1];
    const cp1 = checkPoints[i];
    if (cp0 === cp1) {
      Logging.logger.warn("validateCheckPoints: duplicate entry");
    } else if (cp0.boxOffset >= cp1.boxOffset) {
      Logging.logger.warn("validateCheckPoints: incorrect boxOffset");
    } else if (cp0.sourceNode == cp1.sourceNode) {
      if (cp1.after) {
        if (cp0.after) {
          Logging.logger.warn("validateCheckPoints: duplicate after points");
        }
      } else {
        if (!cp0.after) {
          if (
            cp1.boxOffset - cp0.boxOffset !=
            cp1.offsetInNode - cp0.offsetInNode
          ) {
            Logging.logger.warn(
              "validateCheckPoints: boxOffset inconsistent with offsetInNode",
            );
          }
        }
      }
    }
  }
}

export class Column extends VtreeImpl.Container implements Layout.Column {
  last: Node;
  viewDocument: Document;
  flowRootFormattingContext: Vtree.FormattingContext = null;
  isFloat: boolean = false;
  isFootnote: boolean = false;
  startEdge: number = 0;
  endEdge: number = 0;
  beforeEdge: number = 0;
  afterEdge: number = 0;
  footnoteEdge: number = 0;
  box: GeometryUtil.Rect = null;
  chunkPositions: Vtree.ChunkPosition[] = null;
  bands: GeometryUtil.Band[] = null;
  overflown: boolean = false;
  breakPositions: BreakPosition.BreakPosition[] = null;
  pageBreakType: string | null = null;
  forceNonfitting: boolean = true;
  leftFloatEdge: number = 0; // bottom of the bottommost left float
  rightFloatEdge: number = 0; // bottom of the bottommost right float
  bottommostFloatTop: number = 0; // Top of the bottommost float
  stopAtOverflow: boolean = true;
  lastAfterPosition: Vtree.NodePosition | null = null;
  fragmentLayoutConstraints: FragmentLayoutConstraint[] = [];
  pseudoParent: Column = null;
  nodeContextOverflowingDueToRepetitiveElements: Vtree.NodeContext | null =
    null;
  blockDistanceToBlockEndFloats: number = NaN;
  breakAtTheEdgeBeforeFloat: string | null = null;

  constructor(
    element: Element,
    public layoutContext: Vtree.LayoutContext,
    public clientLayout: Vtree.ClientLayout,
    public readonly layoutConstraint: LayoutConstraint,
    public readonly pageFloatLayoutContext: PageFloats.PageFloatLayoutContext,
  ) {
    super(element);
    this.last = element.lastChild;
    this.viewDocument = element.ownerDocument;
    pageFloatLayoutContext.setContainer(this);
  }

  getTopEdge(): number {
    return this.vertical
      ? this.rtl
        ? this.endEdge
        : this.startEdge
      : this.beforeEdge;
  }

  getBottomEdge(): number {
    return this.vertical
      ? this.rtl
        ? this.startEdge
        : this.endEdge
      : this.afterEdge;
  }

  getLeftEdge(): number {
    return this.vertical
      ? this.afterEdge
      : this.rtl
        ? this.endEdge
        : this.startEdge;
  }

  getRightEdge(): number {
    return this.vertical
      ? this.beforeEdge
      : this.rtl
        ? this.startEdge
        : this.endEdge;
  }

  isFloatNodeContext(nodeContext: Vtree.NodeContext): boolean {
    return !!nodeContext.floatSide && (!this.isFloat || !!nodeContext.parent);
  }

  stopByOverflow(nodeContext: Vtree.NodeContext): boolean {
    return this.stopAtOverflow && !!nodeContext && nodeContext.overflow;
  }

  isOverflown(edge: number): boolean {
    if (this.vertical) {
      return edge < this.footnoteEdge;
    } else {
      return edge > this.footnoteEdge;
    }
  }

  getExclusions(): GeometryUtil.Shape[] {
    const pageFloatExclusions =
      this.pageFloatLayoutContext.getFloatFragmentExclusions();
    return this.exclusions.concat(pageFloatExclusions);
  }

  openAllViews(position: Vtree.NodePosition): Task.Result<Vtree.NodeContext> {
    const frame: Task.Frame<Vtree.NodeContext> = Task.newFrame("openAllViews");
    const steps = position.steps;
    this.layoutContext.setViewRoot(this.element, this.isFootnote);
    let stepIndex = steps.length - 1;
    let nodeContext: Vtree.NodeContext = null;
    frame
      .loop(() => {
        while (stepIndex >= 0) {
          const prevContext = nodeContext;
          const step = steps[stepIndex];
          nodeContext = VtreeImpl.makeNodeContextFromNodePositionStep(
            step,
            prevContext,
          );
          if (
            stepIndex === steps.length - 1 &&
            !nodeContext.formattingContext
          ) {
            nodeContext.formattingContext = this.flowRootFormattingContext;
          }
          if (stepIndex == 0) {
            nodeContext.offsetInNode =
              this.calculateOffsetInNodeForNodeContext(position);
            nodeContext.after = position.after;
            nodeContext.preprocessedTextContent =
              position.preprocessedTextContent;
            if (nodeContext.after) {
              break;
            }
          }
          const r = this.layoutContext.setCurrent(
            nodeContext,
            stepIndex == 0 && nodeContext.offsetInNode == 0,
          );
          stepIndex--;
          if (r.isPending()) {
            return r;
          }
        }
        return Task.newResult(false);
      })
      .then(() => {
        Asserts.assert(nodeContext);
        frame.finish(nodeContext);
      });
    return frame.result();
  }

  calculateOffsetInNodeForNodeContext(position: Vtree.NodePosition): number {
    return position.preprocessedTextContent
      ? Diff.resolveNewIndex(
          position.preprocessedTextContent,
          position.offsetInNode,
        )
      : position.offsetInNode;
  }

  /**
   * @param count first-XXX nesting identifier
   */
  maybePeelOff(
    position: Vtree.NodeContext,
    count: number,
  ): Task.Result<Vtree.NodeContext> {
    if (
      position.firstPseudo &&
      position.inline &&
      !position.after &&
      position.firstPseudo.count == 0
    ) {
      // first char
      if (position.viewNode.nodeType != 1) {
        const text = position.viewNode.textContent;
        const r = text.match(Base.firstLetterPattern);
        let firstLetterLength = r ? r[0].length : 0;
        if (
          !r &&
          position.sourceNode?.nodeType === 3 &&
          position.sourceNode.nextSibling?.nodeType === 3 &&
          text === position.sourceNode.textContent
        ) {
          // The text '“Foo' may be split to '“' and 'Foo'
          const text2 = text + position.sourceNode.nextSibling.textContent;
          const r2 = text2.match(Base.firstLetterPattern);
          if (r2) {
            const firstLetterText = r2[0];
            firstLetterLength = firstLetterText.length;
            position.sourceNode.textContent = firstLetterText;
            position.viewNode.textContent = firstLetterText;
            position.sourceNode.nextSibling.textContent =
              text2.substr(firstLetterLength);
          }
        }
        return this.layoutContext.peelOff(position, firstLetterLength);
      }
    }
    return Task.newResult(position) as Task.Result<Vtree.NodeContext>;
  }

  /**
   * Builds the view until a CSS box edge is reached.
   * @param position start source position.
   * @param checkPoints array to append possible breaking points.
   * @return holding box edge position reached or null if the source is exhausted.
   */
  buildViewToNextBlockEdge(
    position: Vtree.NodeContext,
    checkPoints: Vtree.NodeContext[],
  ): Task.Result<Vtree.NodeContext> {
    let violateConstraint = false;
    const frame: Task.Frame<Vtree.NodeContext> = Task.newFrame(
      "buildViewToNextBlockEdge",
    );
    frame
      .loopWithFrame((bodyFrame) => {
        if (
          position.viewNode &&
          !LayoutHelper.isSpecialNodeContext(position) &&
          // Prevent breaking inside SVG etc. (Issue #1406)
          position.viewNode.parentElement?.namespaceURI === Base.NS.XHTML
        ) {
          checkPoints.push(position.copy());
        }
        this.maybePeelOff(position, 0).then((position1Param) => {
          const position1 = position1Param as Vtree.NodeContext;
          if (position1 !== position) {
            position = position1;
            if (!LayoutHelper.isSpecialNodeContext(position)) {
              checkPoints.push(position.copy());
            }
          }
          this.nextInTree(position).then((positionParam) => {
            position = positionParam as Vtree.NodeContext;
            if (!position) {
              // Exit the loop
              bodyFrame.breakLoop();
              return;
            }
            if (
              violateConstraint ||
              !this.layoutConstraint.allowLayout(position)
            ) {
              violateConstraint = true;
              position = position.modify();
              position.overflow = true;
            }
            if (
              this.isFloatNodeContext(position) &&
              // Exclude normal floats (fix for issue #611)
              (PageFloats.isPageFloat(position.floatReference) ||
                position.floatSide === "footnote")
            ) {
              this.layoutFloatOrFootnote(position).then((positionParam) => {
                position = positionParam as Vtree.NodeContext;
                if (this.pageFloatLayoutContext.isInvalidated()) {
                  position = null;
                }
                if (!position) {
                  bodyFrame.breakLoop();
                  return;
                }
                bodyFrame.continueLoop();
              });
            } else if (!position.inline) {
              // Exit the loop
              bodyFrame.breakLoop();
            } else {
              // Continue the loop
              bodyFrame.continueLoop();
            }
          });
        });
      })
      .then(() => {
        frame.finish(position);
      });
    return frame.result();
  }

  nextInTree(
    position: Vtree.NodeContext,
    atUnforcedBreak?: boolean,
  ): Task.Result<Vtree.NodeContext> {
    const cont = this.layoutContext.nextInTree(position, atUnforcedBreak);
    return processAfterIfContinues(cont, this);
  }

  /**
   * Builds the view for a single unbreakable element.
   * @param position start source position.
   * @return holding box edge position reached or null if the source is exhausted.
   */
  buildDeepElementView(
    position: Vtree.NodeContext,
  ): Task.Result<Vtree.NodeContext> {
    if (!position.viewNode) {
      return Task.newResult(position);
    }
    let checkPoints: Vtree.NodeContext[] = [];
    const sourceNode = position.sourceNode;
    const frame: Task.Frame<Vtree.NodeContext> = Task.newFrame(
      "buildDeepElementView",
    );

    // TODO: end the loop based on depth, not sourceNode comparison
    frame
      .loopWithFrame((bodyFrame) => {
        if (
          position.viewNode &&
          position.inline &&
          !LayoutHelper.isSpecialNodeContext(position)
        ) {
          checkPoints.push(position.copy());
        } else {
          if (checkPoints.length > 0) {
            this.postLayoutBlock(position, checkPoints);
          }
          checkPoints = [];
        }
        this.maybePeelOff(position, 0).then((position1Param) => {
          const position1 = position1Param as Vtree.NodeContext;
          if (position1 !== position) {
            let p = position1;
            while (p && p.sourceNode != sourceNode) {
              p = p.parent;
            }
            if (p == null) {
              // outside of the subtree
              position = position1;
              bodyFrame.breakLoop();
              return;
            }
            if (!LayoutHelper.isSpecialNodeContext(position1)) {
              checkPoints.push(position1.copy());
            }
          }
          this.nextInTree(position1).then((positionParam) => {
            position = positionParam as Vtree.NodeContext;
            if (!position || position.sourceNode == sourceNode) {
              bodyFrame.breakLoop();
            } else if (!this.layoutConstraint.allowLayout(position)) {
              position = position.modify();
              position.overflow = true;
              if (this.stopAtOverflow) {
                bodyFrame.breakLoop();
              } else {
                bodyFrame.continueLoop();
              }
            } else {
              bodyFrame.continueLoop();
            }
          });
        });
      })
      .then(() => {
        if (checkPoints.length > 0) {
          this.postLayoutBlock(position, checkPoints);
        }
        frame.finish(position);
      });
    return frame.result();
  }

  /**
   * Create a single floating element (for exclusion areas).
   * @param ref container's child to insert float before (can be null).
   * @param side float side ("left" or "right").
   * @param width float inline dimension.
   * @param height float box progression dimension.
   * @return newly created float element.
   */
  createFloat(ref: Node, side: string, width: number, height: number): Element {
    const div = this.viewDocument.createElement("div");
    if (this.vertical) {
      if (height >= this.height) {
        height -= 0.1;
      }
      if (height < 1) {
        height = 0;
      }
      Base.setCSSProperty(div, "height", `${width}px`);
      Base.setCSSProperty(div, "width", `${height}px`);
    } else {
      if (width >= this.width) {
        width -= 0.1;
      }
      if (width < 1) {
        width = 0;
      }
      Base.setCSSProperty(div, "width", `${width}px`);
      Base.setCSSProperty(div, "height", `${height}px`);
    }
    Base.setCSSProperty(div, "float", side);
    Base.setCSSProperty(div, "clear", side);

    // enable to visualize
    // Base.setCSSProperty(div, "background-color", "#50F0FF");
    this.element.insertBefore(div, ref);
    return div;
  }

  /**
   * Remove all the exclusion floats.
   */
  killFloats(): void {
    let c: Node = this.element.firstChild;
    while (c) {
      const nc = c.nextSibling;
      if (c.nodeType == 1) {
        const e = c as HTMLElement;
        const f = e.style.cssFloat;
        if (f == "left" || f == "right" || f === "none") {
          this.element.removeChild(e);
        } else {
          break;
        }
      }
      c = nc;
    }
  }

  /**
   * Create exclusion floats for a column.
   */
  createFloats(): void {
    const ref = this.element.firstChild;
    const bands = this.bands;
    const x1 = this.vertical ? this.getTopEdge() : this.getLeftEdge();
    const x2 = this.vertical ? this.getBottomEdge() : this.getRightEdge();
    let foundNonZeroWidthBand: GeometryUtil.Band = null;

    for (const band of bands) {
      const height = band.y2 - band.y1;
      band.left = this.createFloat(ref, "left", band.x1 - x1, height);
      band.right = this.createFloat(ref, "right", x2 - band.x2, height);

      // Hacky workaround for issue #1071
      // (Top page float should not absorb margin/border/padding of the block below)
      if (band.x1 < x2 && band.x2 > x1) {
        foundNonZeroWidthBand = band;
      } else if (!foundNonZeroWidthBand) {
        Base.setCSSProperty(band.right, "float", "none");
      }
    }

    if (foundNonZeroWidthBand) {
      // Update footnoteEdge (Fix for issue #1298)
      const lastBand = bands[bands.length - 1];
      const y2 = this.vertical ? -this.getLeftEdge() : this.getBottomEdge();
      if (foundNonZeroWidthBand !== lastBand && lastBand.y2 >= y2) {
        this.footnoteEdge = this.vertical
          ? -foundNonZeroWidthBand.y2
          : foundNonZeroWidthBand.y2;
      }
    }
  }

  /**
   * @param nodeContext position after the block
   * @param checkPoints array of possible breaking points.
   * @param index index of the breaking point
   * @param boxOffset box offset
   * @return edge position
   */
  calculateEdge(
    nodeContext: Vtree.NodeContext,
    checkPoints: Vtree.NodeContext[],
    index: number,
    boxOffset: number,
  ): number {
    let edge: number;
    if (nodeContext && LayoutHelper.isOrphan(nodeContext.viewNode)) {
      return NaN;
    } else if (nodeContext && nodeContext.after && !nodeContext.inline) {
      edge = LayoutHelper.calculateEdge(
        nodeContext,
        this.clientLayout,
        0,
        this.vertical,
      );
      if (!isNaN(edge)) {
        return edge;
      }
    }
    nodeContext = checkPoints[index];
    let offset = boxOffset - nodeContext.boxOffset;
    while (true) {
      edge = LayoutHelper.calculateEdge(
        nodeContext,
        this.clientLayout,
        offset,
        this.vertical,
      );
      if (!isNaN(edge)) {
        return edge;
      }
      if (offset > 0) {
        offset--;
        continue;
      }
      index--;
      if (index < 0) {
        return this.beforeEdge;
      }
      nodeContext = checkPoints[index];
      if (nodeContext.viewNode.nodeType != 1) {
        offset = nodeContext.viewNode.textContent.length;
      }
    }
  }

  /**
   * Parse CSS computed length (in pixels)
   * @param val CSS length in "px"
   * @return parsed and adjusted length value in pixels or 0 if not parsable
   */
  parseComputedLength(val: string): number {
    const r = val.match(/^(-?[0-9]*(\.[0-9]*)?)px$/);
    if (r) {
      return this.clientLayout.adjustLengthValue(parseFloat(r[0]));
    }
    return 0;
  }

  /**
   * Reads element's computed CSS margin.
   */
  getComputedMargin(element: Element): GeometryUtil.Insets {
    const style = this.clientLayout.getElementComputedStyle(element);
    const insets = new GeometryUtil.Insets(0, 0, 0, 0);
    if (style) {
      insets.left = this.parseComputedLength(style.marginLeft);
      insets.top = this.parseComputedLength(style.marginTop);
      insets.right = this.parseComputedLength(style.marginRight);
      insets.bottom = this.parseComputedLength(style.marginBottom);
    }
    return insets;
  }

  /**
   * Reads element's computed padding + borders.
   */
  getComputedPaddingBorder(element: Element): GeometryUtil.Insets {
    const style = this.clientLayout.getElementComputedStyle(element);
    const insets = new GeometryUtil.Insets(0, 0, 0, 0);
    if (style) {
      insets.left =
        this.parseComputedLength(style.borderLeftWidth) +
        this.parseComputedLength(style.paddingLeft);
      insets.top =
        this.parseComputedLength(style.borderTopWidth) +
        this.parseComputedLength(style.paddingTop);
      insets.right =
        this.parseComputedLength(style.borderRightWidth) +
        this.parseComputedLength(style.paddingRight);
      insets.bottom =
        this.parseComputedLength(style.borderBottomWidth) +
        this.parseComputedLength(style.paddingBottom);
    }
    return insets;
  }

  /**
   * Reads element's computed CSS insets(margins + border + padding or margins :
   * depends on box-sizing)
   */
  getComputedInsets(element: Element): GeometryUtil.Insets {
    const style = this.clientLayout.getElementComputedStyle(element);
    const insets = new GeometryUtil.Insets(0, 0, 0, 0);
    if (style) {
      if (style.boxSizing == "border-box") {
        return this.getComputedMargin(element);
      }
      insets.left =
        this.parseComputedLength(style.marginLeft) +
        this.parseComputedLength(style.borderLeftWidth) +
        this.parseComputedLength(style.paddingLeft);
      insets.top =
        this.parseComputedLength(style.marginTop) +
        this.parseComputedLength(style.borderTopWidth) +
        this.parseComputedLength(style.paddingTop);
      insets.right =
        this.parseComputedLength(style.marginRight) +
        this.parseComputedLength(style.borderRightWidth) +
        this.parseComputedLength(style.paddingRight);
      insets.bottom =
        this.parseComputedLength(style.marginBottom) +
        this.parseComputedLength(style.borderBottomWidth) +
        this.parseComputedLength(style.paddingBottom);
    }
    return insets;
  }

  /**
   * Set element's computed CSS insets to Column Container
   */
  setComputedInsets(element: Element, container: Column) {
    const style = this.clientLayout.getElementComputedStyle(element);
    if (style) {
      container.marginLeft = this.parseComputedLength(style.marginLeft);
      container.borderLeft = this.parseComputedLength(style.borderLeftWidth);
      container.paddingLeft = this.parseComputedLength(style.paddingLeft);
      container.marginTop = this.parseComputedLength(style.marginTop);
      container.borderTop = this.parseComputedLength(style.borderTopWidth);
      container.paddingTop = this.parseComputedLength(style.paddingTop);
      container.marginRight = this.parseComputedLength(style.marginRight);
      container.borderRight = this.parseComputedLength(style.borderRightWidth);
      container.paddingRight = this.parseComputedLength(style.paddingRight);
      container.marginBottom = this.parseComputedLength(style.marginBottom);
      container.borderBottom = this.parseComputedLength(
        style.borderBottomWidth,
      );
      container.paddingBottom = this.parseComputedLength(style.paddingBottom);
    }
  }

  /**
   * Set element's computed width and height to Column Container
   */
  setComputedWidthAndHeight(element: Element, container: Column) {
    const style = this.clientLayout.getElementComputedStyle(element);
    if (style) {
      container.width = this.parseComputedLength(style.width);
      container.height = this.parseComputedLength(style.height);
    }
  }

  /**
   * Layout a single unbreakable element.
   */
  layoutUnbreakable(
    nodeContextIn: Vtree.NodeContext,
  ): Task.Result<Vtree.NodeContext> {
    return this.buildDeepElementView(nodeContextIn);
  }

  /**
   * Layout a single float element.
   */
  layoutFloat(nodeContext: Vtree.NodeContext): Task.Result<Vtree.NodeContext> {
    const frame: Task.Frame<Vtree.NodeContext> = Task.newFrame("layoutFloat");
    const element = nodeContext.viewNode as Element;
    const floatSide = PageFloats.resolveInlineFloatDirection(
      nodeContext.floatSide,
      nodeContext.vertical,
      nodeContext.direction,
    );
    Base.setCSSProperty(element, "float", "none");
    Base.setCSSProperty(element, "display", "inline-block");
    Base.setCSSProperty(element, "vertical-align", "top");
    this.buildDeepElementView(nodeContext).then((nodeContextAfter) => {
      const floatBBox = this.clientLayout.getElementClientRect(element);
      const margin = this.getComputedMargin(element);
      let floatBox = new GeometryUtil.Rect(
        floatBBox.left - margin.left,
        floatBBox.top - margin.top,
        floatBBox.right + margin.right,
        floatBBox.bottom + margin.bottom,
      );
      let x1 = this.rtl ? this.endEdge : this.startEdge;
      let x2 = this.rtl ? this.startEdge : this.endEdge;
      let parent = nodeContext.parent;
      while (parent && parent.inline) {
        parent = parent.parent;
      }
      if (parent) {
        // Position it at the parent element's edge.
        // We need to get the edge of the parent's content area, calling
        // getElementClientRect will also give us borders. Avoid it by creating
        // a temporary element and using it for measurment.
        const probe = parent.viewNode.ownerDocument.createElement("div");
        probe.style.left = "0px";
        probe.style.top = "0px";
        if (this.vertical) {
          probe.style.bottom = "0px";
          probe.style.width = "1px";
        } else {
          probe.style.right = "0px";
          probe.style.height = "1px";
        }
        parent.viewNode.appendChild(probe);
        const parentBox = this.clientLayout.getElementClientRect(probe);
        x1 = Math.max(
          this.rtl ? this.getEndEdge(parentBox) : this.getStartEdge(parentBox),
          x1,
        );
        x2 = Math.min(
          this.rtl ? this.getStartEdge(parentBox) : this.getEndEdge(parentBox),
          x2,
        );
        parent.viewNode.removeChild(probe);
        const floatBoxMeasure = this.vertical
          ? floatBox.y2 - floatBox.y1
          : floatBox.x2 - floatBox.x1;
        if (floatSide == "left") {
          x2 = Math.max(x2, x1 + floatBoxMeasure);
        } else {
          x1 = Math.min(x1, x2 - floatBoxMeasure);
        }

        // Move the float below the block parent.
        // Otherwise, if the float is attached to an inline box with 'position:
        // relative', the absolute positioning of the float gets broken, since
        // the inline parent can be pushed horizontally by exclusion floats
        // after the layout of the float is done.
        if (parent !== nodeContext.parent && !nodeContext.firstPseudo) {
          // Unless float is specified on ::first-letter (Fix for issue #923)
          parent.viewNode.appendChild(element);

          // Mark the moved float box so that it is not removed wrongly
          // when page breaking occurs inside the inline parent.
          // (Issue #1383, #1422)
          element.setAttribute("data-vivliostyle-float-box-moved", "true");
        }
      }

      // box is rotated for vertical orientation
      let box = new GeometryUtil.Rect(
        x1,
        this.getBoxDir() * this.beforeEdge,
        x2,
        this.getBoxDir() * this.afterEdge,
      );
      let floatHorBox = floatBox;
      if (this.vertical) {
        floatHorBox = GeometryUtil.rotateBox(floatBox);
      }
      const dir = this.getBoxDir();
      if (floatHorBox.y1 < this.bottommostFloatTop * dir) {
        const boxExtent = floatHorBox.y2 - floatHorBox.y1;
        floatHorBox.y1 = this.bottommostFloatTop * dir;
        floatHorBox.y2 = floatHorBox.y1 + boxExtent;
      }
      GeometryUtil.positionFloat(box, this.bands, floatHorBox, floatSide);
      if (this.vertical) {
        floatBox = GeometryUtil.unrotateBox(floatHorBox);
      }
      const insets = this.getComputedInsets(element);
      Base.setCSSProperty(
        element,
        "width",
        `${floatBox.x2 - floatBox.x1 - insets.left - insets.right}px`,
      );
      Base.setCSSProperty(
        element,
        "height",
        `${floatBox.y2 - floatBox.y1 - insets.top - insets.bottom}px`,
      );
      Base.setCSSProperty(element, "position", "absolute");
      Asserts.assert(nodeContext.display);
      Base.setCSSProperty(element, "display", nodeContext.display);
      let offsets;
      let containingBlockForAbsolute: Vtree.NodeContext = null;
      if (parent) {
        if (parent.containingBlockForAbsolute) {
          containingBlockForAbsolute = parent;
        } else {
          containingBlockForAbsolute = parent.getContainingBlockForAbsolute();
        }
      }
      if (containingBlockForAbsolute) {
        const probe =
          containingBlockForAbsolute.viewNode.ownerDocument.createElement(
            "div",
          );
        probe.style.position = "absolute";
        if (containingBlockForAbsolute.vertical) {
          probe.style.right = "0";
        } else {
          probe.style.left = "0";
        }
        probe.style.top = "0";
        containingBlockForAbsolute.viewNode.appendChild(probe);
        offsets = this.clientLayout.getElementClientRect(probe);
        containingBlockForAbsolute.viewNode.removeChild(probe);
      } else {
        offsets = {
          left: this.getLeftEdge() - this.paddingLeft,
          right: this.getRightEdge() + this.paddingRight,
          top: this.getTopEdge() - this.paddingTop,
        };
      }
      if (
        containingBlockForAbsolute
          ? containingBlockForAbsolute.vertical
          : this.vertical
      ) {
        Base.setCSSProperty(
          element,
          "right",
          `${offsets.right - floatBox.x2}px`,
        );
      } else {
        Base.setCSSProperty(element, "left", `${floatBox.x1 - offsets.left}px`);
      }
      Base.setCSSProperty(element, "top", `${floatBox.y1 - offsets.top}px`);
      if (nodeContext.clearSpacer) {
        nodeContext.clearSpacer.parentNode.removeChild(nodeContext.clearSpacer);
        nodeContext.clearSpacer = null;
      }
      const floatBoxEdge = this.vertical ? floatBox.x1 : floatBox.y2;
      const floatBoxTop = this.vertical ? floatBox.x2 : floatBox.y1;

      // TODO: subtract after margin when determining overflow.
      if (!this.isOverflown(floatBoxEdge) || this.breakPositions.length == 0) {
        // no overflow
        this.killFloats();
        box = new GeometryUtil.Rect(
          this.getLeftEdge(),
          this.getTopEdge(),
          this.getRightEdge(),
          this.getBottomEdge(),
        );
        if (this.vertical) {
          box = GeometryUtil.rotateBox(box);
        }
        GeometryUtil.addFloatToBands(
          box,
          this.bands,
          floatHorBox,
          null,
          floatSide,
        );
        this.createFloats();
        if (floatSide == "left") {
          this.leftFloatEdge = floatBoxEdge;
        } else {
          this.rightFloatEdge = floatBoxEdge;
        }
        this.bottommostFloatTop = floatBoxTop;
        this.updateMaxReachedAfterEdge(floatBoxEdge);
        frame.finish(nodeContextAfter);
      } else {
        nodeContext = nodeContext.modify();
        nodeContext.overflow = true;
        frame.finish(nodeContext);
      }
    });
    return frame.result();
  }

  setupFloatArea(
    area: PageFloatArea,
    floatReference: PageFloats.FloatReference,
    floatSide: string,
    anchorEdge: number | null,
    strategy: PageFloats.PageFloatLayoutStrategy,
    condition: PageFloats.PageFloatPlacementCondition,
  ): boolean {
    const floatLayoutContext = this.pageFloatLayoutContext;
    const floatContainer = floatLayoutContext.getContainer(floatReference);
    const element = area.element;
    floatContainer.element.parentNode.appendChild(element);
    area.isFloat = true;
    area.originX = floatContainer.originX;
    area.originY = floatContainer.originY;
    area.vertical = floatContainer.vertical;
    area.rtl = floatContainer.rtl;
    area.marginLeft = area.marginRight = area.marginTop = area.marginBottom = 0;
    area.borderLeft = area.borderRight = area.borderTop = area.borderBottom = 0;
    area.paddingLeft =
      area.paddingRight =
      area.paddingTop =
      area.paddingBottom =
        0;
    area.exclusions = (floatContainer.exclusions || []).concat();
    area.forceNonfitting = !floatLayoutContext.hasFloatFragments();
    area.innerShape = null;
    const containingBlockRect = floatContainer.getPaddingRect();
    area.setHorizontalPosition(
      containingBlockRect.x1 - floatContainer.originX,
      containingBlockRect.x2 - containingBlockRect.x1,
    );
    area.setVerticalPosition(
      containingBlockRect.y1 - floatContainer.originY,
      containingBlockRect.y2 - containingBlockRect.y1,
    );
    strategy.adjustPageFloatArea(area, floatContainer, this);

    // Calculate bands from the exclusions before setting float area dimensions
    area.init();
    const fitWithinContainer = !!floatLayoutContext.setFloatAreaDimensions(
      area,
      floatReference,
      floatSide,
      anchorEdge,
      true,
      !floatLayoutContext.hasFloatFragments(),
      condition,
    );
    if (fitWithinContainer) {
      // New dimensions have been set, remove exclusion floats and re-init
      area.killFloats();
      area.init();
    } else {
      floatContainer.element.parentNode.removeChild(element);
    }
    return fitWithinContainer;
  }

  createPageFloatArea(
    float: PageFloats.PageFloat | null,
    floatSide: string,
    anchorEdge: number | null,
    strategy: PageFloats.PageFloatLayoutStrategy,
    condition: PageFloats.PageFloatPlacementCondition,
  ): PageFloatArea | null {
    const floatAreaElement = this.element.ownerDocument.createElement("div");
    Base.setCSSProperty(floatAreaElement, "position", "absolute");
    const parentPageFloatLayoutContext =
      this.pageFloatLayoutContext.getPageFloatLayoutContext(
        float.floatReference,
      );

    // TODO: establish how to specify an appropriate generating element for the
    // new page float layout context
    const pageFloatLayoutContext = new PageFloats.PageFloatLayoutContext(
      null,
      PageFloats.FloatReference.COLUMN,
      null,
      this.pageFloatLayoutContext.flowName,
      float.nodePosition,
      null,
      null,
    );
    const parentContainer = parentPageFloatLayoutContext.getContainer();
    const floatArea = new PageFloatArea(
      floatSide,
      floatAreaElement,
      this.layoutContext.clone(),
      this.clientLayout,
      this.layoutConstraint,
      pageFloatLayoutContext,
      parentContainer,
    );
    pageFloatLayoutContext.setContainer(floatArea);
    if (
      this.setupFloatArea(
        floatArea,
        float.floatReference,
        floatSide,
        anchorEdge,
        strategy,
        condition,
      )
    ) {
      return floatArea;
    } else {
      return null;
    }
  }

  layoutSinglePageFloatFragment(
    continuations: PageFloats.PageFloatContinuation[],
    floatSide: string,
    clearSide: string | null,
    allowFragmented: boolean,
    strategy: PageFloats.PageFloatLayoutStrategy,
    anchorEdge: number | null,
    pageFloatFragment?: PageFloats.PageFloatFragment | null,
  ): Task.Result<SinglePageFloatLayoutResult> {
    const context = this.pageFloatLayoutContext;
    const originalContinuations = pageFloatFragment
      ? pageFloatFragment.continuations
      : [];
    continuations = originalContinuations.concat(continuations);
    const firstFloat = continuations[0].float;
    const condition = context.getPageFloatPlacementCondition(
      firstFloat,
      floatSide,
      clearSide,
    );
    const floatArea = this.createPageFloatArea(
      firstFloat,
      floatSide,
      anchorEdge,
      strategy,
      condition,
    );
    const result: SinglePageFloatLayoutResult = {
      floatArea,
      pageFloatFragment: null,
      newPosition: null,
    };
    if (!floatArea) {
      return Task.newResult(result);
    }
    const frame = Task.newFrame<SinglePageFloatLayoutResult>(
      "layoutSinglePageFloatFragment",
    );
    let failed = false;
    let i = 0;
    frame
      .loopWithFrame((loopFrame) => {
        if (i >= continuations.length) {
          loopFrame.breakLoop();
          return;
        }
        const c = continuations[i];
        const floatChunkPosition = new VtreeImpl.ChunkPosition(c.nodePosition);
        floatArea.layout(floatChunkPosition, true).then((newPosition) => {
          result.newPosition = newPosition;
          if (!newPosition || allowFragmented) {
            i++;
            loopFrame.continueLoop();
          } else {
            failed = true;
            loopFrame.breakLoop();
          }
        });
      })
      .then(() => {
        if (!failed) {
          Asserts.assert(floatArea);
          const logicalFloatSide = context.setFloatAreaDimensions(
            floatArea,
            firstFloat.floatReference,
            floatSide,
            anchorEdge,
            false,
            allowFragmented,
            condition,
          );
          if (!logicalFloatSide) {
            failed = true;
          } else {
            const newFragment = strategy.createPageFloatFragment(
              continuations,
              logicalFloatSide,
              floatArea,
              !!result.newPosition,
            );
            context.addPageFloatFragment(newFragment, true);
            result.pageFloatFragment = newFragment;
          }
        }
        frame.finish(result);
      });
    return frame.result();
  }

  layoutPageFloatInner(
    continuation: PageFloats.PageFloatContinuation,
    strategy: PageFloats.PageFloatLayoutStrategy,
    anchorEdge: number | null,
    pageFloatFragment?: PageFloats.PageFloatFragment,
  ): Task.Result<boolean> {
    const context = this.pageFloatLayoutContext;
    const float = continuation.float;
    context.stashEndFloatFragments(float);

    function cancelLayout(floatArea, pageFloatFragment) {
      if (pageFloatFragment) {
        context.removePageFloatFragment(pageFloatFragment, true);
      } else if (floatArea) {
        floatArea.element.parentNode.removeChild(floatArea.element);
      }
      context.restoreStashedFragments(float.floatReference);
      context.deferPageFloat(continuation);
    }
    const frame: Task.Frame<boolean> = Task.newFrame("layoutPageFloatInner");
    this.layoutSinglePageFloatFragment(
      [continuation],
      float.floatSide,
      float.clearSide,
      !context.hasFloatFragments(),
      strategy,
      anchorEdge,
      pageFloatFragment,
    ).then((result) => {
      const floatArea = result.floatArea;
      const newFragment = result.pageFloatFragment;
      const newPosition = result.newPosition;
      if (newFragment) {
        this.layoutStashedPageFloats(float.floatReference, [
          pageFloatFragment,
        ]).then((success) => {
          if (success) {
            // Add again to invalidate the context
            Asserts.assert(newFragment);
            context.addPageFloatFragment(newFragment);
            context.discardStashedFragments(float.floatReference);
            if (newPosition) {
              const continuation = new PageFloats.PageFloatContinuation(
                float,
                newPosition.primary,
              );
              context.deferPageFloat(continuation);
            }
            frame.finish(true);
          } else {
            cancelLayout(floatArea, newFragment);
            frame.finish(false);
          }
        });
      } else {
        cancelLayout(floatArea, newFragment);
        frame.finish(false);
      }
    });
    return frame.result();
  }

  /**
   * @returns Represents if the layout was succeeded or not
   */
  private layoutStashedPageFloats(
    floatReference: PageFloats.FloatReference,
    excluded: PageFloats.PageFloatFragment[],
  ): Task.Result<boolean> {
    const context = this.pageFloatLayoutContext;
    const stashedFloatFragments =
      context.getStashedFloatFragments(floatReference);
    const newFloatAreas = [];
    const newFragments = [];
    let failed = false;
    const frame = Task.newFrame<boolean>("layoutStashedPageFloats");
    let i = 0;
    frame
      .loopWithFrame((loopFrame) => {
        if (i >= stashedFloatFragments.length) {
          loopFrame.breakLoop();
          return;
        }
        const stashedFragment = stashedFloatFragments[i];
        if (excluded.includes(stashedFragment)) {
          i++;
          loopFrame.continueLoop();
          return;
        }
        const strategy =
          new PageFloats.PageFloatLayoutStrategyResolver().findByFloat(
            stashedFragment.continuations[0].float,
          );

        // Value of 'clear' is irrelevant when laying out stashed floats
        // since whether the 'clear' value allows placing the float
        // here is already resolved.
        this.layoutSinglePageFloatFragment(
          stashedFragment.continuations,
          stashedFragment.floatSide,
          null,
          false,
          strategy,
          null,
        ).then((result) => {
          const floatArea = result.floatArea;
          if (floatArea) {
            newFloatAreas.push(floatArea);
          }
          const fragment = result.pageFloatFragment;
          if (fragment) {
            newFragments.push(fragment);
            i++;
            loopFrame.continueLoop();
          } else {
            failed = true;
            loopFrame.breakLoop();
          }
        });
      })
      .then(() => {
        if (failed) {
          newFragments.forEach((fragment) => {
            context.removePageFloatFragment(fragment, true);
          });
          newFloatAreas.forEach((area) => {
            const elem = area.element;
            if (elem && elem.parentNode) {
              elem.parentNode.removeChild(elem);
            }
          });
        } else {
          stashedFloatFragments.forEach((fragment) => {
            const elem = fragment.area.element;
            if (elem && elem.parentNode) {
              elem.parentNode.removeChild(elem);
            }
          });
        }
        frame.finish(!failed);
      });
    return frame.result();
  }

  setFloatAnchorViewNode(nodeContext: Vtree.NodeContext): Vtree.NodeContext {
    const parent = nodeContext.viewNode.parentNode;
    const anchor = parent.ownerDocument.createElement("span");
    anchor.setAttribute(VtreeImpl.SPECIAL_ATTR, "1");
    if (nodeContext.floatSide === "footnote") {
      // Defaults for footnote-call, can be overriden by the stylesheet.
      this.layoutContext.applyPseudoelementStyle(
        nodeContext,
        "footnote-call",
        anchor,
      );
    }
    parent.appendChild(anchor);
    parent.removeChild(nodeContext.viewNode);
    const nodeContextAfter = nodeContext.modify();
    nodeContextAfter.after = true;
    nodeContextAfter.viewNode = anchor;
    return nodeContextAfter;
  }

  resolveFloatReferenceFromColumnSpan(
    floatReference: PageFloats.FloatReference,
    columnSpan: Css.Val,
    nodeContext: Vtree.NodeContext,
  ): Task.Result<PageFloats.FloatReference> {
    const frame = Task.newFrame(
      "resolveFloatReferenceFromColumnSpan",
    ) as Task.Frame<PageFloats.FloatReference>;
    const columnContext = this.pageFloatLayoutContext;
    const regionContext = columnContext.getPageFloatLayoutContext(
      PageFloats.FloatReference.REGION,
    );
    const isRegionWider =
      columnContext.getContainer().width < regionContext.getContainer().width;
    if (isRegionWider && floatReference === PageFloats.FloatReference.COLUMN) {
      if (columnSpan === Css.ident.auto) {
        this.buildDeepElementView(nodeContext.copy()).then((position) => {
          const element = position.viewNode as Element;
          let inlineSize = Sizing.getSize(this.clientLayout, element, [
            Sizing.Size.MIN_CONTENT_INLINE_SIZE,
          ])[Sizing.Size.MIN_CONTENT_INLINE_SIZE];
          const margin = this.getComputedMargin(element);
          if (this.vertical) {
            inlineSize += margin.top + margin.bottom;
          } else {
            inlineSize += margin.left + margin.right;
          }
          if (inlineSize > this.width) {
            frame.finish(PageFloats.FloatReference.REGION);
          } else {
            frame.finish(floatReference);
          }
        });
      } else if (columnSpan === Css.ident.all) {
        frame.finish(PageFloats.FloatReference.REGION);
      } else {
        frame.finish(floatReference);
      }
    } else {
      frame.finish(floatReference);
    }
    return frame.result();
  }

  layoutPageFloat(
    nodeContext: Vtree.NodeContext,
  ): Task.Result<Vtree.NodeContext> {
    const context = this.pageFloatLayoutContext;
    const strategy =
      new PageFloats.PageFloatLayoutStrategyResolver().findByNodeContext(
        nodeContext,
      );
    let cont: Task.Result<PageFloats.PageFloat>;
    const float = context.findPageFloatByNodePosition(
      nodeContext.toNodePosition(),
    );
    if (!float) {
      cont = strategy.createPageFloat(nodeContext, context, this);
    } else {
      cont = Task.newResult(float);
    }
    return cont.thenAsync((float) => {
      const nodePosition = VtreeImpl.newNodePositionFromNodeContext(
        nodeContext,
        0,
      );
      const nodeContextAfter = this.setFloatAnchorViewNode(nodeContext);
      const pageFloatFragment = strategy.findPageFloatFragment(float, context);
      const continuation = new PageFloats.PageFloatContinuation(
        float,
        nodePosition,
      );
      if (pageFloatFragment && pageFloatFragment.hasFloat(float)) {
        context.registerPageFloatAnchor(float, nodeContextAfter.viewNode);
        return Task.newResult(nodeContextAfter as Vtree.NodeContext);
      } else if (
        context.isForbidden(float) ||
        context.hasPrecedingFloatsDeferredToNext(float)
      ) {
        context.deferPageFloat(continuation);
        context.registerPageFloatAnchor(float, nodeContextAfter.viewNode);
        return Task.newResult(nodeContextAfter as Vtree.NodeContext);
      } else if (this.nodeContextOverflowingDueToRepetitiveElements) {
        return Task.newResult(null);
      } else {
        const edge = LayoutHelper.calculateEdge(
          nodeContextAfter,
          this.clientLayout,
          0,
          this.vertical,
        );
        if (this.isOverflown(edge)) {
          return Task.newResult(nodeContextAfter);
        } else {
          return this.layoutPageFloatInner(
            continuation,
            strategy,
            edge,
            pageFloatFragment,
          ).thenAsync((success) => {
            Asserts.assert(float);
            if (!success) {
              context.registerPageFloatAnchor(float, nodeContextAfter.viewNode);
              return Task.newResult(nodeContextAfter);
            } else {
              return Task.newResult(null);
            }
          });
        }
      }
    });
  }

  processLineStyling(
    nodeContext: Vtree.NodeContext,
    resNodeContext: Vtree.NodeContext,
    checkPoints: Vtree.NodeContext[],
  ): Task.Result<Vtree.NodeContext> {
    const frame: Task.Frame<Vtree.NodeContext> =
      Task.newFrame("processLineStyling");
    if (VIVLIOSTYLE_DEBUG) {
      validateCheckPoints(checkPoints);
    }
    let lastCheckPoints = checkPoints.concat([]); // make a copy
    checkPoints.splice(0, checkPoints.length); // make empty
    let totalLineCount = 0;
    let firstPseudo = nodeContext.firstPseudo; // :first-letter is not processed here
    if (firstPseudo.count == 0) {
      firstPseudo = firstPseudo.outer; // move to line pseudoelement (if any)
    }
    frame
      .loopWithFrame((loopFrame) => {
        if (!firstPseudo) {
          loopFrame.breakLoop();
          return;
        }
        const linePositions = this.findLinePositions(lastCheckPoints);
        const count = firstPseudo.count - totalLineCount;
        if (linePositions.length <= count) {
          loopFrame.breakLoop();
          return;
        }
        const lineBreak = this.findAcceptableBreakInside(
          lastCheckPoints,
          linePositions[count - 1],
          true,
        );
        if (lineBreak == null) {
          loopFrame.breakLoop();
          return;
        }
        this.finishBreak(lineBreak, false, false).then(() => {
          totalLineCount += count;
          this.layoutContext
            .peelOff(lineBreak, 0)
            .then((resNodeContextParam) => {
              nodeContext = resNodeContextParam;
              firstPseudo = nodeContext.firstPseudo;
              lastCheckPoints = []; // Wipe out line breaks inside pseudoelements
              this.buildViewToNextBlockEdge(nodeContext, lastCheckPoints).then(
                (resNodeContextParam) => {
                  resNodeContext = resNodeContextParam;
                  loopFrame.continueLoop();
                },
              );
            });
        });
      })
      .then(() => {
        Array.prototype.push.apply(checkPoints, lastCheckPoints);
        if (VIVLIOSTYLE_DEBUG) {
          validateCheckPoints(checkPoints);
        }
        frame.finish(resNodeContext);
      });
    return frame.result();
  }

  isLoneImage(checkPoints: Vtree.NodeContext[]): boolean {
    if (checkPoints.length != 2 && this.breakPositions.length > 0) {
      return false;
    }
    return (
      checkPoints[0].sourceNode == checkPoints[1].sourceNode &&
      Base.mediaTags[(checkPoints[0].sourceNode as Element).localName]
    );
  }

  getTrailingMarginEdgeAdjustment(
    trailingEdgeContexts: Vtree.NodeContext[],
  ): number {
    // Margins push the computed height, but are not counted as overflow. We
    // need to find the overall collapsed margin from all enclosed blocks.
    let maxPos = 0;
    let minNeg = 0;
    for (let i = trailingEdgeContexts.length - 1; i >= 0; i--) {
      const nodeContext = trailingEdgeContexts[i];
      if (
        !nodeContext.after ||
        !nodeContext.viewNode ||
        nodeContext.viewNode.nodeType != 1
      ) {
        break;
      }
      const margin = this.getComputedMargin(nodeContext.viewNode as Element);
      const m = this.vertical ? -margin.left : margin.bottom;
      if (m > 0) {
        maxPos = Math.max(maxPos, m);
      } else {
        minNeg = Math.min(minNeg, m);
      }
    }
    return maxPos + minNeg;
  }

  /**
   * Layout a single CSS box.
   */
  layoutBreakableBlock(
    nodeContext: Vtree.NodeContext,
  ): Task.Result<Vtree.NodeContext> {
    const frame: Task.Frame<Vtree.NodeContext> = Task.newFrame(
      "layoutBreakableBlock",
    );
    const checkPoints: Vtree.NodeContext[] = [];
    this.buildViewToNextBlockEdge(nodeContext, checkPoints).then(
      (resNodeContext) => {
        // at this point a single block was appended to the column
        // flowPosition is either null or
        //  - if !after: contains view for the next block element
        //  - if after: contains view for the enclosing block element
        const checkPointIndex = checkPoints.length - 1;
        if (checkPointIndex < 0) {
          frame.finish(resNodeContext);
          return;
        }

        // Text-spacing etc. must be done before calculating edge. (Issue #898)
        this.postLayoutBlock(resNodeContext, checkPoints);

        // Record the height
        // TODO: should this be done after first-line calculation?
        let edge = this.calculateEdge(
          resNodeContext,
          checkPoints,
          checkPointIndex,
          checkPoints[checkPointIndex].boxOffset,
        );
        let overflown = false;
        if (
          !resNodeContext ||
          !LayoutHelper.isOrphan(resNodeContext.viewNode)
        ) {
          const offsets = BreakPosition.calculateOffset(
            resNodeContext,
            this.collectElementsOffset(),
          );
          overflown = this.isOverflown(
            edge + (this.vertical ? -1 : 1) * offsets.minimum,
          );
          if (
            this.isOverflown(
              edge + (this.vertical ? -1 : 1) * offsets.current,
            ) &&
            !this.nodeContextOverflowingDueToRepetitiveElements
          ) {
            this.nodeContextOverflowingDueToRepetitiveElements = resNodeContext;
          }
        }
        if (resNodeContext == null) {
          edge += this.getTrailingMarginEdgeAdjustment(checkPoints);
        }
        this.updateMaxReachedAfterEdge(edge);
        let lineCont: Task.Result<Vtree.NodeContext>;
        if (nodeContext.firstPseudo) {
          // possibly need to deal with :first-line and friends
          lineCont = this.processLineStyling(
            nodeContext,
            resNodeContext,
            checkPoints,
          );
        } else {
          lineCont = Task.newResult(resNodeContext);
        }
        lineCont.then((nodeContext) => {
          // Text-spacing etc. must be done before calculating edge. (Issue #898)
          // this.postLayoutBlock(nodeContext, checkPoints);

          if (checkPoints.length > 0) {
            this.saveBoxBreakPosition(checkPoints);

            // TODO: how to signal overflow in the last pagargaph???
            if (overflown && !this.isLoneImage(checkPoints) && nodeContext) {
              nodeContext = nodeContext.modify();
              nodeContext.overflow = true;
            }
          }
          frame.finish(nodeContext);
        });
      },
    );
    return frame.result();
  }

  postLayoutBlock(
    nodeContext: Vtree.NodeContext,
    checkPoints: Vtree.NodeContext[],
  ) {
    const hooks: Plugin.PostLayoutBlockHook[] = Plugin.getHooksForName(
      Plugin.HOOKS.POST_LAYOUT_BLOCK,
    );
    hooks.forEach((hook) => {
      hook(nodeContext, checkPoints, this);
    });
  }

  findEndOfLine(
    linePosition: number,
    checkPoints: Vtree.NodeContext[],
    isUpdateMaxReachedAfterEdge: boolean,
  ): {
    nodeContext: Vtree.NodeContext;
    index: number;
    checkPointIndex: number;
  } {
    if (VIVLIOSTYLE_DEBUG) {
      validateCheckPoints(checkPoints);
    }

    // Workaround for Blink not returning correct fractional values for
    // Range.getClientRects.
    // https://bugs.chromium.org/p/chromium/issues/detail?id=629828
    const effectiveLinePosition = this.vertical
      ? linePosition - 1
      : linePosition + 1;

    // find the first character which is out
    let lowCP = 0;
    let low = checkPoints[0].boxOffset;
    let low1 = lowCP;
    let highCP = checkPoints.length - 1;
    let high = checkPoints[highCP].boxOffset;
    let mid: number;
    while (low < high) {
      mid = low + Math.ceil((high - low) / 2);

      // find the node which contains mid index
      low1 = lowCP;
      let high1 = highCP;
      while (low1 < high1) {
        const mid1 = low1 + Math.ceil((high1 - low1) / 2);
        if (checkPoints[mid1].boxOffset > mid) {
          high1 = mid1 - 1;
        } else {
          low1 = mid1;
        }
      }
      const edge = this.calculateEdge(null, checkPoints, low1, mid);
      if (
        this.vertical
          ? edge <= effectiveLinePosition
          : edge >= effectiveLinePosition
      ) {
        high = mid - 1;
        while (checkPoints[low1].boxOffset == mid) {
          low1--;
        }
        highCP = low1;
      } else {
        if (isUpdateMaxReachedAfterEdge) {
          this.updateMaxReachedAfterEdge(edge);
        }
        low = mid;
        lowCP = low1;
      }
    }
    return {
      nodeContext: checkPoints[low1],
      index: low,
      checkPointIndex: low1,
    };
  }

  findAcceptableBreakInside(
    checkPoints: Vtree.NodeContext[],
    edgePosition: number,
    force: boolean,
  ): Vtree.NodeContext {
    const position = this.findEndOfLine(edgePosition, checkPoints, true);
    let nodeContext = position.nodeContext;

    if (
      position.checkPointIndex === 0 &&
      position.index === nodeContext.boxOffset
    ) {
      // Prevent wrong break at beginning of paragraph (Issue #1401, #1406)
      return null;
    }

    const viewNode = nodeContext.viewNode;
    if (
      viewNode.nodeType != 1 &&
      viewNode.parentElement?.localName !== "viv-ts-inner"
    ) {
      const textNode = viewNode as Text;
      const textNodeBreaker = this.resolveTextNodeBreaker(nodeContext);
      nodeContext = textNodeBreaker.breakTextNode(
        textNode,
        nodeContext,
        position.index,
        checkPoints,
        position.checkPointIndex,
        force,
      );
    } else {
      // Fix for issue #821, #885
      const p = LayoutHelper.findAncestorSpecialInlineNodeContext(nodeContext);
      if (p) {
        if (
          this.breakPositions?.[0] instanceof BoxBreakPosition &&
          p?.viewNode.contains(this.breakPositions[0].checkPoints[0].viewNode)
        ) {
          // Prevent breaks at beginning of the column
          return null;
        }
        // Prevent breaks inside inline-blocks
        nodeContext = p;
      }
    }
    this.clearOverflownViewNodes(nodeContext, false);
    return nodeContext;
  }

  resolveTextNodeBreaker(nodeContext: Vtree.NodeContext): TextNodeBreaker {
    const hooks: Plugin.ResolveTextNodeBreakerHook[] = Plugin.getHooksForName(
      Plugin.HOOKS.RESOLVE_TEXT_NODE_BREAKER,
    );
    return hooks.reduce(
      (prev, hook) => hook(nodeContext) || prev,
      TextNodeBreaker.instance,
    );
  }

  /**
   * Read ranges skipping special elements
   */
  getRangeBoxes(start: Node, end: Node): Vtree.ClientRect[] {
    const arr = [];
    const range = start.ownerDocument.createRange();
    let wentUp = false;
    let node = start;
    let lastGood: Node = null;
    let haveStart = false;
    let endNotReached = true;
    while (endNotReached) {
      let seekRange = true;
      do {
        let next: Node = null;
        if (node == end) {
          if (end.nodeType === 1) {
            // If end is an element, continue traversing its children to find
            // the last text node inside it. Finish when end has no child or
            // when came back from its children (wentUp==true).
            endNotReached = !(!end.firstChild || wentUp);
          } else {
            endNotReached = false;
          }
        }
        const element = node.nodeType === 1 ? (node as Element) : null;
        if (!element) {
          if (!haveStart) {
            if (node.parentNode == null) {
              endNotReached = false;
            } else {
              range.setStartBefore(node);
              haveStart = true;
            }
          }
          lastGood = node;
        } else if (wentUp) {
          wentUp = false;
        } else if (LayoutHelper.isSpecial(element)) {
          // Skip special
          seekRange = !haveStart;
        } else if (
          !element.firstChild ||
          Base.mediaTags[element.localName] ||
          /^r(uby|[bt]c?)$/.test(element.localName) ||
          LayoutHelper.isSpecialInlineDisplay(
            this.clientLayout.getElementComputedStyle(element).display,
          )
        ) {
          // img, ruby, inline-block, etc.
          seekRange = !haveStart;
          if (seekRange) {
            if (element.localName === "ruby" && node.firstChild) {
              // Fix for issue #985
              node = node.firstChild;
            }
            range.setStartBefore(node);
            haveStart = true;
            lastGood = node;
          } else if (!/^r(uby|tc?)$/.test(element.localName)) {
            // Fix for issue #1319 and #1401
            lastGood = node;
          }
          if (node.contains(end)) {
            endNotReached = false;
          }
        } else {
          next = node.firstChild;
        }
        if (!next) {
          next = node.nextSibling;
          if (!next) {
            wentUp = true;
            next = node.parentNode;
          }
        }
        node = next;
      } while (seekRange && endNotReached);
      if (haveStart) {
        range.setEndAfter(lastGood);
        const boxList = this.clientLayout.getRangeClientRects(range);
        for (let i = 0; i < boxList.length; i++) {
          arr.push(boxList[i]);
        }
        haveStart = false;
      }
    }
    return arr;
  }

  /**
   * Give block's initial and final nodes, find positions of the line bottoms.
   * This is, of course, somewhat hacky implementation.
   * @return position of line breaks
   */
  findLinePositions(checkPoints: Vtree.NodeContext[]): number[] {
    const LOW_OVERLAP = 0.2;
    const MID_OVERLAP = 0.6;
    const positions = [];
    const boxes = this.getRangeBoxes(
      checkPoints[0].viewNode,
      checkPoints[checkPoints.length - 1].viewNode,
    );
    boxes.sort(
      this.vertical
        ? VtreeImpl.clientrectDecreasingRight
        : VtreeImpl.clientrectIncreasingTop,
    );
    let lineBefore = 0;
    let lineAfter = 0;
    let lineEnd = 0;
    let lineLength = 0;
    let i = 0;
    const dir = this.getBoxDir();
    while (true) {
      if (i < boxes.length) {
        const box = boxes[i];
        let overlap = 1;
        if (lineLength > 0) {
          const boxSize = Math.max(this.getBoxSize(box), 1);
          if (dir * this.getBeforeEdge(box) < dir * lineBefore) {
            overlap = (dir * (this.getAfterEdge(box) - lineBefore)) / boxSize;
          } else if (dir * this.getAfterEdge(box) > dir * lineAfter) {
            overlap = (dir * (lineAfter - this.getBeforeEdge(box))) / boxSize;
          } else {
            overlap = 1;
          }
        }
        if (
          lineLength == 0 ||
          overlap >= MID_OVERLAP ||
          (overlap >= LOW_OVERLAP && this.getStartEdge(box) >= lineEnd - 1)
        ) {
          lineEnd = this.getEndEdge(box);
          if (this.vertical) {
            lineBefore =
              lineLength == 0 ? box.right : Math.max(lineBefore, box.right);
            lineAfter =
              lineLength == 0 ? box.left : Math.min(lineAfter, box.left);
          } else {
            lineBefore =
              lineLength == 0 ? box.top : Math.min(lineBefore, box.top);
            lineAfter =
              lineLength == 0 ? box.bottom : Math.max(lineAfter, box.bottom);
          }
          lineLength++;
          i++;
          continue;
        }
      }

      // Add line
      if (lineLength > 0) {
        positions.push(lineAfter);
        lineLength = 0;
      }
      if (i >= boxes.length) {
        break;
      }
    }
    positions.sort(Base.numberCompare);
    if (this.vertical) {
      positions.reverse();
    }
    return positions;
  }

  calculateClonedPaddingBorder(nodeContext: Vtree.NodeContext): number {
    let clonedPaddingBorder = 0;
    for (let nc = nodeContext; nc; nc = nc.parent) {
      if (
        !nc.inline &&
        Break.isCloneBoxDecorationBreak(nc.viewNode as Element)
      ) {
        const paddingBorders = this.getComputedPaddingBorder(
          nc.viewNode as Element,
        );
        clonedPaddingBorder += nc.vertical
          ? -paddingBorders.left
          : paddingBorders.bottom;
        if (nc.display === "table") {
          clonedPaddingBorder += (nc.vertical ? -1 : 1) * nc.blockBorderSpacing;
        }
      }
    }
    return clonedPaddingBorder;
  }

  private getOffsetByRepetitiveElements(
    bp?: BreakPosition.BreakPosition,
  ): number {
    let offset: { current: number; minimum: number };
    if (bp) {
      offset = bp.calculateOffset(this);
    } else {
      offset = BreakPosition.calculateOffset(
        null,
        this.collectElementsOffset(),
      );
    }
    return offset.current;
  }

  findBoxBreakPosition(
    bp: BoxBreakPosition,
    force: boolean,
  ): Vtree.NodeContext {
    // Workaround for issue #816 (Text with ruby overflowed at column/page break)
    const parentNode = this.element.parentNode;
    const nextSibling = this.element.nextSibling;
    parentNode.removeChild(this.element);
    parentNode.insertBefore(this.element, nextSibling);

    const checkPoints = bp.checkPoints;
    let block = checkPoints[0];
    while (block.parent && block.inline) {
      block = block.parent;
    }
    let widows: number;
    let orphans: number;
    if (force) {
      // Last resort, ignore widows/orphans
      widows = 1;
      orphans = 1;
    } else {
      // Get widows/orphans settings from the block element
      widows = Math.max(
        ((block.inheritedProps["widows"] as number) || 2) - 0,
        1,
      );
      orphans = Math.max(
        ((block.inheritedProps["orphans"] as number) || 2) - 0,
        1,
      );
    }

    // In case of box-decoration-break: clone, width (or height in vertical
    // writing mode) of cloned paddings and borders should be taken into
    // account.
    const clonedPaddingBorder = this.calculateClonedPaddingBorder(block);

    // Select the first overflowing line break position
    const linePositions = this.findLinePositions(checkPoints);
    let edge = this.footnoteEdge - clonedPaddingBorder;
    const dir = this.getBoxDir();
    const repetitiveElementsOffset = this.getOffsetByRepetitiveElements(bp);
    edge -= dir * repetitiveElementsOffset;

    // If an "overflowing" checkpoint (e.g. not allowed by LayoutConstraint)
    // exists before the edge, a line containing the checkpoint should be
    // deferred to the next column.
    const firstOverflowing =
      this.findFirstOverflowingEdgeAndCheckPoint(checkPoints);
    if (isNaN(firstOverflowing.edge)) {
      firstOverflowing.edge = dir * Infinity;
    }
    let lineIndex = Base.binarySearch(linePositions.length, (i) => {
      const p = linePositions[i];
      return this.vertical
        ? p < edge || p <= firstOverflowing.edge
        : p > edge || p >= firstOverflowing.edge;
    });

    // If no break point is found due to the "overflowing" checkpoint,
    // give up deferring a line containing the checkpoint and try to cut the
    // line just before it.
    const forceCutBeforeOverflowing = lineIndex <= 0;
    if (forceCutBeforeOverflowing) {
      lineIndex = Base.binarySearch(linePositions.length, (i) =>
        this.vertical ? linePositions[i] < edge : linePositions[i] > edge,
      );
    }

    // Workaround for the case of block child after text in parent block
    // (Issue #1036)
    let lastNode = checkPoints[checkPoints.length - 1].viewNode;
    if (lastNode?.parentElement.localName === "viv-ts-inner") {
      lastNode = lastNode.parentElement.parentElement;
    }
    if (
      (lineIndex === linePositions.length && lastNode.nextSibling) ||
      (lineIndex >= linePositions.length - 1 &&
        lastNode.parentElement.querySelector(".MJXc-display")) // for MathJax
    ) {
      // Prevent unnecessary page break before the last line
      // when a block box (may be generated by MathJax) exists
      // just after the text or inline box.
      widows = 0;
    }

    // First edge after the one that both fits and satisfies widows constraint.
    lineIndex = Math.min(linePositions.length - widows, lineIndex);
    if (lineIndex < orphans) {
      // Not enough lines to satisfy orphans constraint, cannot break here.
      return null;
    }
    edge = linePositions[lineIndex - 1];
    let nodeContext: Vtree.NodeContext;
    if (forceCutBeforeOverflowing) {
      nodeContext = firstOverflowing.checkPoint;
    } else {
      nodeContext = this.findAcceptableBreakInside(bp.checkPoints, edge, force);
    }
    if (nodeContext) {
      // When line-height is small, the edge calculated above (using Range)
      // can be larger than the edge of the block container containing the text.
      // We update the edge by measuring the block edge.
      const blockEdge = this.getAfterEdgeOfBlockContainer(nodeContext);
      if (!isNaN(blockEdge) && blockEdge < edge) {
        edge = blockEdge;
      }
      this.computedBlockSize =
        dir * (edge - this.beforeEdge) + repetitiveElementsOffset;
    }
    return nodeContext;
  }

  getAfterEdgeOfBlockContainer(nodeContext: Vtree.NodeContext): number {
    let blockParent = nodeContext;
    do {
      blockParent = blockParent.parent;
    } while (blockParent && blockParent.inline);
    if (blockParent) {
      blockParent = blockParent.copy().modify();
      blockParent.after = true;
      return LayoutHelper.calculateEdge(
        blockParent,
        this.clientLayout,
        0,
        this.vertical,
      );
    } else {
      return NaN;
    }
  }

  findFirstOverflowingEdgeAndCheckPoint(checkPoints: Vtree.NodeContext[]): {
    edge: number;
    checkPoint: Vtree.NodeContext | null;
  } {
    const index = checkPoints.findIndex((cp) => cp.overflow);
    if (index < 0) {
      return { edge: NaN, checkPoint: null };
    }
    const cp = checkPoints[index];
    return {
      edge: this.calculateEdge(null, checkPoints, index, cp.boxOffset),
      checkPoint: cp,
    };
  }

  findEdgeBreakPosition(
    bp: BreakPosition.EdgeBreakPosition,
  ): Vtree.NodeContext {
    this.computedBlockSize =
      bp.computedBlockSize + this.getOffsetByRepetitiveElements(bp);
    return bp.position;
  }

  /**
   * Finalize a line break.
   * @return holing true
   */
  finishBreak(
    nodeContext: Vtree.NodeContext,
    forceRemoveSelf: boolean,
    endOfColumn: boolean,
  ): Task.Result<boolean> {
    Asserts.assert(nodeContext.formattingContext);
    const layoutProcessor = new LayoutProcessor.LayoutProcessorResolver().find(
      nodeContext.formattingContext,
    );
    let result = layoutProcessor.finishBreak(
      this,
      nodeContext,
      forceRemoveSelf,
      endOfColumn,
    );
    if (!result) {
      result = LayoutProcessor.blockLayoutProcessor.finishBreak(
        this,
        nodeContext,
        forceRemoveSelf,
        endOfColumn,
      );
    }
    return result;
  }

  findAcceptableBreakPosition(): BreakPositionAndNodeContext {
    let bp: Layout.BreakPosition = null;
    let nodeContext: Vtree.NodeContext = null;
    let penalty = 0;
    let nextPenalty = 0;
    do {
      penalty = nextPenalty;
      nextPenalty = Number.MAX_VALUE;
      for (
        let i = this.breakPositions.length - 1;
        i >= 0 && !nodeContext;
        --i
      ) {
        bp = this.breakPositions[i];
        nodeContext = bp.findAcceptableBreak(this, penalty);
        const minPenalty = bp.getMinBreakPenalty();
        if (minPenalty > penalty) {
          nextPenalty = Math.min(nextPenalty, minPenalty);
        }
      }
    } while (
      // Don't need to find a non-optimal break position if
      // forceNonfitting=false
      nextPenalty > penalty &&
      !nodeContext &&
      this.forceNonfitting
    );
    return { breakPosition: nodeContext ? bp : null, nodeContext };
  }

  doFinishBreak(
    nodeContext: Vtree.NodeContext,
    overflownNodeContext: Vtree.NodeContext,
    initialNodeContext: Vtree.NodeContext,
    initialComputedBlockSize: number,
  ): Task.Result<Vtree.NodeContext> {
    if (
      this.pageFloatLayoutContext.isInvalidated() ||
      this.pageBreakType ||
      !overflownNodeContext
    ) {
      return Task.newResult(nodeContext);
    }
    const frame: Task.Frame<Vtree.NodeContext> = Task.newFrame("doFinishBreak");
    let forceRemoveSelf = false;
    if (!nodeContext) {
      // Last resort
      if (this.forceNonfitting) {
        Logging.logger.warn("Could not find any page breaks?!!");
        this.skipTailEdges(overflownNodeContext).then((nodeContext) => {
          if (nodeContext) {
            nodeContext = nodeContext.modify();
            nodeContext.overflow = false;
            this.finishBreak(nodeContext, forceRemoveSelf, true).then(() => {
              frame.finish(nodeContext);
            });
          } else {
            frame.finish(nodeContext);
          }
        });
        return frame.result();
      } else {
        nodeContext = initialNodeContext;
        forceRemoveSelf = true;
        this.computedBlockSize = initialComputedBlockSize;
      }
    }
    this.finishBreak(nodeContext, forceRemoveSelf, true).then(() => {
      frame.finish(nodeContext);
    });
    return frame.result();
  }

  /**
   * Determines if a page break is acceptable at this position
   */
  isBreakable(flowPosition: Vtree.NodeContext): boolean {
    for (let nc = flowPosition; nc; nc = nc.parent) {
      if (LayoutHelper.isOutOfFlow(nc.viewNode)) {
        return false;
      }
    }
    if (flowPosition.after) {
      return true; // may be an empty block
    }
    switch ((flowPosition.sourceNode as Element).namespaceURI) {
      case Base.NS.SVG:
        return false;
    }
    return !flowPosition.flexContainer;
  }

  /**
   * Determines if an indent value is zero
   */
  zeroIndent(val: string | number): boolean {
    const s = val.toString();
    return s == "" || s == "auto" || !!s.match(/^0+(.0*)?[^0-9]/);
  }

  /**
   * @return true if overflows
   */
  checkOverflowAndSaveEdge(
    nodeContext: Vtree.NodeContext,
    trailingEdgeContexts: Vtree.NodeContext[],
  ): boolean {
    if (!nodeContext) {
      return false;
    }
    for (let nc = nodeContext; nc; nc = nc.parent) {
      if (LayoutHelper.isOutOfFlow(nc.viewNode)) {
        return false;
      }
    }
    if (LayoutHelper.isOrphan(nodeContext.viewNode)) {
      return false;
    }
    let edge = LayoutHelper.calculateEdge(
      nodeContext,
      this.clientLayout,
      0,
      this.vertical,
    );
    const offsets = BreakPosition.calculateOffset(
      nodeContext,
      this.collectElementsOffset(),
    );
    const overflown = this.isOverflown(
      edge + (this.vertical ? -1 : 1) * offsets.minimum,
    );
    if (
      this.isOverflown(edge + (this.vertical ? -1 : 1) * offsets.current) &&
      !this.nodeContextOverflowingDueToRepetitiveElements
    ) {
      this.nodeContextOverflowingDueToRepetitiveElements = nodeContext;
    } else if (trailingEdgeContexts) {
      // If the edge does not overflow add the trailing margin, which is
      // truncated to the remaining fragmentainer extent.
      const marginEdge =
        edge + this.getTrailingMarginEdgeAdjustment(trailingEdgeContexts);
      const footnoteEdge =
        this.footnoteEdge - this.getBoxDir() * offsets.current;
      edge = this.vertical
        ? Math.min(edge, Math.max(marginEdge, footnoteEdge))
        : Math.max(edge, Math.min(marginEdge, footnoteEdge));
    }
    this.updateMaxReachedAfterEdge(edge);
    return overflown;
  }

  /**
   * Save a possible page break position on a CSS block edge. Check if it
   * overflows.
   * @return true if overflows
   */
  checkOverflowAndSaveEdgeAndBreakPosition(
    nodeContext: Vtree.NodeContext,
    trailingEdgeContexts: Vtree.NodeContext[],
    saveEvenOverflown: boolean,
    breakAtTheEdge: string | null,
  ): boolean {
    if (!nodeContext) {
      return false;
    }
    if (LayoutHelper.isOrphan(nodeContext.viewNode)) {
      return false;
    }
    const overflown = this.checkOverflowAndSaveEdge(
      nodeContext,
      trailingEdgeContexts,
    );
    if (saveEvenOverflown || !overflown) {
      this.saveEdgeBreakPosition(nodeContext, breakAtTheEdge, overflown);
    }
    return overflown;
  }

  applyClearance(nodeContext: Vtree.NodeContext): boolean {
    if (!nodeContext.viewNode.parentNode) {
      // Cannot do ceralance for nodes without parents
      return false;
    }

    // measure where the edge of the element would be without clearance
    const margin = this.getComputedMargin(nodeContext.viewNode as Element);
    const spacer = nodeContext.viewNode.ownerDocument.createElement("div");
    if (this.vertical) {
      spacer.style.bottom = "0px";
      spacer.style.width = "1px";
      spacer.style.marginRight = `${margin.right}px`;
    } else {
      spacer.style.right = "0px";
      spacer.style.height = "1px";
      spacer.style.marginTop = `${margin.top}px`;
    }
    nodeContext.viewNode.parentNode.insertBefore(spacer, nodeContext.viewNode);
    let spacerBox = this.clientLayout.getElementClientRect(spacer);
    const edge = this.getBeforeEdge(spacerBox);
    const dir = this.getBoxDir();
    const clear = nodeContext.clearSide;
    let clearEdge = -this.getBoxDir() * Infinity;
    if (clear === "all") {
      clearEdge = this.pageFloatLayoutContext.getPageFloatClearEdge(
        clear,
        this,
      );
    }
    const clearLR = /^(top|bottom|(block|inline)-(start|end))$/.test(clear)
      ? PageFloats.resolveInlineFloatDirection(
          clear,
          nodeContext.vertical,
          nodeContext.direction,
        )
      : clear;
    switch (clearLR) {
      case "left":
        clearEdge = dir * Math.max(clearEdge * dir, this.leftFloatEdge * dir);
        break;
      case "right":
        clearEdge = dir * Math.max(clearEdge * dir, this.rightFloatEdge * dir);
        break;
      default:
        clearEdge =
          dir *
          Math.max(
            clearEdge * dir,
            Math.max(this.rightFloatEdge * dir, this.leftFloatEdge * dir),
          );
    }

    // edge holds the position where element border "before" edge will be
    // without clearance. clearEdge is the "after" edge of the float to clear.
    if (edge * dir >= clearEdge * dir) {
      // No need for clearance
      nodeContext.viewNode.parentNode.removeChild(spacer);
      return false;
    } else {
      // Need some clearance, determine how much. Add the clearance node,
      // measure its after edge and adjust after margin (required due to
      // possible margin collapse before clearance was introduced).
      const height = Math.max(1, (clearEdge - edge) * dir);
      if (this.vertical) {
        spacer.style.width = `${height}px`;
      } else {
        spacer.style.height = `${height}px`;
      }
      spacerBox = this.clientLayout.getElementClientRect(spacer);
      const afterEdge = this.getAfterEdge(spacerBox);
      if (!nodeContext.floatSide) {
        if (this.vertical) {
          let wAdj = afterEdge + margin.right - clearEdge;
          if (wAdj > 0 == margin.right >= 0) {
            // In addition to collapsed portion
            wAdj += margin.right;
          }
          spacer.style.marginLeft = `${wAdj}px`;
        } else {
          let hAdj = clearEdge - (afterEdge + margin.top);
          if (hAdj > 0 == margin.top >= 0) {
            // In addition to collapsed portion
            hAdj += margin.top;
          }
          spacer.style.marginBottom = `${hAdj}px`;
        }
      }
      nodeContext.clearSpacer = spacer;
      return true;
    }
  }

  isBFC(formattingContext: Vtree.FormattingContext): boolean {
    if (LayoutProcessor.isInstanceOfBlockFormattingContext(formattingContext)) {
      return true;
    }
    if (
      RepetitiveElement.isInstanceOfRepetitiveElementsOwnerFormattingContext(
        formattingContext,
      )
    ) {
      return true;
    }
    return false;
  }

  /**
   * Skips positions until either the start of unbreakable block or inline
   * content. Also sets breakBefore on the result combining break-before and
   * break-after properties from all elements that meet at the edge.
   */
  skipEdges(
    nodeContext: Vtree.NodeContext,
    leadingEdge: boolean,
    forcedBreakValue: string | null,
  ): Task.Result<Vtree.NodeContext> {
    const fc = nodeContext.after
      ? nodeContext.parent?.formattingContext
      : nodeContext.formattingContext;
    if (fc && !this.isBFC(fc)) {
      return Task.newResult(nodeContext);
    }
    const frame: Task.Frame<Vtree.NodeContext> = Task.newFrame("skipEdges");

    // If a forced break occurred at the end of the previous column,
    // nodeContext.after should be false.
    let atUnforcedBreak =
      !forcedBreakValue && leadingEdge && nodeContext && nodeContext.after;
    let breakAtTheEdge = forcedBreakValue;
    let lastAfterNodeContext: Vtree.NodeContext = null;
    let leadingEdgeContexts: Vtree.NodeContext[] = [];
    let trailingEdgeContexts: Vtree.NodeContext[] = [];
    let onStartEdges = false;

    function needForcedBreak(): boolean {
      // leadingEdge=true means that we are at the beginning of the new column
      // and hence must avoid a break (Otherwise leading to an infinite loop)
      return (
        !!forcedBreakValue ||
        (!leadingEdge &&
          Break.isForcedBreakValue(breakAtTheEdge) &&
          // prevent unnecessary breaks at the beginning of the column/page
          // after out-of-flow elements, e.g. position:absolute or running().
          // (Issue #1176)
          !atLeadingEdgeIgnoringOutOfFlow())
      );
    }

    function atLeadingEdgeIgnoringOutOfFlow(): boolean {
      if (!lastAfterNodeContext) {
        return false;
      }
      // Exclude if itself is a float (Issue #1288)
      if (nodeContext.floatSide) {
        return false;
      }
      for (let nc = lastAfterNodeContext; nc?.parent; nc = nc.parent) {
        let node = nc.after ? nc.viewNode : nc.viewNode?.previousSibling;
        while (
          node &&
          (VtreeImpl.canIgnore(node, nc.parent.whitespace) ||
            LayoutHelper.isOutOfFlow(node))
        ) {
          node = node.previousSibling;
        }
        if (node) {
          return false;
        }
      }
      return true;
    }

    const processForcedBreak = () => {
      nodeContext = leadingEdgeContexts[0] || nodeContext;
      nodeContext.viewNode.parentNode.removeChild(nodeContext.viewNode);
      this.pageBreakType = breakAtTheEdge;
    };

    frame
      .loopWithFrame((loopFrame) => {
        while (nodeContext) {
          Asserts.assert(nodeContext.formattingContext);
          const layoutProcessor =
            new LayoutProcessor.LayoutProcessorResolver().find(
              nodeContext.formattingContext,
            );

          // A code block to be able to use break. Break moves to the next
          // node position.
          do {
            if (!nodeContext.viewNode) {
              // Non-displayable content, skip
              break;
            }
            if (nodeContext.inline && nodeContext.viewNode.nodeType != 1) {
              if (
                VtreeImpl.canIgnore(
                  nodeContext.viewNode,
                  nodeContext.whitespace,
                )
              ) {
                // Ignorable text content, skip
                break;
              }
              if (!nodeContext.after) {
                // Leading edge of non-empty block -> finished going through
                // all starting edges of the box
                if (needForcedBreak()) {
                  processForcedBreak();
                } else if (
                  this.checkOverflowAndSaveEdgeAndBreakPosition(
                    lastAfterNodeContext,
                    null,
                    true,
                    breakAtTheEdge,
                  )
                ) {
                  nodeContext = (
                    this.stopAtOverflow
                      ? lastAfterNodeContext || nodeContext
                      : nodeContext
                  ).modify();
                  nodeContext.overflow = true;
                } else {
                  nodeContext = nodeContext.modify();
                  nodeContext.breakBefore = breakAtTheEdge;
                }
                loopFrame.breakLoop();
                return;
              }
            }
            if (!nodeContext.after) {
              if (nodeContext.floatSide) {
                // Save break-after:avoid* value at before the float
                // (Fix for issue #904)
                this.breakAtTheEdgeBeforeFloat = Break.isAvoidBreakValue(
                  breakAtTheEdge,
                )
                  ? breakAtTheEdge
                  : null;
              }
              if (layoutProcessor) {
                if (layoutProcessor.startNonInlineElementNode(nodeContext)) {
                  break;
                }
              }
              if (nodeContext.clearSide) {
                // clear
                if (
                  this.applyClearance(nodeContext) &&
                  leadingEdge &&
                  this.breakPositions.length === 0
                ) {
                  this.saveEdgeBreakPosition(
                    nodeContext.copy(),
                    breakAtTheEdge,
                    false,
                  );
                }
              }
              // Check break opportunity between anonymous block box and block-level box
              // (Issue #611)
              if (
                !nodeContext.inline &&
                !nodeContext.repeatOnBreak &&
                (lastAfterNodeContext
                  ? LayoutHelper.findAncestorSpecialInlineNodeContext(
                      lastAfterNodeContext,
                    )
                  : this.breakPositions[
                      this.breakPositions.length - 1
                    ] instanceof BoxBreakPosition)
              ) {
                this.saveEdgeBreakPosition(
                  nodeContext.copy(),
                  breakAtTheEdge,
                  false,
                );
              }
              if (
                !this.isBFC(nodeContext.formattingContext) ||
                RepetitiveElement.isInstanceOfRepetitiveElementsOwnerFormattingContext(
                  nodeContext.formattingContext,
                ) ||
                this.isFloatNodeContext(nodeContext) ||
                nodeContext.flexContainer ||
                // Check empty block box (Issue #749)
                (!nodeContext.nodeShadow &&
                  !(nodeContext.sourceNode as Element).firstElementChild &&
                  VtreeImpl.canIgnore(
                    nodeContext.sourceNode.firstChild,
                    nodeContext.whitespace,
                  ))
              ) {
                // new formatting context, or float or flex container,
                // or empty block box (unbreakable)
                leadingEdgeContexts.push(nodeContext.copy());
                breakAtTheEdge = Break.resolveEffectiveBreakValue(
                  breakAtTheEdge,
                  nodeContext.breakBefore,
                );

                // check if a forced break must occur before the block.
                if (needForcedBreak()) {
                  processForcedBreak();
                } else if (
                  this.checkOverflowAndSaveEdgeAndBreakPosition(
                    lastAfterNodeContext,
                    null,
                    true,
                    breakAtTheEdge,
                  ) ||
                  !this.layoutConstraint.allowLayout(nodeContext)
                ) {
                  // overflow
                  nodeContext = (
                    this.stopAtOverflow
                      ? lastAfterNodeContext || nodeContext
                      : nodeContext
                  ).modify();
                  nodeContext.overflow = true;
                }
                loopFrame.breakLoop();
                return;
              }
            }
            if (nodeContext.viewNode.nodeType != 1) {
              // not an element
              break;
            }
            const style = (nodeContext.viewNode as HTMLElement).style;
            if (nodeContext.after) {
              if (nodeContext.floatSide) {
                // Restore break-after:avoid* value at before the float
                // (Fix for issue #904)
                breakAtTheEdge =
                  breakAtTheEdge ?? this.breakAtTheEdgeBeforeFloat;
                this.breakAtTheEdgeBeforeFloat = null;
              }
              const element = nodeContext.sourceNode as Element;
              // Make breakable after svg and math elements
              // (Fix for issue #750)
              if (
                element.localName === "svg" ||
                element.localName === "math" ||
                element.getAttribute("data-math-typeset") === "true"
              ) {
                onStartEdges = false;
                lastAfterNodeContext = nodeContext.copy();
                trailingEdgeContexts.push(lastAfterNodeContext);
                breakAtTheEdge = Break.resolveEffectiveBreakValue(
                  null,
                  nodeContext.breakAfter,
                );
                this.checkOverflowAndSaveEdgeAndBreakPosition(
                  lastAfterNodeContext,
                  null,
                  !this.stopAtOverflow,
                  breakAtTheEdge,
                );
                break;
              }
              // Skip an empty inline box at the start of a block
              // (An anonymous block consisting entirely of
              // collapsible white space is removed from the rendering tree)
              if (nodeContext.inline) {
                break;
              }
              if (layoutProcessor) {
                if (
                  layoutProcessor.afterNonInlineElementNode(
                    nodeContext,
                    this.stopAtOverflow,
                  )
                ) {
                  break;
                }
              }

              // Trailing edge
              if (onStartEdges) {
                // finished going through all starting edges of the box.
                // check if a forced break must occur before the block.
                if (needForcedBreak()) {
                  processForcedBreak();
                  loopFrame.breakLoop();
                  return;
                }

                // since a break did not occur, move to the next edge. this
                // edge is no longer the leading edge.
                leadingEdgeContexts = [];
                leadingEdge = false;
                atUnforcedBreak = false;
                breakAtTheEdge = null;
              }
              onStartEdges = false; // we are now on end edges.
              lastAfterNodeContext = nodeContext.copy();
              trailingEdgeContexts.push(lastAfterNodeContext);
              breakAtTheEdge = Break.resolveEffectiveBreakValue(
                breakAtTheEdge,
                nodeContext.breakAfter,
              );
              if (
                style &&
                !(
                  this.zeroIndent(style.paddingBottom) &&
                  this.zeroIndent(style.borderBottomWidth)
                )
              ) {
                // Non-zero trailing inset.
                // Margins don't collapse across non-zero borders and
                // paddings.
                trailingEdgeContexts = [lastAfterNodeContext];
              }
            } else {
              // Leading edge
              leadingEdgeContexts.push(nodeContext.copy());
              breakAtTheEdge = Break.resolveEffectiveBreakValue(
                breakAtTheEdge,
                nodeContext.breakBefore,
              );
              if (
                (nodeContext.pageType != nodeContext.parent?.pageType || // Fix for issue #771
                  !Break.isForcedBreakValue(breakAtTheEdge)) && // Fix for issue #722
                !this.layoutConstraint.allowLayout(nodeContext)
              ) {
                this.checkOverflowAndSaveEdgeAndBreakPosition(
                  lastAfterNodeContext,
                  null,
                  !this.stopAtOverflow,
                  breakAtTheEdge,
                );
                nodeContext = nodeContext.modify();
                nodeContext.overflow = true;
                if (this.stopAtOverflow) {
                  loopFrame.breakLoop();
                  return;
                }
              }
              const viewTag = (nodeContext.viewNode as Element).localName;
              if (Base.mediaTags[viewTag]) {
                // elements that have inherent content
                // check if a forced break must occur before the block.
                if (needForcedBreak()) {
                  processForcedBreak();
                } else if (
                  this.checkOverflowAndSaveEdgeAndBreakPosition(
                    lastAfterNodeContext,
                    null,
                    true,
                    breakAtTheEdge,
                  )
                ) {
                  // overflow
                  nodeContext = (
                    this.stopAtOverflow
                      ? lastAfterNodeContext || nodeContext
                      : nodeContext
                  ).modify();
                  nodeContext.overflow = true;
                }
                loopFrame.breakLoop();
                return;
              }
              if (
                style &&
                !(
                  this.zeroIndent(style.paddingTop) &&
                  this.zeroIndent(style.borderTopWidth)
                )
              ) {
                // Non-zero leading inset
                atUnforcedBreak = false;
                trailingEdgeContexts = [];
              }
              onStartEdges = true; // we are now on starting edges.
            }
          } while (false); // End of block of code to use break

          const nextResult = this.nextInTree(nodeContext, atUnforcedBreak);
          if (nextResult.isPending()) {
            nextResult.then((nodeContextParam) => {
              nodeContext = nodeContextParam;
              loopFrame.continueLoop();
            });
            return;
          } else {
            nodeContext = nextResult.get();
          }
        }

        if (
          this.checkOverflowAndSaveEdgeAndBreakPosition(
            lastAfterNodeContext,
            trailingEdgeContexts,
            !this.stopAtOverflow,
            breakAtTheEdge,
          )
        ) {
          if (lastAfterNodeContext && this.stopAtOverflow) {
            nodeContext = lastAfterNodeContext.modify();
            nodeContext.overflow = true;
          } else {
            // TODO: what to return here??
          }
        } else if (Break.isForcedBreakValue(breakAtTheEdge)) {
          this.pageBreakType = breakAtTheEdge;
        }
        loopFrame.breakLoop();
      })
      .then(() => {
        if (lastAfterNodeContext) {
          this.lastAfterPosition = lastAfterNodeContext.toNodePosition();
        }
        frame.finish(nodeContext);
      });
    return frame.result();
  }

  /**
   * Skips non-renderable positions until it hits the end of the flow or some
   * renderable content. Returns the nodeContext that was passed in if some
   * content remains and null if all content could be skipped.
   */
  skipTailEdges(
    nodeContext: Vtree.NodeContext,
  ): Task.Result<Vtree.NodeContext> {
    let resultNodeContext = nodeContext.copy();
    const frame: Task.Frame<Vtree.NodeContext> = Task.newFrame("skipEdges");
    let breakAtTheEdge: string | null = null;
    let onStartEdges = false;
    frame
      .loopWithFrame((loopFrame) => {
        while (nodeContext) {
          // A code block to be able to use break. Break moves to the next
          // node position.
          do {
            if (!nodeContext.viewNode) {
              // Non-displayable content, skip
              break;
            }
            if (nodeContext.inline && nodeContext.viewNode.nodeType != 1) {
              if (
                VtreeImpl.canIgnore(
                  nodeContext.viewNode,
                  nodeContext.whitespace,
                )
              ) {
                // Ignorable text content, skip
                break;
              }
              if (!nodeContext.after) {
                // Leading edge of non-empty block -> finished going through
                // all starting edges of the box
                if (Break.isForcedBreakValue(breakAtTheEdge)) {
                  this.pageBreakType = breakAtTheEdge;
                }
                loopFrame.breakLoop();
                return;
              }
            }
            if (!nodeContext.after) {
              if (
                this.isFloatNodeContext(nodeContext) ||
                nodeContext.flexContainer
              ) {
                // float or flex container (unbreakable)
                breakAtTheEdge = Break.resolveEffectiveBreakValue(
                  breakAtTheEdge,
                  nodeContext.breakBefore,
                );

                // check if a forced break must occur before the block.
                if (Break.isForcedBreakValue(breakAtTheEdge)) {
                  this.pageBreakType = breakAtTheEdge;
                }
                loopFrame.breakLoop();
                return;
              }
            }
            if (nodeContext.viewNode.nodeType != 1) {
              // not an element
              break;
            }
            const style = (nodeContext.viewNode as HTMLElement).style;
            if (nodeContext.after) {
              // Trailing edge
              if (onStartEdges) {
                // finished going through all starting edges of the box.
                // check if a forced break must occur before the block.
                if (Break.isForcedBreakValue(breakAtTheEdge)) {
                  this.pageBreakType = breakAtTheEdge;
                  loopFrame.breakLoop();
                  return;
                }

                // since a break did not occur, move to the next edge.
                breakAtTheEdge = null;
              }
              onStartEdges = false; // we are now on end edges.
              breakAtTheEdge = Break.resolveEffectiveBreakValue(
                breakAtTheEdge,
                nodeContext.breakAfter,
              );
            } else {
              // Leading edge
              breakAtTheEdge = Break.resolveEffectiveBreakValue(
                breakAtTheEdge,
                nodeContext.breakBefore,
              );
              const viewTag = (nodeContext.viewNode as Element).localName;
              if (Base.mediaTags[viewTag]) {
                // elements that have inherent content
                // check if a forced break must occur before the block.
                if (Break.isForcedBreakValue(breakAtTheEdge)) {
                  this.pageBreakType = breakAtTheEdge;
                }
                loopFrame.breakLoop();
                return;
              }
              if (
                style &&
                !(
                  this.zeroIndent(style.paddingTop) &&
                  this.zeroIndent(style.borderTopWidth)
                )
              ) {
                // Non-zero leading inset
                loopFrame.breakLoop();
                return;
              }
            }
            onStartEdges = true; // we are now on starting edges.
          } while (false); // End of block of code to use break

          const nextResult = this.layoutContext.nextInTree(nodeContext);
          if (nextResult.isPending()) {
            nextResult.then((nodeContextParam) => {
              nodeContext = nodeContextParam;
              loopFrame.continueLoop();
            });
            return;
          } else {
            nodeContext = nextResult.get();
          }
        }
        resultNodeContext = null;
        loopFrame.breakLoop();
      })
      .then(() => {
        frame.finish(resultNodeContext);
      });
    return frame.result();
  }

  layoutFloatOrFootnote(
    nodeContext: Vtree.NodeContext,
  ): Task.Result<Vtree.NodeContext> {
    if (
      PageFloats.isPageFloat(nodeContext.floatReference) ||
      nodeContext.floatSide === "footnote"
    ) {
      return this.layoutPageFloat(nodeContext);
    } else {
      return this.layoutFloat(nodeContext);
    }
  }

  /**
   * Layout next portion of the source.
   */
  layoutNext(
    nodeContext: Vtree.NodeContext,
    leadingEdge: boolean,
    forcedBreakValue?: string | null,
  ): Task.Result<Vtree.NodeContext> {
    const frame: Task.Frame<Vtree.NodeContext> = Task.newFrame("layoutNext");
    this.skipEdges(nodeContext, leadingEdge, forcedBreakValue || null).then(
      (nodeContextParam) => {
        nodeContext = nodeContextParam as Vtree.NodeContext;
        if (
          !nodeContext ||
          this.pageBreakType ||
          this.stopByOverflow(nodeContext)
        ) {
          // finished all content, explicit page break or overflow (automatic
          // page break)
          frame.finish(nodeContext);
        } else {
          const formattingContext = nodeContext.formattingContext;
          Asserts.assert(formattingContext);
          const layoutProcessor =
            new LayoutProcessor.LayoutProcessorResolver().find(
              formattingContext,
            );
          layoutProcessor
            .layout(nodeContext, this, leadingEdge)
            .thenFinish(frame);
        }
      },
    );
    return frame.result();
  }

  clearOverflownViewNodes(
    nodeContext: Vtree.NodeContext,
    removeSelf: boolean,
  ): void {
    if (!nodeContext) {
      return;
    }
    for (
      let parent = nodeContext.parent;
      nodeContext;
      nodeContext = parent, parent = parent ? parent.parent : null
    ) {
      const formattingContext = (parent || nodeContext).formattingContext;
      Asserts.assert(formattingContext);
      const layoutProcessor =
        new LayoutProcessor.LayoutProcessorResolver().find(formattingContext);
      layoutProcessor.clearOverflownViewNodes(
        this,
        parent,
        nodeContext,
        removeSelf,
      );
      removeSelf = false;
    }
  }

  initGeom(): void {
    // TODO: we should be able to avoid querying the layout engine at this
    // point. Create an element that fills the content area and query its size.
    // Calling getElementClientRect on the container element includes element
    // padding which is wrong for our purposes.
    const probe = this.element.ownerDocument.createElement(
      "div",
    ) as HTMLElement;
    probe.style.position = "absolute";
    probe.style.top = `${this.paddingTop}px`;
    probe.style.right = `${this.paddingRight}px`;
    probe.style.bottom = `${this.paddingBottom}px`;
    probe.style.left = `${this.paddingLeft}px`;
    this.element.appendChild(probe);
    const columnBBox = this.clientLayout.getElementClientRect(probe);
    this.element.removeChild(probe);
    const offsetX = this.originX + this.left + this.getInsetLeft();
    const offsetY = this.originY + this.top + this.getInsetTop();
    this.box = new GeometryUtil.Rect(
      offsetX,
      offsetY,
      offsetX + this.width,
      offsetY + this.height,
    );
    this.startEdge = columnBBox
      ? this.vertical
        ? this.rtl
          ? columnBBox.bottom
          : columnBBox.top
        : this.rtl
          ? columnBBox.right
          : columnBBox.left
      : 0;
    this.endEdge = columnBBox
      ? this.vertical
        ? this.rtl
          ? columnBBox.top
          : columnBBox.bottom
        : this.rtl
          ? columnBBox.left
          : columnBBox.right
      : 0;
    this.beforeEdge = columnBBox
      ? this.vertical
        ? columnBBox.right
        : columnBBox.top
      : 0;
    this.afterEdge = columnBBox
      ? this.vertical
        ? columnBBox.left
        : columnBBox.bottom
      : 0;
    this.leftFloatEdge = this.beforeEdge;
    this.rightFloatEdge = this.beforeEdge;
    this.bottommostFloatTop = this.beforeEdge;
    this.footnoteEdge = this.afterEdge;
    this.bands = GeometryUtil.shapesToBands(
      this.box,
      [this.getInnerShape()],
      this.getExclusions(),
      8,
      this.snapHeight,
      this.vertical,
    );
    this.createFloats();
  }

  init(): void {
    this.chunkPositions = [];
    Base.setCSSProperty(this.element, "width", `${this.width}px`);
    Base.setCSSProperty(this.element, "height", `${this.height}px`);
    this.initGeom();
    this.computedBlockSize = 0;
    this.overflown = false;
    this.pageBreakType = null;
    this.lastAfterPosition = null;
  }

  /**
   * Save the potential breaking position at the edge. Should, in general, save
   * "after" position but only after skipping all of the "before" ones and
   * getting to the non-empty content (to get breakAtEdge right).
   */
  saveEdgeBreakPosition(
    position: Vtree.NodeContext,
    breakAtEdge: string | null,
    overflows: boolean,
  ): void {
    Asserts.assert(position.formattingContext);
    const copy = position.copy();
    const layoutProcessor = new LayoutProcessor.LayoutProcessorResolver().find(
      position.formattingContext,
    );
    const clonedPaddingBorder = this.calculateClonedPaddingBorder(copy);
    const bp = layoutProcessor.createEdgeBreakPosition(
      copy,
      breakAtEdge,
      overflows,
      this.computedBlockSize + clonedPaddingBorder,
    );
    this.breakPositions.push(bp);
  }

  /**
   * @param checkPoints array of breaking points for breakable block
   */
  saveBoxBreakPosition(checkPoints: Vtree.NodeContext[]): void {
    let penalty = checkPoints[0].breakPenalty;
    if (penalty) {
      // Fix for issue #546
      let block = checkPoints[0];
      while (block.parent && block.inline) {
        block = block.parent;
      }
      penalty = block.breakPenalty;
    }
    const bp = new BoxBreakPosition(checkPoints, penalty);
    this.breakPositions.push(bp);
  }

  updateMaxReachedAfterEdge(afterEdge: number) {
    if (!isNaN(afterEdge)) {
      const size = this.getBoxDir() * (afterEdge - this.beforeEdge);
      this.computedBlockSize = Math.max(size, this.computedBlockSize);
    }
  }

  /**
   * @param chunkPosition starting position.
   * @return holding end position.
   */
  layout(
    chunkPosition: Vtree.ChunkPosition,
    leadingEdge: boolean,
    breakAfter?: string | null,
  ): Task.Result<Vtree.ChunkPosition> {
    this.chunkPositions.push(chunkPosition); // So we can re-layout this column later
    if (chunkPosition.primary.after) {
      this.lastAfterPosition = chunkPosition.primary;
    }
    if (this.stopAtOverflow && this.overflown) {
      return Task.newResult(chunkPosition as Vtree.ChunkPosition);
    }
    if (this.isFullWithPageFloats()) {
      if (
        chunkPosition.primary.after &&
        chunkPosition.primary.steps.length === 1
      ) {
        // End of contents
        return Task.newResult(null as Vtree.ChunkPosition);
      } else {
        return Task.newResult(chunkPosition as Vtree.ChunkPosition);
      }
    }
    const frame: Task.Frame<Vtree.ChunkPosition> = Task.newFrame("layout");

    // ------ start the column -----------
    this.openAllViews(chunkPosition.primary).then((nodeContext) => {
      let initialNodeContext: Vtree.NodeContext = null;
      if (nodeContext.viewNode) {
        initialNodeContext = nodeContext.copy();
      } else {
        const nextInTreeListener = (evt) => {
          if (evt.nodeContext.viewNode) {
            initialNodeContext = evt.nodeContext;
            this.layoutContext.removeEventListener(
              "nextInTree",
              nextInTreeListener,
            );
          }
        };
        this.layoutContext.addEventListener("nextInTree", nextInTreeListener);
      }
      const retryer = new ColumnLayoutRetryer(leadingEdge, breakAfter);
      retryer.layout(nodeContext, this).then((nodeContextParam) => {
        this.doFinishBreak(
          nodeContextParam,
          retryer.context.overflownNodeContext,
          initialNodeContext,
          retryer.initialComputedBlockSize,
        ).then((positionAfter) => {
          let cont: Task.Result<boolean> = null;
          if (!this.pseudoParent) {
            cont = this.doFinishBreakOfFragmentLayoutConstraints(positionAfter);
          } else {
            cont = Task.newResult(null);
          }
          cont.then(() => {
            if (this.pageFloatLayoutContext.isInvalidated()) {
              frame.finish(null);
              return;
            }
            if (!positionAfter) {
              frame.finish(null);
            } else {
              this.overflown = true;
              const result = new VtreeImpl.ChunkPosition(
                positionAfter.toNodePosition(),
              );
              frame.finish(result);
            }
          });
        });
      });
    });
    return frame.result();
  }

  isFullWithPageFloats(): boolean {
    return this.pageFloatLayoutContext.isColumnFullWithPageFloats(this);
  }

  getMaxBlockSizeOfPageFloats(): number {
    return this.pageFloatLayoutContext.getMaxBlockSizeOfPageFloats();
  }

  doFinishBreakOfFragmentLayoutConstraints(
    nodeContext: Vtree.NodeContext,
  ): Task.Result<boolean> {
    const frame: Task.Frame<boolean> = Task.newFrame(
      "doFinishBreakOfFragmentLayoutConstraints",
    );
    const sortedFragmentLayoutConstraints = [].concat(
      this.fragmentLayoutConstraints,
    );
    sortedFragmentLayoutConstraints.sort(
      (a, b) => a.getPriorityOfFinishBreak() - b.getPriorityOfFinishBreak(),
    );
    let i = 0;
    frame
      .loop(() => {
        if (i < sortedFragmentLayoutConstraints.length) {
          const result = sortedFragmentLayoutConstraints[i++].finishBreak(
            nodeContext,
            this,
          );
          return result.thenReturn(true);
        } else {
          return Task.newResult(false);
        }
      })
      .then(() => {
        frame.finish(true);
      });
    return frame.result();
  }

  /**
   * @param nodeContext starting position.
   * @return holding end position.
   */
  doLayout(
    nodeContext: Vtree.NodeContext,
    leadingEdge: boolean,
    breakAfter?: string | null,
  ): Task.Result<{
    nodeContext: Vtree.NodeContext;
    overflownNodeContext: Vtree.NodeContext;
  }> {
    const frame: Task.Frame<{
      nodeContext: Vtree.NodeContext;
      overflownNodeContext: Vtree.NodeContext;
    }> = Task.newFrame("doLayout");
    let overflownNodeContext: Vtree.NodeContext = null;

    // ------ init backtracking list -----
    this.breakPositions = [];
    this.nodeContextOverflowingDueToRepetitiveElements = null;

    // ------- fill the column -------------
    frame
      .loopWithFrame((loopFrame) => {
        while (nodeContext) {
          // fill a single block
          let pending = true;
          this.layoutNext(nodeContext, leadingEdge, breakAfter || null).then(
            (nodeContextParam) => {
              leadingEdge = false;
              breakAfter = null;
              if (
                this.nodeContextOverflowingDueToRepetitiveElements &&
                this.stopAtOverflow
              ) {
                this.pageBreakType = null;
                nodeContext =
                  this.nodeContextOverflowingDueToRepetitiveElements;
                nodeContext.overflow = true;
              } else {
                nodeContext = nodeContextParam;
              }
              if (this.pageFloatLayoutContext.isInvalidated()) {
                loopFrame.breakLoop();
              } else if (this.pageBreakType) {
                // explicit page break
                loopFrame.breakLoop(); // Loop end
              } else if (nodeContext && this.stopByOverflow(nodeContext)) {
                // overflow (implicit page break): back up and find a
                // page break
                overflownNodeContext = nodeContext;
                const bp = this.findAcceptableBreakPosition();
                nodeContext = bp.nodeContext;
                if (bp.breakPosition) {
                  bp.breakPosition.breakPositionChosen(this);
                }
                loopFrame.breakLoop(); // Loop end
              } else {
                if (pending) {
                  // Sync case
                  pending = false;
                } else {
                  // Async case
                  loopFrame.continueLoop();
                }
              }
            },
          );
          if (pending) {
            // Async case and loop end
            pending = false;
            return;
          }
        }

        // Sync case
        this.computedBlockSize += this.getOffsetByRepetitiveElements();
        loopFrame.breakLoop();
      })
      .then(() => {
        frame.finish({ nodeContext, overflownNodeContext });
      });
    return frame.result();
  }

  /**
   * Re-layout already laid-out chunks. Return the position of the last flow if
   * there is an overflow.
   * TODO: deal with chunks that did not fit at all.
   * @return holding end position.
   */
  redoLayout(): Task.Result<Vtree.ChunkPosition> {
    const chunkPositions = this.chunkPositions;
    let last: Node = this.element.lastChild;
    while (last != this.last) {
      const prev = last.previousSibling;
      if (
        !(
          this.element === last.parentNode &&
          (this.layoutContext as Vgen.ViewFactory).isPseudoelement(last)
        )
      ) {
        this.element.removeChild(last);
      }
      last = prev;
    }
    this.killFloats();
    this.init();
    const frame: Task.Frame<Vtree.ChunkPosition> = Task.newFrame("redoLayout");
    let i = 0;
    let res: Vtree.ChunkPosition = null;
    let leadingEdge = true;
    frame
      .loopWithFrame((loopFrame) => {
        if (i < chunkPositions.length) {
          const chunkPosition = chunkPositions[i++];
          this.layout(chunkPosition, leadingEdge).then((pos) => {
            leadingEdge = false;
            if (pos) {
              res = pos;
              loopFrame.breakLoop();
            } else {
              loopFrame.continueLoop();
            }
          });
          return;
        }
        loopFrame.breakLoop();
      })
      .then(() => {
        frame.finish(res);
      });
    return frame.result();
  }

  saveDistanceToBlockEndFloats() {
    const blockStartEdgeOfBlockEndFloats =
      this.pageFloatLayoutContext.getBlockStartEdgeOfBlockEndFloats();
    if (
      blockStartEdgeOfBlockEndFloats > 0 &&
      isFinite(blockStartEdgeOfBlockEndFloats)
    ) {
      this.blockDistanceToBlockEndFloats =
        this.getBoxDir() *
        (blockStartEdgeOfBlockEndFloats -
          this.beforeEdge -
          this.computedBlockSize);
    }
  }

  collectElementsOffset(): RepetitiveElement.ElementsOffset[] {
    const repetitiveElements: RepetitiveElement.ElementsOffset[] = [];
    for (let current: Column = this; current; current = current.pseudoParent) {
      current.fragmentLayoutConstraints.forEach((constraint) => {
        if (
          RepetitiveElement.isInstanceOfRepetitiveElementsOwnerLayoutConstraint(
            constraint,
          )
        ) {
          const repetitiveElement = constraint.getRepetitiveElements();
          repetitiveElements.push(repetitiveElement);
        }
        if (
          Selectors.isInstanceOfAfterIfContinuesLayoutConstraint(constraint)
        ) {
          const repetitiveElement = constraint.getRepetitiveElements();
          repetitiveElements.push(repetitiveElement);
        }
        if (Table.isInstanceOfTableRowLayoutConstraint(constraint)) {
          constraint
            .getElementsOffsetsForTableCell(this)
            .forEach((repetitiveElement) => {
              repetitiveElements.push(repetitiveElement);
            });
        }
      });
    }
    return repetitiveElements;
  }
}

/**
 * Represents a "pseudo"-column nested inside a real column.
 * This class is created to handle parallel fragmented flows (e.g. table columns
 * in a single table row). A pseudo-column behaves in the same way as the
 * original column, sharing its properties. Property changes on the
 * pseudo-column are not propagated to the original column. The LayoutContext of
 * the original column is also cloned and used by the pseudo-column, not to
 * propagate state changes of the LayoutContext caused by the pseudo-column.
 * @param column The original (parent) column
 * @param viewRoot Root element for the pseudo-column, i.e., the root of the
 *     fragmented flow.
 * @param parentNodeContext A NodeContext generating this PseudoColumn
 */
export class PseudoColumn {
  startNodeContexts: Vtree.NodeContext[] = [];
  private column: Layout.Column;
  constructor(
    column: Layout.Column,
    viewRoot: Element,
    parentNodeContext: Vtree.NodeContext,
  ) {
    this.column = Object.create(column) as Layout.Column;
    this.column.element = viewRoot;
    this.column.layoutContext = column.layoutContext.clone();
    this.column.stopAtOverflow = false;
    this.column.flowRootFormattingContext = parentNodeContext.formattingContext;
    this.column.pseudoParent = column;
    const parentClonedPaddingBorder =
      this.column.calculateClonedPaddingBorder(parentNodeContext);
    this.column.footnoteEdge =
      this.column.footnoteEdge - parentClonedPaddingBorder;
    const pseudoColumn = this;
    this.column.openAllViews = function (position) {
      return Column.prototype.openAllViews
        .call(this, position)
        .thenAsync((result) => {
          pseudoColumn.startNodeContexts.push(result.copy());
          return Task.newResult(result);
        });
    };
  }
  /**
   * @param chunkPosition starting position.
   * @return holding end position.
   */
  layout(
    chunkPosition: Vtree.ChunkPosition,
    leadingEdge: boolean,
  ): Task.Result<Vtree.ChunkPosition> {
    return this.column.layout(chunkPosition, leadingEdge);
  }
  findAcceptableBreakPosition(
    allowBreakAtStartPosition: boolean,
  ): Layout.BreakPositionAndNodeContext {
    const p = this.column.findAcceptableBreakPosition();
    if (allowBreakAtStartPosition) {
      const startNodeContext = this.startNodeContexts[0].copy();
      const bp = new BreakPosition.EdgeBreakPosition(
        startNodeContext,
        null,
        startNodeContext.overflow,
        0,
      );
      bp.findAcceptableBreak(this.column, 0);
      if (!p.nodeContext) {
        return { breakPosition: bp, nodeContext: startNodeContext };
      }
    }
    return p;
  }
  /**
   * @return holing true
   */
  finishBreak(
    nodeContext: Vtree.NodeContext,
    forceRemoveSelf: boolean,
    endOfColumn: boolean,
  ): Task.Result<boolean> {
    return this.column.finishBreak(nodeContext, forceRemoveSelf, endOfColumn);
  }
  doFinishBreakOfFragmentLayoutConstraints(positionAfter: Vtree.NodeContext) {
    this.column.doFinishBreakOfFragmentLayoutConstraints(positionAfter);
  }
  isStartNodeContext(nodeContext: Vtree.NodeContext): boolean {
    const startNodeContext = this.startNodeContexts[0];
    return (
      startNodeContext.viewNode === nodeContext.viewNode &&
      startNodeContext.after === nodeContext.after &&
      startNodeContext.offsetInNode === nodeContext.offsetInNode
    );
  }
  isLastAfterNodeContext(nodeContext: Vtree.NodeContext): boolean {
    return VtreeImpl.isSameNodePosition(
      nodeContext.toNodePosition(),
      this.column.lastAfterPosition,
    );
  }
  getColumnElement(): Element {
    return this.column.element;
  }
  getColumn(): Layout.Column {
    return this.column;
  }
}

export type SinglePageFloatLayoutResult = Layout.SinglePageFloatLayoutResult;

/**
 * breaking point resolver for Text Node.
 */
export class TextNodeBreaker implements Layout.TextNodeBreaker {
  breakTextNode(
    textNode: Text,
    nodeContext: Vtree.NodeContext,
    low: number,
    checkPoints: Vtree.NodeContext[],
    checkpointIndex: number,
    force: boolean,
  ): Vtree.NodeContext {
    if (nodeContext.after) {
      nodeContext.offsetInNode = textNode.length;
    } else {
      // Character with index low is the last one that fits.
      let viewIndex = low - nodeContext.boxOffset;
      const text = textNode.data;
      if (text.charCodeAt(viewIndex) == 173) {
        viewIndex = this.breakAfterSoftHyphen(
          textNode,
          text,
          viewIndex,
          nodeContext,
        );
      } else {
        viewIndex = this.breakAfterOtherCharacter(
          textNode,
          text,
          viewIndex,
          nodeContext,
        );
      }
      if (viewIndex > 0) {
        nodeContext = this.updateNodeContext(nodeContext, viewIndex, textNode);
      }
    }
    return nodeContext;
  }

  breakAfterSoftHyphen(
    textNode: Text,
    text: string,
    viewIndex: number,
    nodeContext: Vtree.NodeContext,
  ): number {
    // convert trailing soft hyphen to a real hyphen
    const checkJoiningType =
      // /[\p{Joining_Type=D}\p{Joining_Type=C}]\p{Mn}*$/
      // eslint-disable-next-line no-misleading-character-class
      /[\u0620\u0626\u0628\u062A-\u062E\u0633-\u0647\u0649\u064A\u066E\u066F\u0678-\u0687\u069A-\u06BF\u06C1\u06C2\u06CC\u06CE\u06D0\u06D1\u06FA-\u06FC\u06FF\u0712-\u0714\u071A-\u071D\u071F-\u0727\u0729\u072B\u072D\u072E\u074E-\u0758\u075C-\u076A\u076D-\u0770\u0772\u0775-\u0777\u077A-\u077F\u07CA-\u07EA\u07FA\u0841-\u0845\u0848\u084A-\u0853\u0855\u0860\u0862-\u0865\u0868\u0883-\u0886\u0889-\u088D\u08A0-\u08A9\u08AF\u08B0\u08B3-\u08B8\u08BA-\u08C8\u1807\u180A\u1820-\u1878\u1887-\u18A8\u18AA\u200D\uA840-\uA871\u{10AC0}-\u{10AC4}\u{10AD3}-\u{10AD6}\u{10AD8}-\u{10ADC}\u{10ADE}-\u{10AE0}\u{10AEB}-\u{10AEE}\u{10B80}\u{10B82}\u{10B86}-\u{10B88}\u{10B8A}\u{10B8B}\u{10B8D}\u{10B90}\u{10BAD}\u{10BAE}\u{10D01}-\u{10D21}\u{10D23}\u{10EC3}\u{10EC4}\u{10F30}-\u{10F32}\u{10F34}-\u{10F44}\u{10F51}-\u{10F53}\u{10F70}-\u{10F73}\u{10F76}-\u{10F81}\u{10FB0}\u{10FB2}\u{10FB3}\u{10FB8}\u{10FBB}\u{10FBC}\u{10FBE}\u{10FBF}\u{10FC1}\u{10FC4}\u{10FCA}\u{1E900}-\u{1E943}]\p{Mn}*$/u;
    const zwj = checkJoiningType.test(text.slice(0, viewIndex)) ? "\u200D" : "";
    textNode.replaceData(
      viewIndex,
      text.length - viewIndex,
      !nodeContext.breakWord
        ? zwj + resolveHyphenateCharacter(nodeContext)
        : "",
    );
    if (zwj) {
      const p = nodeContext.preprocessedTextContent[0][1] as string;
      nodeContext.preprocessedTextContent[0][1] =
        p.slice(0, viewIndex + 1) + zwj + p.slice(viewIndex + 1);
    }
    return viewIndex + 1;
  }

  breakAfterOtherCharacter(
    textNode: Text,
    text: string,
    viewIndex: number,
    nodeContext: Vtree.NodeContext,
  ): number {
    // keep the trailing character (it may be a space or not)
    const ch0 = text.charAt(viewIndex);
    viewIndex++;
    const ch1 = text.charAt(viewIndex);

    // If automatic hyphen was inserted here, add a real hyphen.
    textNode.replaceData(
      viewIndex,
      text.length - viewIndex,
      !nodeContext.breakWord && Base.isLetter(ch0) && Base.isLetter(ch1)
        ? resolveHyphenateCharacter(nodeContext)
        : "",
    );
    return viewIndex;
  }

  updateNodeContext(
    nodeContext: Vtree.NodeContext,
    viewIndex: number,
    textNode: Text,
  ): Vtree.NodeContext {
    nodeContext = nodeContext.modify();
    nodeContext.offsetInNode += viewIndex;
    nodeContext.breakBefore = null;
    return nodeContext;
  }

  static instance: TextNodeBreaker;
}
TextNodeBreaker.instance = new TextNodeBreaker();

export function resolveHyphenateCharacter(
  nodeContext: Vtree.NodeContext,
): string {
  return (
    nodeContext.hyphenateCharacter ||
    (nodeContext.parent && nodeContext.parent.hyphenateCharacter) ||
    "-"
  );
}

export class ColumnLayoutRetryer extends LayoutRetryers.AbstractLayoutRetryer {
  breakAfter: string | null;
  private initialPageBreakType: string | null = null;
  initialComputedBlockSize: number = 0;
  private initialOverflown: boolean = false;
  context: { overflownNodeContext: Vtree.NodeContext } = {
    overflownNodeContext: null,
  };

  constructor(
    public readonly leadingEdge: boolean,
    breakAfter?: string | null,
  ) {
    super();
    this.breakAfter = breakAfter || null;
  }

  override resolveLayoutMode(
    nodeContext: Vtree.NodeContext,
  ): Layout.LayoutMode {
    return new DefaultLayoutMode(
      this.leadingEdge,
      this.breakAfter,
      this.context,
    );
  }

  override prepareLayout(
    nodeContext: Vtree.NodeContext,
    column: Layout.Column,
  ) {
    column.fragmentLayoutConstraints = [];
    if (!column.pseudoParent) {
      Shared.clearRepetitiveElementsCache();
    }
  }

  override clearNodes(initialPosition: Vtree.NodeContext) {
    super.clearNodes(initialPosition);
    let nodeContext = initialPosition;
    while (nodeContext) {
      const viewNode = nodeContext.viewNode;
      if (viewNode) {
        LayoutHelper.removeFollowingSiblings(viewNode.parentNode, viewNode);
      }
      nodeContext = nodeContext.parent;
    }
  }

  override saveState(nodeContext: Vtree.NodeContext, column: Layout.Column) {
    super.saveState(nodeContext, column);
    this.initialPageBreakType = column.pageBreakType;
    this.initialComputedBlockSize = column.computedBlockSize;
    this.initialOverflown = column.overflown;
  }

  override restoreState(nodeContext: Vtree.NodeContext, column: Layout.Column) {
    super.restoreState(nodeContext, column);
    column.pageBreakType = this.initialPageBreakType;
    column.computedBlockSize = this.initialComputedBlockSize;
    column.overflown = this.initialOverflown;
  }
}

export class DefaultLayoutMode implements Layout.LayoutMode {
  constructor(
    public readonly leadingEdge: boolean,
    public readonly breakAfter: string | null,
    public readonly context: { overflownNodeContext: Vtree.NodeContext },
  ) {}

  /** @override */
  doLayout(
    nodeContext: Vtree.NodeContext,
    column: Layout.Column,
  ): Task.Result<Vtree.NodeContext> {
    const frame: Task.Frame<Vtree.NodeContext> = Task.newFrame(
      "DefaultLayoutMode.doLayout",
    );

    processAfterIfContinuesOfAncestors(nodeContext, column).then(() => {
      column
        .doLayout(nodeContext, this.leadingEdge, this.breakAfter)
        .then((result) => {
          this.context.overflownNodeContext = result.overflownNodeContext;
          frame.finish(result.nodeContext);
        });
    });
    return frame.result();
  }

  /** @override */
  accept(nodeContext: Vtree.NodeContext, column: Layout.Column): boolean {
    if (column.pageFloatLayoutContext.isInvalidated() || column.pageBreakType) {
      return true;
    }
    if (column.fragmentLayoutConstraints.length <= 0) {
      return true;
    }
    return column.fragmentLayoutConstraints.every((constraint) =>
      constraint.allowLayout(
        nodeContext,
        this.context.overflownNodeContext,
        column,
      ),
    );
  }

  /** @override */
  postLayout(
    positionAfter: Vtree.NodeContext,
    initialPosition: Vtree.NodeContext,
    column: Layout.Column,
    accepted: boolean,
  ): boolean {
    if (!accepted) {
      const hasNextCandidate = column.fragmentLayoutConstraints.some(
        (constraint) => constraint.nextCandidate(positionAfter),
      );

      // If there is no next candidate, we accept the current layout trial.
      // Later Column#doFinishBreak decides whether the overflowing content
      // should be placed as is or be deferred to the next column,
      // depending on the value of Column#forceNonfitting.
      accepted = !hasNextCandidate;
    }
    column.fragmentLayoutConstraints.forEach((constraint) => {
      constraint.postLayout(accepted, positionAfter, initialPosition, column);
    });
    return accepted;
  }
}

export class PageFloatArea extends Column implements Layout.PageFloatArea {
  private rootViewNodes: Element[] = [];
  private floatMargins: GeometryUtil.Insets[] = [];
  adjustContentRelativeSize: boolean = true;

  constructor(
    public readonly floatSide: string,
    element: Element,
    layoutContext: Vtree.LayoutContext,
    clientLayout: Vtree.ClientLayout,
    layoutConstraint: LayoutConstraint,
    pageFloatLayoutContext: PageFloats.PageFloatLayoutContext,
    public readonly parentContainer: Vtree.Container,
  ) {
    super(
      element,
      layoutContext,
      clientLayout,
      layoutConstraint,
      pageFloatLayoutContext,
    );
  }

  override openAllViews(
    position: Vtree.NodePosition,
  ): Task.Result<Vtree.NodeContext> {
    return super.openAllViews(position).thenAsync((nodeContext) => {
      if (nodeContext) {
        this.fixFloatSizeAndPosition(nodeContext);
      }
      return Task.newResult(nodeContext);
    });
  }

  convertPercentageSizesToPx(target: Element) {
    const containingBlockRect = this.parentContainer.getPaddingRect();
    const refWidth = containingBlockRect.x2 - containingBlockRect.x1;
    const refHeight = containingBlockRect.y2 - containingBlockRect.y1;

    function convertPercentageToPx(props: string[], refValue: number) {
      props.forEach((propName) => {
        const valueString = Base.getCSSProperty(target, propName);
        if (valueString && valueString.charAt(valueString.length - 1) === "%") {
          const percentageValue = parseFloat(valueString);
          const value = (refValue * percentageValue) / 100;
          Base.setCSSProperty(target, propName, `${value}px`);
        }
      });
    }
    convertPercentageToPx(["width", "max-width", "min-width"], refWidth);
    convertPercentageToPx(["height", "max-height", "min-height"], refHeight);
    convertPercentageToPx(
      [
        "margin-top",
        "margin-right",
        "margin-bottom",
        "margin-left",
        "padding-top",
        "padding-right",
        "padding-bottom",
        "padding-left",
      ],
      this.vertical ? refHeight : refWidth,
    );
    ["margin-top", "margin-right", "margin-bottom", "margin-left"].forEach(
      (propName) => {
        const value = Base.getCSSProperty(target, propName);
        if (value === "auto") {
          Base.setCSSProperty(target, propName, "0");
        }
      },
    );
  }

  fixFloatSizeAndPosition(nodeContext: Vtree.NodeContext) {
    while (nodeContext.parent) {
      nodeContext = nodeContext.parent;
    }
    Asserts.assert(nodeContext.viewNode.nodeType === 1);
    const rootViewNode = nodeContext.viewNode as Element;
    this.rootViewNodes.push(rootViewNode);
    if (this.adjustContentRelativeSize) {
      this.convertPercentageSizesToPx(rootViewNode);
    }
    this.floatMargins.push(this.getComputedMargin(rootViewNode));
    if (this.adjustContentRelativeSize) {
      const floatSide = this.floatSide;
      const isVertical = this.parentContainer.vertical;
      if (isVertical) {
        if (floatSide === "block-end" || floatSide === "left") {
          const height = Base.getCSSProperty(rootViewNode, "height");
          if (height !== "" && height !== "auto") {
            Base.setCSSProperty(rootViewNode, "margin-top", "auto");
          }
        }
      } else {
        if (floatSide === "block-end" || floatSide === "bottom") {
          const width = Base.getCSSProperty(rootViewNode, "width");
          if (width !== "" && width !== "auto") {
            Base.setCSSProperty(rootViewNode, "margin-left", "auto");
          }
        }
      }
    }
  }

  getContentInlineSize(): number {
    return Math.max.apply(
      null,
      this.rootViewNodes.map((r, i) => {
        const box = this.clientLayout.getElementClientRect(r);
        const margin = this.floatMargins[i];
        return this.vertical
          ? margin.top + box.height + margin.bottom
          : margin.left + box.width + margin.right;
      }),
    );
  }
}
