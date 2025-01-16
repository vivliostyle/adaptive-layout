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
 * @fileoverview Table - Table formatting context and layout.
 */
import * as Asserts from "./asserts";
import * as Base from "./base";
import * as BreakPosition from "./break-position";
import * as Css from "./css";
import * as LayoutHelper from "./layout-helper";
import * as LayoutProcessor from "./layout-processor";
import * as LayoutRetryers from "./layout-retryers";
import * as LayoutUtil from "./layout-util";
import * as Plugin from "./plugin";
import * as RepetitiveElementImpl from "./repetitive-element";
import * as Task from "./task";
import * as Vgen from "./vgen";
import * as VtreeImpl from "./vtree";
import * as Layout from "./layout";
import {
  FormattingContextType,
  FragmentLayoutConstraintType,
  Layout as LayoutType,
  RepetitiveElement,
  Table,
  Vtree,
} from "./types";

export class TableRow {
  cells: TableCell[] = [];

  constructor(
    public readonly rowIndex: number,
    public readonly sourceNode: Node,
  ) {}

  addCell(cell: TableCell) {
    this.cells.push(cell);
  }

  getMinimumHeight(): number {
    return Math.min.apply(
      null,
      this.cells.map((c) => c.height),
    );
  }
}

export class TableCell {
  viewElement: Element | null;
  colSpan: number;
  rowSpan: number;
  height: number = 0;
  anchorSlot: TableSlot = null;

  constructor(
    public readonly rowIndex: number,
    public readonly columnIndex: number,
    viewElement: Element,
  ) {
    this.viewElement = viewElement;
    this.colSpan = (viewElement as HTMLTableCellElement).colSpan || 1;
    this.rowSpan = (viewElement as HTMLTableCellElement).rowSpan || 1;
  }

  setHeight(height: number) {
    this.height = height;
  }

  setAnchorSlot(slot: TableSlot) {
    this.anchorSlot = slot;
  }
}

export class TableSlot {
  constructor(
    public readonly rowIndex: number,
    public readonly columnIndex: number,
    public readonly cell: TableCell,
  ) {}
}

export class TableCellFragment {
  pseudoColumn: Layout.PseudoColumn;
  empty: boolean = false;

  constructor(
    public readonly column: Layout.Column,
    pseudoColumnContainer: Element,
    public readonly cellNodeContext: Vtree.NodeContext,
  ) {
    this.pseudoColumn = new Layout.PseudoColumn(
      column,
      pseudoColumnContainer,
      cellNodeContext,
    );
  }

  findAcceptableBreakPosition(): Layout.BreakPositionAndNodeContext {
    const element = this.cellNodeContext.viewNode as HTMLElement;
    const { verticalAlign, alignContent } = element.style;
    if (verticalAlign !== "top" && verticalAlign !== "baseline") {
      Base.setCSSProperty(element, "vertical-align", "top");
    }
    if (alignContent && alignContent !== "normal") {
      Base.setCSSProperty(element, "align-content", "normal");
    }
    const bp = this.pseudoColumn.findAcceptableBreakPosition(true);
    Base.setCSSProperty(element, "vertical-align", verticalAlign);
    if (alignContent && alignContent !== "normal") {
      Base.setCSSProperty(element, "align-content", alignContent);
    }
    return bp;
  }
}

export class TableCaptionView {
  constructor(
    public readonly viewNode: Element,
    public readonly side: string,
  ) {}
}

export class BetweenTableRowBreakPosition extends BreakPosition.EdgeBreakPosition {
  private formattingContext: TableFormattingContext;

  acceptableCellBreakPositions: Layout.BreakPositionAndNodeContext[] = null;
  private rowIndex: number | null = null;

  constructor(
    position: Vtree.NodeContext,
    breakOnEdge: string | null,
    overflows: boolean,
    columnBlockSize: number,
  ) {
    super(position, breakOnEdge, overflows, columnBlockSize);
    this.formattingContext =
      position.formattingContext as TableFormattingContext;
  }

  override findAcceptableBreak(
    column: Layout.Column,
    penalty: number,
  ): Vtree.NodeContext {
    const breakNodeContext = super.findAcceptableBreak(column, penalty);
    if (penalty < this.getMinBreakPenalty()) {
      return null;
    }
    const allCellsBreakable = this.getAcceptableCellBreakPositions().every(
      (bp) => !!bp.nodeContext,
    );
    if (allCellsBreakable) {
      return breakNodeContext;
    } else {
      return null;
    }
  }

  override getMinBreakPenalty(): number {
    let penalty = super.getMinBreakPenalty();
    this.getAcceptableCellBreakPositions().forEach((bp) => {
      penalty += bp.breakPosition.getMinBreakPenalty();
    });
    return penalty;
  }

  getAcceptableCellBreakPositions(): Layout.BreakPositionAndNodeContext[] {
    if (!this.acceptableCellBreakPositions) {
      const formattingContext = this.formattingContext;
      const cellFragments = this.getCellFragments();
      this.acceptableCellBreakPositions = cellFragments.map((cellFragment) =>
        cellFragment.findAcceptableBreakPosition(),
      );
    }
    return this.acceptableCellBreakPositions;
  }

  private getRowIndex(): number {
    if (this.rowIndex != null) {
      return this.rowIndex;
    }
    return (this.rowIndex = this.formattingContext.findRowIndexBySourceNode(
      this.position.sourceNode,
    ));
  }

  private getCellFragments() {
    return this.formattingContext
      .getRowSpanningCellsOverflowingTheRow(this.getRowIndex())
      .map(
        this.formattingContext.getCellFragmentOfCell,
        this.formattingContext,
      );
  }
}

export class InsideTableRowBreakPosition extends BreakPosition.AbstractBreakPosition {
  acceptableCellBreakPositions: Layout.BreakPositionAndNodeContext[] = null;

  constructor(
    public readonly rowIndex: number,
    public readonly beforeNodeContext: Vtree.NodeContext,
    public readonly formattingContext: TableFormattingContext,
  ) {
    super();
  }

  override findAcceptableBreak(
    column: Layout.Column,
    penalty: number,
  ): Vtree.NodeContext {
    if (penalty < this.getMinBreakPenalty()) {
      return null;
    }
    const cellFragments = this.getCellFragments();
    const acceptableCellBreakPositions = this.getAcceptableCellBreakPositions();
    const allCellsBreakable =
      acceptableCellBreakPositions.every((bp) => !!bp.nodeContext) &&
      acceptableCellBreakPositions.some((bp, index) => {
        const pseudoColumn = cellFragments[index].pseudoColumn;
        const nodeContext = bp.nodeContext;
        return (
          !pseudoColumn.isStartNodeContext(nodeContext) &&
          !pseudoColumn.isLastAfterNodeContext(nodeContext)
        );
      });
    this.beforeNodeContext.overflow = acceptableCellBreakPositions.some(
      (bp) => bp.nodeContext && bp.nodeContext.overflow,
    );
    if (allCellsBreakable) {
      return this.beforeNodeContext;
    } else {
      return null;
    }
  }

  override getMinBreakPenalty(): number {
    const formattingContext = this.formattingContext;
    const row = formattingContext.getRowByIndex(this.rowIndex);
    let penalty = 0;

    const breakPositions = this.getAcceptableCellBreakPositions();
    const cellFragments = this.getCellFragments();

    // If there is a box break in a row-spanning cell, do not add penalty.
    // This is to prevent the cell content from disappearing due to the situation
    // that a box break occurs in a row-spanning cell but the row break fails.
    // (Issue #1403)
    const foundBoxBreakInRowSpanningCell = breakPositions.some(
      (bp, i) =>
        bp.breakPosition instanceof Layout.BoxBreakPosition &&
        (cellFragments[i].cellNodeContext.sourceNode as HTMLTableCellElement)
          .rowSpan > 1,
    );
    if (
      !foundBoxBreakInRowSpanningCell &&
      !formattingContext.isFreelyFragmentableRow(row)
    ) {
      penalty += 10;
    }

    breakPositions.forEach((bp, i) => {
      let penalty1 = bp.breakPosition.getMinBreakPenalty();
      if (
        foundBoxBreakInRowSpanningCell &&
        bp.breakPosition instanceof BreakPosition.EdgeBreakPosition &&
        bp.breakPosition.overflows &&
        penalty1 >= 3
      ) {
        // When a box break occurs in a row-spanning cell, the height of the row group decreases,
        // and the overflows flag that was set before the box break may be no longer valid.
        // So,check the overflow again, and if the cell does not overflow, reduce the penalty.
        // (Issue #1403)
        const overflows = cellFragments[i].column.checkOverflowAndSaveEdge(
          bp.nodeContext,
          null,
        );
        if (!overflows) {
          penalty1 -= 3;
        }
      }
      penalty += penalty1;
    });
    return penalty;
  }

  getAcceptableCellBreakPositions(): Layout.BreakPositionAndNodeContext[] {
    if (!this.acceptableCellBreakPositions) {
      const cellFragments = this.getCellFragments();
      this.acceptableCellBreakPositions = cellFragments.map((cellFragment) =>
        cellFragment.findAcceptableBreakPosition(),
      );
    }
    return this.acceptableCellBreakPositions;
  }

  private getCellFragments() {
    return this.formattingContext
      .getCellsFallingOnRow(this.rowIndex)
      .map(
        this.formattingContext.getCellFragmentOfCell,
        this.formattingContext,
      );
  }
}

export type BrokenTableCellPosition = {
  cellNodePosition: Vtree.NodePosition;
  breakChunkPosition: Vtree.ChunkPosition;
  cell: TableCell;
};

/**
 * @param tableSourceNode Source node of the table
 */
export class TableFormattingContext
  extends RepetitiveElementImpl.RepetitiveElementsOwnerFormattingContext
  implements Table.TableFormattingContext
{
  formattingContextType: FormattingContextType = "Table";
  vertical: boolean = false;
  columnCount: number = -1;
  tableWidth: number = 0;
  captions: TableCaptionView[] = [];
  colGroups: DocumentFragment | null = null;
  colWidths: number[] | null = null;
  inlineBorderSpacing: number = 0;
  rows: TableRow[] = [];
  slots: TableSlot[][] = [];
  cellFragments: TableCellFragment[][] = [];
  lastRowViewNode: Element | null = null;
  cellBreakPositions: BrokenTableCellPosition[] = [];
  repetitiveElements: RepetitiveElement.RepetitiveElements | null = null;

  constructor(
    parent: Vtree.FormattingContext,
    public readonly tableSourceNode: Element,
  ) {
    super(parent, tableSourceNode);
  }

  override getName(): string {
    return "Table formatting context (Table.TableFormattingContext)";
  }

  override isFirstTime(
    nodeContext: Vtree.NodeContext,
    firstTime: boolean,
  ): boolean {
    if (!firstTime) {
      return firstTime;
    }
    switch (nodeContext.display) {
      case "table-row":
        return this.cellBreakPositions.length === 0;
      case "table-cell":
        return !this.cellBreakPositions.some(
          (p) => p.cellNodePosition.steps[0].node === nodeContext.sourceNode,
        );
      default:
        return firstTime;
    }
  }

  override getParent(): Vtree.FormattingContext {
    return this.parent;
  }

  finishFragment() {
    this.cellFragments = [];
  }

  addRow(rowIndex: number, row: TableRow) {
    this.rows[rowIndex] = row;
  }

  getRowSlots(rowIndex: number): TableSlot[] {
    let rowSlots = this.slots[rowIndex];
    if (!rowSlots) {
      rowSlots = this.slots[rowIndex] = [];
    }
    return rowSlots;
  }

  addCell(rowIndex: number, cell: TableCell) {
    let row = this.rows[rowIndex];
    if (!row) {
      this.addRow(rowIndex, new TableRow(rowIndex, null));
      row = this.rows[rowIndex];
    }
    Asserts.assert(row);
    row.addCell(cell);
    const rowUpper = rowIndex + cell.rowSpan;
    let rowSlots = this.getRowSlots(rowIndex);
    let startColIndex = 0;
    while (rowSlots[startColIndex]) {
      startColIndex++;
    }
    for (; rowIndex < rowUpper; rowIndex++) {
      rowSlots = this.getRowSlots(rowIndex);
      for (let i = startColIndex; i < startColIndex + cell.colSpan; i++) {
        const slot = (rowSlots[i] = new TableSlot(rowIndex, i, cell));
        if (!cell.anchorSlot) {
          cell.setAnchorSlot(slot);
        }
      }
    }
  }

  getRowByIndex(index: number): TableRow {
    const row = this.rows[index];
    Asserts.assert(row);
    return row;
  }

  findRowIndexBySourceNode(sourceNode: Node): number {
    return this.rows.findIndex((row) => sourceNode === row.sourceNode);
  }

  addCellFragment(
    rowIndex: number,
    columnIndex: number,
    cellFragment: TableCellFragment,
  ) {
    let list = this.cellFragments[rowIndex];
    if (!list) {
      list = this.cellFragments[rowIndex] = [];
    }
    list[columnIndex] = cellFragment;
  }

  getCellsFallingOnRow(rowIndex: number): TableCell[] {
    const rowSlots = this.getRowSlots(rowIndex);
    return rowSlots.reduce((uniqueCells, slot) => {
      if (slot.cell !== uniqueCells[uniqueCells.length - 1]) {
        return uniqueCells.concat(slot.cell);
      } else {
        return uniqueCells;
      }
    }, []);
  }

  getRowSpanningCellsOverflowingTheRow(rowIndex: number): TableCell[] {
    return this.getCellsFallingOnRow(rowIndex).filter(
      (cell) => cell.rowIndex + cell.rowSpan - 1 > rowIndex,
    );
  }

  getCellFragmentOfCell(cell: TableCell): TableCellFragment {
    return (
      this.cellFragments[cell.rowIndex] &&
      this.cellFragments[cell.rowIndex][cell.columnIndex]
    );
  }

  isFreelyFragmentableRow(row: TableRow): boolean {
    return row.getMinimumHeight() > this.tableWidth / 2;
  }

  getColumnCount(): number {
    if (this.columnCount < 0) {
      this.columnCount = Math.max.apply(
        null,
        this.rows.map((row) =>
          row.cells.reduce((sum, c) => sum + c.colSpan, 0),
        ),
      );
    }
    return this.columnCount;
  }

  updateCellSizes(clientLayout: Vtree.ClientLayout) {
    this.rows.forEach((row) => {
      row.cells.forEach((cell) => {
        const rect = clientLayout.getElementClientRect(
          cell.viewElement as Element,
        );
        cell.viewElement = null;
        cell.setHeight(this.vertical ? rect["width"] : rect["height"]);
      });
    });
  }

  /**
   * @return position
   */
  findCellFromColumn(
    column: Layout.Column,
  ): { rowIndex: number; columnIndex: number } | null {
    if (!column) {
      return null;
    }
    let tableCell: TableCell = null;
    let row = 0;
    let col = 0;
    loop: for (row = 0; row < this.cellFragments.length; row++) {
      if (!this.cellFragments[row]) {
        continue;
      }
      for (col = 0; col < this.cellFragments[row].length; col++) {
        if (!this.cellFragments[row][col]) {
          continue;
        }
        if (column === this.cellFragments[row][col].pseudoColumn.getColumn()) {
          tableCell = this.rows[row].cells[col];
          break loop;
        }
      }
    }
    if (!tableCell) {
      return null;
    }
    for (; row < this.slots.length; row++) {
      for (; col < this.slots[row].length; col++) {
        const slot = this.slots[row][col];
        if (slot.cell === tableCell) {
          return { rowIndex: slot.rowIndex, columnIndex: slot.columnIndex };
        }
      }
    }
    return null;
  }

  collectElementsOffsetOfUpperCells(
    position: { rowIndex: number; columnIndex: number } | null,
  ): RepetitiveElement.ElementsOffset[] {
    const collected = [];
    return this.slots.reduce((repetitiveElements, row, index) => {
      if (index >= position.rowIndex) {
        return repetitiveElements;
      }
      const cellFragment =
        row[position.columnIndex] &&
        this.getCellFragmentOfCell(row[position.columnIndex].cell);
      if (!cellFragment || collected.includes(cellFragment)) {
        return repetitiveElements;
      }
      this.collectElementsOffsetFromColumn(
        cellFragment.pseudoColumn.getColumn(),
        repetitiveElements,
      );
      collected.push(cellFragment);
      return repetitiveElements;
    }, [] as RepetitiveElement.ElementsOffset[]);
  }

  collectElementsOffsetOfHighestColumn(): RepetitiveElement.ElementsOffset[] {
    const elementsInColumn = [];
    this.rows.forEach((row) => {
      row.cells.forEach((cell, index) => {
        if (!elementsInColumn[index]) {
          elementsInColumn[index] = { collected: [], elements: [] };
        }
        const state = elementsInColumn[index];
        const cellFragment = this.getCellFragmentOfCell(cell);
        if (!cellFragment || state.collected.includes(cellFragment)) {
          return;
        }
        this.collectElementsOffsetFromColumn(
          cellFragment.pseudoColumn.getColumn(),
          state.elements,
        );
        state.collected.push(cellFragment);
      });
    });
    return [
      new ElementsOffsetOfTableCell(
        elementsInColumn.map((entry) => entry.elements),
      ),
    ];
  }

  private collectElementsOffsetFromColumn(
    column: LayoutType.Column,
    repetitiveElements: RepetitiveElement.ElementsOffset[],
  ) {
    column.fragmentLayoutConstraints.forEach((constraint) => {
      if (
        RepetitiveElement.isInstanceOfRepetitiveElementsOwnerLayoutConstraint(
          constraint,
        )
      ) {
        const repetitiveElement = constraint.getRepetitiveElements();
        repetitiveElements.push(repetitiveElement);
      }
      if (Table.isInstanceOfTableRowLayoutConstraint(constraint)) {
        constraint
          .getElementsOffsetsForTableCell(null)
          .forEach((repetitiveElement) => {
            repetitiveElements.push(repetitiveElement);
          });
      }
    });
  }

  override saveState(): any {
    return [].concat(this.cellBreakPositions);
  }

  override restoreState(state: any) {
    this.cellBreakPositions = state as BrokenTableCellPosition[];
  }
}

export class ElementsOffsetOfTableCell
  implements RepetitiveElement.ElementsOffset
{
  constructor(
    public readonly repeatitiveElementsInColumns: RepetitiveElement.ElementsOffset[][],
  ) {}

  /** @override */
  calculateOffset(nodeContext: Vtree.NodeContext): number {
    return this.calculateMaxOffsetOfColumn(
      nodeContext,
      (offsets) => offsets.current,
    );
  }

  /** @override */
  calculateMinimumOffset(nodeContext: Vtree.NodeContext): number {
    return this.calculateMaxOffsetOfColumn(
      nodeContext,
      (offsets) => offsets.minimum,
    );
  }

  private calculateMaxOffsetOfColumn(nodeContext, resolver) {
    let maxOffset = 0;
    this.repeatitiveElementsInColumns.forEach((repetitiveElements) => {
      const offsets = BreakPosition.calculateOffset(
        nodeContext,
        repetitiveElements,
      );
      maxOffset = Math.max(maxOffset, resolver(offsets));
    });
    return maxOffset;
  }
}

function getTableFormattingContext(
  formattingContext: Vtree.FormattingContext,
): TableFormattingContext {
  Asserts.assert(formattingContext instanceof TableFormattingContext);
  return formattingContext as TableFormattingContext;
}

function isTableRowGrouping(display: string | null): boolean {
  return (
    display === "table-row-group" ||
    display === "table-header-group" ||
    display === "table-footer-group"
  );
}

function isTableRoot(display: string | null): boolean {
  return display === "table" || display === "inline-table";
}

function isValidParentOfTableRow(display: string | null): boolean {
  return isTableRowGrouping(display) || isTableRoot(display);
}

function skipNestedTable(
  state: LayoutUtil.LayoutIteratorState,
  formattingContext: TableFormattingContext,
  column: Layout.Column,
): Task.Result<boolean> | null {
  const nodeContext = state.nodeContext;
  const display = nodeContext.display;
  const parentDisplay = nodeContext.parent ? nodeContext.parent.display : null;

  // Is inline-table nested in another table?
  let isNestedInlineTable = false;
  if (
    parentDisplay === "inline-table" &&
    !(nodeContext.formattingContext instanceof TableFormattingContext)
  ) {
    for (let nc = nodeContext.parent; nc; nc = nc.parent) {
      if (nc.formattingContext instanceof TableFormattingContext) {
        isNestedInlineTable = nc.formattingContext === formattingContext;
        break;
      }
    }
  }
  const isNestedTable =
    isNestedInlineTable ||
    (display === "table-row" && !isValidParentOfTableRow(parentDisplay)) ||
    (display === "table-cell" &&
      parentDisplay !== "table-row" &&
      !isValidParentOfTableRow(parentDisplay)) ||
    (nodeContext.formattingContext instanceof TableFormattingContext &&
      nodeContext.formattingContext !== formattingContext);
  if (isNestedTable) {
    return column
      .buildDeepElementView(nodeContext)
      .thenAsync((nodeContextAfter) => {
        state.nodeContext = nodeContextAfter;
        return Task.newResult(true);
      });
  } else {
    return null;
  }
}

export class EntireTableLayoutStrategy extends LayoutUtil.EdgeSkipper {
  rowIndex: number = -1;
  columnIndex: number = 0;
  inRow: boolean = false;
  checkPoints: Vtree.NodeContext[] = [];
  inHeaderOrFooter: boolean = false;

  constructor(
    public readonly formattingContext: TableFormattingContext,
    public readonly column: Layout.Column,
  ) {
    super();
  }

  override startNonInlineElementNode(
    state: LayoutUtil.LayoutIteratorState,
  ): void | Task.Result<boolean> {
    const formattingContext = this.formattingContext;
    const r = skipNestedTable(state, formattingContext, this.column);
    if (r) {
      return r;
    }
    this.postLayoutBlockContents(state);
    const nodeContext = state.nodeContext;
    const display = nodeContext.display;
    const repetitiveElements = formattingContext.getRepetitiveElements();
    switch (display) {
      case "table":
        formattingContext.inlineBorderSpacing = nodeContext.inlineBorderSpacing;
        break;
      case "table-caption": {
        const captionView = new TableCaptionView(
          nodeContext.viewNode as Element,
          nodeContext.captionSide,
        );
        formattingContext.captions.push(captionView);
        break;
      }
      case "table-header-group":
        if (!repetitiveElements.isHeaderRegistered()) {
          this.inHeaderOrFooter = true;
          repetitiveElements.setHeaderNodeContext(nodeContext);
        }
        return Task.newResult(true);
      case "table-footer-group":
        if (!repetitiveElements.isFooterRegistered()) {
          this.inHeaderOrFooter = true;
          repetitiveElements.setFooterNodeContext(nodeContext);
        }
        return Task.newResult(true);
      case "table-row":
        if (!this.inHeaderOrFooter) {
          this.inRow = true;
          this.rowIndex++;
          Asserts.assert(nodeContext.sourceNode);
          this.columnIndex = 0;
          formattingContext.addRow(
            this.rowIndex,
            new TableRow(this.rowIndex, nodeContext.sourceNode),
          );
          if (!repetitiveElements.firstContentSourceNode) {
            repetitiveElements.firstContentSourceNode =
              nodeContext.sourceNode as Element;
          }
        }
        break;
    }
    return super.startNonInlineElementNode(state);
  }

  override afterNonInlineElementNode(
    state: LayoutUtil.LayoutIteratorState,
  ): void | Task.Result<boolean> {
    const formattingContext = this.formattingContext;
    const nodeContext = state.nodeContext;
    const display = nodeContext.display;
    const clientLayout = this.column.clientLayout;
    this.postLayoutBlockContents(state);
    if (nodeContext.sourceNode === formattingContext.tableSourceNode) {
      const computedStyle = clientLayout.getElementComputedStyle(
        formattingContext.getRootViewNode(nodeContext) as Element,
      );
      formattingContext.tableWidth = parseFloat(
        computedStyle[formattingContext.vertical ? "height" : "width"],
      );
      formattingContext.getRepetitiveElements().lastContentSourceNode =
        state.lastAfterNodeContext &&
        (state.lastAfterNodeContext.sourceNode as Element);
      state.break = true;
    } else {
      switch (display) {
        case "table-header-group":
        case "table-footer-group":
          if (this.inHeaderOrFooter) {
            this.inHeaderOrFooter = false;
            return Task.newResult(true);
          }
          break;
        case "table-row":
          if (!this.inHeaderOrFooter) {
            formattingContext.lastRowViewNode = nodeContext.viewNode as Element;
            this.inRow = false;
          }
          break;
        case "table-cell":
          if (!this.inHeaderOrFooter) {
            if (!this.inRow) {
              this.rowIndex++;
              this.columnIndex = 0;
              this.inRow = true;
            }
            const elem = nodeContext.viewNode as Element;
            formattingContext.addCell(
              this.rowIndex,
              new TableCell(this.rowIndex, this.columnIndex, elem),
            );
            this.columnIndex++;
          }
          break;
      }
    }
    return super.afterNonInlineElementNode(state);
  }

  override startNonElementNode(
    state: LayoutUtil.LayoutIteratorState,
  ): void | Task.Result<boolean> {
    this.registerCheckPoint(state);
  }

  override afterNonElementNode(
    state: LayoutUtil.LayoutIteratorState,
  ): void | Task.Result<boolean> {
    this.registerCheckPoint(state);
  }

  override startInlineElementNode(
    state: LayoutUtil.LayoutIteratorState,
  ): void | Task.Result<boolean> {
    this.registerCheckPoint(state);
  }

  override afterInlineElementNode(
    state: LayoutUtil.LayoutIteratorState,
  ): void | Task.Result<boolean> {
    this.registerCheckPoint(state);
  }

  registerCheckPoint(state: LayoutUtil.LayoutIteratorState) {
    const nodeContext = state.nodeContext;
    if (
      nodeContext &&
      nodeContext.viewNode &&
      !LayoutHelper.isSpecialNodeContext(nodeContext)
    ) {
      this.checkPoints.push(nodeContext.clone());
    }
  }

  postLayoutBlockContents(state: LayoutUtil.LayoutIteratorState) {
    if (this.checkPoints.length > 0) {
      this.column.postLayoutBlock(state.nodeContext, this.checkPoints);
    }
    this.checkPoints = [];
  }
}

export class TableLayoutStrategy extends LayoutUtil.EdgeSkipper {
  private static ignoreList: { [key: string]: boolean } = {
    "table-caption": true,
    "table-column-group": true,
    "table-column": true,
  };
  inRow: boolean = false;
  currentRowIndex: number = -1;
  currentColumnIndex: number = 0;
  originalStopAtOverflow: boolean;
  inHeader: boolean;
  inFooter: boolean;

  constructor(
    public readonly formattingContext: TableFormattingContext,
    public readonly column: Layout.Column,
  ) {
    super(true);
    this.originalStopAtOverflow = column.stopAtOverflow;
    column.stopAtOverflow = false;
  }

  resetColumn() {
    this.column.stopAtOverflow = this.originalStopAtOverflow;
  }

  getColSpanningCellWidth(cell: TableCell): number {
    const colWidths = this.formattingContext.colWidths;
    Asserts.assert(colWidths);
    let width = 0;
    for (let i = 0; i < cell.colSpan; i++) {
      width += colWidths[cell.anchorSlot.columnIndex + i];
    }
    width += this.formattingContext.inlineBorderSpacing * (cell.colSpan - 1);
    return width;
  }

  layoutCell(
    cell: TableCell,
    cellNodeContext: Vtree.NodeContext,
    startChunkPosition: Vtree.ChunkPosition,
  ): Task.Result<boolean> {
    const rowIndex = cell.rowIndex;
    const columnIndex = cell.columnIndex;
    const colSpan = cell.colSpan;
    const cellViewNode = cellNodeContext.viewNode as Element;
    const verticalAlign = cellNodeContext.verticalAlign;
    if (colSpan > 1) {
      Base.setCSSProperty(cellViewNode, "box-sizing", "border-box");
      Base.setCSSProperty(
        cellViewNode,
        this.formattingContext.vertical ? "height" : "width",
        `${this.getColSpanningCellWidth(cell)}px`,
      );
    }
    const pseudoColumnContainer =
      cellViewNode.ownerDocument.createElement("div");
    cellViewNode.appendChild(pseudoColumnContainer);
    const cellFragment = new TableCellFragment(
      this.column,
      pseudoColumnContainer,
      cellNodeContext,
    );
    this.formattingContext.addCellFragment(rowIndex, columnIndex, cellFragment);
    if (
      startChunkPosition.primary.steps.length === 1 &&
      startChunkPosition.primary.after
    ) {
      // Contents of the cell have ended in the previous fragment
      cellFragment.empty = true;
    }
    return cellFragment.pseudoColumn
      .layout(startChunkPosition, true)
      .thenReturn(true);
  }

  hasBrokenCellAtSlot(slotIndex): boolean {
    const cellBreakPosition = this.formattingContext.cellBreakPositions[0];
    if (cellBreakPosition) {
      return cellBreakPosition.cell.anchorSlot.columnIndex === slotIndex;
    }
    return false;
  }

  private extractRowSpanningCellBreakPositions(): BrokenTableCellPosition[][] {
    const cellBreakPositions = this.formattingContext.cellBreakPositions;
    if (cellBreakPositions.length === 0) {
      return [];
    }
    const rowSpanningCellBreakPositions = [];
    let i = 0;
    do {
      const p = cellBreakPositions[i];
      const rowIndex = p.cell.rowIndex;
      if (rowIndex < this.currentRowIndex) {
        let arr = rowSpanningCellBreakPositions[rowIndex];
        if (!arr) {
          arr = rowSpanningCellBreakPositions[rowIndex] = [];
        }
        arr.push(p);
        cellBreakPositions.splice(i, 1);
      } else {
        i++;
      }
    } while (i < cellBreakPositions.length);
    return rowSpanningCellBreakPositions;
  }

  layoutRowSpanningCellsFromPreviousFragment(
    state: LayoutUtil.LayoutIteratorState,
  ): Task.Result<boolean> {
    const formattingContext = this.formattingContext;
    const rowSpanningCellBreakPositions =
      this.extractRowSpanningCellBreakPositions();
    const rowCount = rowSpanningCellBreakPositions.reduce((s) => s + 1, 0);
    if (rowCount === 0) {
      return Task.newResult(true);
    }
    const layoutContext = this.column.layoutContext;
    const currentRow = state.nodeContext;
    currentRow.viewNode.parentNode.removeChild(currentRow.viewNode);
    const frame = Task.newFrame<boolean>(
      "layoutRowSpanningCellsFromPreviousFragment",
    );
    let cont = Task.newResult(true);
    let spanningCellRowIndex = 0;
    const occupiedSlotIndices = [];
    rowSpanningCellBreakPositions.forEach((rowCellBreakPositions) => {
      cont = cont.thenAsync(() => {
        // Is it always correct to assume steps[1] to be the row?
        const rowNodeContext = VtreeImpl.makeNodeContextFromNodePositionStep(
          rowCellBreakPositions[0].cellNodePosition.steps[1],
          currentRow.parent,
        );
        return layoutContext.setCurrent(rowNodeContext, false).thenAsync(() => {
          let cont1 = Task.newResult(true);
          let columnIndex = 0;

          function addDummyCellUntil(upperColumnIndex) {
            while (columnIndex < upperColumnIndex) {
              if (!occupiedSlotIndices.includes(columnIndex)) {
                const dummy =
                  rowNodeContext.viewNode.ownerDocument.createElement("td");
                Base.setCSSProperty(dummy, "padding", "0");
                rowNodeContext.viewNode.appendChild(dummy);
              }
              columnIndex++;
            }
          }
          rowCellBreakPositions.forEach((cellBreakPosition) => {
            cont1 = cont1.thenAsync(() => {
              const cell = cellBreakPosition.cell;
              addDummyCellUntil(cell.anchorSlot.columnIndex);
              const cellNodePosition = cellBreakPosition.cellNodePosition;
              const cellNodeContext =
                VtreeImpl.makeNodeContextFromNodePositionStep(
                  cellNodePosition.steps[0],
                  rowNodeContext,
                );
              cellNodeContext.offsetInNode = cellNodePosition.offsetInNode;
              cellNodeContext.after = cellNodePosition.after;
              cellNodeContext.fragmentIndex =
                cellNodePosition.steps[0].fragmentIndex + 1;
              return layoutContext
                .setCurrent(cellNodeContext, false)
                .thenAsync(() => {
                  const breakChunkPosition =
                    cellBreakPosition.breakChunkPosition;
                  for (let i = 0; i < cell.colSpan; i++) {
                    occupiedSlotIndices.push(columnIndex + i);
                  }
                  columnIndex += cell.colSpan;
                  return this.layoutCell(
                    cell,
                    cellNodeContext,
                    breakChunkPosition,
                  ).thenAsync(() => {
                    (cellNodeContext.viewNode as HTMLTableCellElement).rowSpan =
                      cell.rowIndex +
                      cell.rowSpan -
                      this.currentRowIndex +
                      rowCount -
                      spanningCellRowIndex;
                    return Task.newResult(true);
                  });
                });
            });
          });
          return cont1.thenAsync(() => {
            addDummyCellUntil(formattingContext.getColumnCount());
            spanningCellRowIndex++;
            return Task.newResult(true);
          });
        });
      });
    });
    cont.then(() => {
      layoutContext
        .setCurrent(currentRow, true, state.atUnforcedBreak)
        .then(() => {
          frame.finish(true);
        });
    });
    return frame.result();
  }

  startTableRow(state: LayoutUtil.LayoutIteratorState): Task.Result<boolean> {
    if (this.inHeader || this.inFooter) {
      return Task.newResult(true);
    }
    const nodeContext = state.nodeContext;
    const formattingContext = this.formattingContext;
    if (this.currentRowIndex < 0) {
      Asserts.assert(nodeContext.sourceNode);
      this.currentRowIndex = formattingContext.findRowIndexBySourceNode(
        nodeContext.sourceNode,
      );
    } else {
      this.currentRowIndex++;
    }
    this.currentColumnIndex = 0;
    this.inRow = true;
    return this.layoutRowSpanningCellsFromPreviousFragment(state).thenAsync(
      () => {
        this.registerCellFragmentIndex();
        const overflown = this.column.checkOverflowAndSaveEdgeAndBreakPosition(
          state.lastAfterNodeContext,
          null,
          true,
          state.breakAtTheEdge,
        );
        if (
          overflown &&
          formattingContext.getRowSpanningCellsOverflowingTheRow(
            this.currentRowIndex - 1,
          ).length === 0
        ) {
          this.resetColumn();
          nodeContext.overflow = true;
          state.break = true;
        }
        return Task.newResult(true);
      },
    );
  }

  private registerCellFragmentIndex() {
    const cells = this.formattingContext.getRowByIndex(
      this.currentRowIndex,
    ).cells;
    cells.forEach((cell) => {
      const cellBreakPosition =
        this.formattingContext.cellBreakPositions[cell.columnIndex];
      if (
        cellBreakPosition &&
        cellBreakPosition.cell.anchorSlot.columnIndex ==
          cell.anchorSlot.columnIndex
      ) {
        const tdNodeStep = cellBreakPosition.cellNodePosition.steps[0];
        const offset = (
          this.column.layoutContext as Vgen.ViewFactory
        ).xmldoc.getElementOffset(tdNodeStep.node as Element);
        Layout.registerFragmentIndex(offset, tdNodeStep.fragmentIndex + 1, 1);
      }
    });
  }

  startTableCell(state: LayoutUtil.LayoutIteratorState): Task.Result<boolean> {
    if (this.inHeader || this.inFooter) {
      return Task.newResult(true);
    }
    const nodeContext = state.nodeContext;
    if (!this.inRow) {
      if (this.currentRowIndex < 0) {
        this.currentRowIndex = 0;
      } else {
        this.currentRowIndex++;
      }
      this.currentColumnIndex = 0;
      this.inRow = true;
    }
    const cell = this.formattingContext.getRowByIndex(this.currentRowIndex)
      .cells[this.currentColumnIndex];
    if (!cell) {
      // Fix for Issue #712
      state.break = true;
      return Task.newResult(true);
    }
    const afterNodeContext = nodeContext.copy().modify();
    afterNodeContext.after = true;
    state.nodeContext = afterNodeContext;
    const frame = Task.newFrame<boolean>("startTableCell");
    let cont: Task.Result<Vtree.ChunkPosition>;
    if (this.hasBrokenCellAtSlot(cell.anchorSlot.columnIndex)) {
      const cellBreakPosition =
        this.formattingContext.cellBreakPositions.shift();
      nodeContext.fragmentIndex =
        cellBreakPosition.cellNodePosition.steps[0].fragmentIndex + 1;
      cont = Task.newResult(cellBreakPosition.breakChunkPosition);
    } else {
      cont = this.column
        .nextInTree(nodeContext, state.atUnforcedBreak)
        .thenAsync((nextNodeContext) => {
          if (nextNodeContext.viewNode) {
            nodeContext.viewNode.removeChild(nextNodeContext.viewNode);
          }
          const startNodePosition = VtreeImpl.newNodePositionFromNodeContext(
            nextNodeContext,
            0,
          );
          return Task.newResult(new VtreeImpl.ChunkPosition(startNodePosition));
        });
    }
    cont.then((startChunkPosition) => {
      Asserts.assert(nodeContext);
      this.layoutCell(cell, nodeContext, startChunkPosition).then(() => {
        this.afterNonInlineElementNode(state);
        this.currentColumnIndex++;
        frame.finish(true);
      });
    });
    return frame.result();
  }

  startNonInlineBox(
    state: LayoutUtil.LayoutIteratorState,
  ): Task.Result<boolean> {
    const r = skipNestedTable(
      state,
      getTableFormattingContext(this.formattingContext),
      this.column,
    );
    if (r) {
      return r;
    }
    const nodeContext = state.nodeContext;
    const repetitiveElements = this.formattingContext.getRepetitiveElements();
    const display = nodeContext.display;
    if (
      display === "table-header-group" &&
      repetitiveElements &&
      repetitiveElements.isHeaderSourceNode(nodeContext.sourceNode)
    ) {
      this.inHeader = true;
      return Task.newResult(true);
    } else if (
      display === "table-footer-group" &&
      repetitiveElements &&
      repetitiveElements.isFooterSourceNode(nodeContext.sourceNode)
    ) {
      this.inFooter = true;
      return Task.newResult(true);
    } else if (display === "table-row") {
      return this.startTableRow(state);
    } else if (display === "table-cell") {
      return this.startTableCell(state);
    } else {
      return Task.newResult(true);
    }
  }

  endNonInlineBox(state: LayoutUtil.LayoutIteratorState): Task.Result<boolean> {
    const nodeContext = state.nodeContext;
    const display = nodeContext.display;
    if (display === "table-row") {
      this.inRow = false;
      if (!this.inHeader && !this.inFooter) {
        const beforeNodeContext = nodeContext.copy().modify();
        beforeNodeContext.after = false;
        const bp = new InsideTableRowBreakPosition(
          this.currentRowIndex,
          beforeNodeContext,
          this.formattingContext,
        );
        this.column.breakPositions.push(bp);
      }
    }
    return Task.newResult(true);
  }

  afterNonInlineElementNode(
    state: LayoutUtil.LayoutIteratorState,
  ): void | Task.Result<boolean> {
    const nodeContext = state.nodeContext;
    const repetitiveElements = this.formattingContext.getRepetitiveElements();
    const display = nodeContext.display;
    if (display === "table-header-group") {
      if (
        repetitiveElements &&
        !repetitiveElements.allowInsertRepeatitiveElements &&
        repetitiveElements.isHeaderSourceNode(nodeContext.sourceNode)
      ) {
        this.inHeader = false;
        nodeContext.viewNode.parentNode.removeChild(nodeContext.viewNode);
      } else {
        Base.setCSSProperty(
          nodeContext.viewNode as Element,
          "display",
          "table-row-group",
        );
      }
    } else if (display === "table-footer-group") {
      if (
        repetitiveElements &&
        !repetitiveElements.allowInsertRepeatitiveElements &&
        repetitiveElements.isFooterSourceNode(nodeContext.sourceNode)
      ) {
        this.inFooter = false;
        nodeContext.viewNode.parentNode.removeChild(nodeContext.viewNode);
      } else {
        Base.setCSSProperty(
          nodeContext.viewNode as Element,
          "display",
          "table-row-group",
        );
      }
    }
    if (display && TableLayoutStrategy.ignoreList[display]) {
      nodeContext.viewNode.parentNode.removeChild(nodeContext.viewNode);
    } else if (
      nodeContext.sourceNode === this.formattingContext.tableSourceNode
    ) {
      nodeContext.overflow = this.column.checkOverflowAndSaveEdge(
        nodeContext,
        null,
      );
      this.resetColumn();
      state.break = true;
    } else {
      return super.afterNonInlineElementNode(state);
    }
    return Task.newResult(true);
  }
}

type TableLayoutOption = {
  calculateBreakPositionsInside: boolean;
};
const tableLayoutOptionCache: {
  root: Node;
  tableLayoutOption: TableLayoutOption;
}[] = [];

function getTableLayoutOption(
  tableRootSourceNode: Node,
): TableLayoutOption | null {
  const i = tableLayoutOptionCache.findIndex(
    (c) => c.root === tableRootSourceNode,
  );
  const pair = tableLayoutOptionCache[i];
  return pair ? pair.tableLayoutOption : null;
}

function clearTableLayoutOptionCache(tableRootSourceNode: Node): void {
  const i = tableLayoutOptionCache.findIndex(
    (c) => c.root === tableRootSourceNode,
  );
  if (i >= 0) {
    tableLayoutOptionCache.splice(i, 1);
  }
}

export class TableLayoutProcessor implements LayoutProcessor.LayoutProcessor {
  private layoutEntireTable(
    nodeContext: Vtree.NodeContext,
    column: Layout.Column,
  ): Task.Result<Vtree.NodeContext> {
    const formattingContext = getTableFormattingContext(
      nodeContext.formattingContext,
    );
    const strategy = new EntireTableLayoutStrategy(formattingContext, column);
    const iterator = new LayoutUtil.LayoutIterator(
      strategy,
      column.layoutContext,
    );
    return iterator.iterate(nodeContext);
  }

  private getColumnWidths(
    lastRow: Element,
    columnCount: number,
    vertical: boolean,
    clientLayout: Vtree.ClientLayout,
  ): number[] {
    const doc = lastRow.ownerDocument;
    const dummyRow = doc.createElement("tr");
    const dummyCells = [];
    for (let i = 0; i < columnCount; i++) {
      const cell = doc.createElement("td");
      dummyRow.appendChild(cell);
      dummyCells.push(cell);
    }
    lastRow.parentNode.insertBefore(dummyRow, lastRow.nextSibling);
    const colWidths = dummyCells.map((cell) => {
      const rect = clientLayout.getElementClientRect(cell);
      const width = vertical ? rect["height"] : rect["width"];
      // Workaround for issue #958
      // Non-integer width causes problem, so return rounded-up value.
      return Math.ceil(width);
    });
    lastRow.parentNode.removeChild(dummyRow);
    return colWidths;
  }

  private getColGroupElements(tableElement: Element): Element[] {
    const colGroups = [];
    let child = tableElement.firstElementChild;
    while (child) {
      if (child.localName === "colgroup") {
        colGroups.push(child);
      }
      child = child.nextElementSibling;
    }
    return colGroups;
  }

  private normalizeAndGetColElements(colGroups: Element[]): Element[] {
    const cols = [];
    colGroups.forEach((colGroup) => {
      // Replace colgroup[span=n] with colgroup with n col elements
      let span = (colGroup as any).span;
      colGroup.removeAttribute("span");
      let col = colGroup.firstElementChild;
      while (col) {
        if (col.localName === "col") {
          // Replace col[span=n] with n col elements
          let s = (col as any).span;
          col.removeAttribute("span");
          span -= s;
          while (s-- > 1) {
            const cloned = col.cloneNode(true);
            colGroup.insertBefore(cloned, col);
            cols.push(cloned);
          }
          cols.push(col);
        }
        col = col.nextElementSibling;
      }
      while (span-- > 0) {
        col = colGroup.ownerDocument.createElement("col");
        colGroup.appendChild(col);
        cols.push(col);
      }
    });
    return cols;
  }

  private addMissingColElements(
    cols: Element[],
    colGroups: Element[],
    columnCount: number,
    tableElement: Element,
  ) {
    if (cols.length < columnCount) {
      const colGroup = tableElement.ownerDocument.createElement("colgroup");
      colGroups.push(colGroup);
      for (let i = cols.length; i < columnCount; i++) {
        const col = tableElement.ownerDocument.createElement("col");
        colGroup.appendChild(col);
        cols.push(col);
      }
    }
  }

  /**
   * Measure width of columns and normalize colgroup and col elements so that
   * each column has a corresponding col element with the width specified.
   */
  normalizeColGroups(
    formattingContext: TableFormattingContext,
    tableElement: Element,
    column: Layout.Column,
  ) {
    const vertical = formattingContext.vertical;
    const lastRow = formattingContext.lastRowViewNode;
    if (!lastRow) {
      return;
    }
    Asserts.assert(lastRow);
    formattingContext.lastRowViewNode = null;
    const doc = lastRow.ownerDocument;
    const fragment = doc.createDocumentFragment();

    // Count columns
    const columnCount = formattingContext.getColumnCount();
    if (!(columnCount > 0)) {
      formattingContext.colGroups = fragment;
      return;
    }

    // Measure column widths
    const colWidths = (formattingContext.colWidths = this.getColumnWidths(
      lastRow,
      columnCount,
      vertical,
      column.clientLayout,
    ));

    // Normalize colgroup and col elements
    const colGroups = this.getColGroupElements(tableElement);
    const cols = this.normalizeAndGetColElements(colGroups);

    // Add missing col elements for remaining columns
    this.addMissingColElements(cols, colGroups, columnCount, tableElement);

    // Assign width to col elements
    cols.forEach((col, i) => {
      Base.setCSSProperty(
        col,
        vertical ? "height" : "width",
        `${colWidths[i]}px`,
      );
    });
    colGroups.forEach((colGroup) => {
      fragment.appendChild(colGroup.cloneNode(true));
    });
    formattingContext.colGroups = fragment;
  }

  doInitialLayout(
    nodeContext: Vtree.NodeContext,
    column: Layout.Column,
  ): Task.Result<Vtree.NodeContext> {
    const formattingContext = getTableFormattingContext(
      nodeContext.formattingContext,
    );
    formattingContext.vertical = nodeContext.vertical;
    formattingContext.initializeRepetitiveElements(nodeContext.vertical);
    Asserts.assert(nodeContext.sourceNode);
    const tableLayoutOption = getTableLayoutOption(nodeContext.sourceNode);
    clearTableLayoutOptionCache(nodeContext.sourceNode);
    const frame = Task.newFrame<Vtree.NodeContext>(
      "TableLayoutProcessor.doInitialLayout",
    );
    const initialNodeContext = nodeContext.copy();
    this.layoutEntireTable(nodeContext, column).then((nodeContextAfter) => {
      const tableElement = nodeContextAfter.viewNode as Element;
      const tableBBox = column.clientLayout.getElementClientRect(tableElement);
      let edge = column.vertical ? tableBBox.left : tableBBox.bottom;
      edge +=
        (column.vertical ? -1 : 1) *
        BreakPosition.calculateOffset(
          nodeContext,
          column.collectElementsOffset(),
        ).current;
      if (
        !column.isOverflown(edge) &&
        (!tableLayoutOption || !tableLayoutOption.calculateBreakPositionsInside)
      ) {
        column.breakPositions.push(
          new EntireTableBreakPosition(initialNodeContext),
        );
        frame.finish(nodeContextAfter);
        return;
      }
      this.normalizeColGroups(formattingContext, tableElement, column);
      formattingContext.updateCellSizes(column.clientLayout);
      frame.finish(null);
    });
    return frame.result();
  }

  addCaptions(
    formattingContext: TableFormattingContext,
    rootViewNode: Element,
    firstChild: Node | null,
  ) {
    const captions = formattingContext.captions;
    captions.forEach((caption, i) => {
      if (caption) {
        rootViewNode.insertBefore(caption.viewNode, firstChild);
        if (caption.side === "top") {
          captions[i] = null;
        }
      }
    });
  }

  addColGroups(
    formattingContext: TableFormattingContext,
    rootViewNode: Element,
    firstChild: Node | null,
  ) {
    if (
      formattingContext.colGroups &&
      this.getColGroupElements(rootViewNode).length === 0
    ) {
      rootViewNode.insertBefore(
        formattingContext.colGroups.cloneNode(true),
        firstChild,
      );
    }
  }

  removeColGroups(
    formattingContext: TableFormattingContext,
    rootViewNode: Element,
  ) {
    if (formattingContext.colGroups && rootViewNode) {
      const colGroups = this.getColGroupElements(rootViewNode);
      if (colGroups) {
        colGroups.forEach((colGroup) => {
          rootViewNode.removeChild(colGroup);
        });
      }
    }
  }

  doLayout(
    nodeContext: Vtree.NodeContext,
    column: Layout.Column,
  ): Task.Result<Vtree.NodeContext> {
    const formattingContext = getTableFormattingContext(
      nodeContext.formattingContext,
    );
    const rootViewNode = formattingContext.getRootViewNode(
      nodeContext,
    ) as Element;
    const firstChild = rootViewNode.firstChild;
    this.addCaptions(formattingContext, rootViewNode, firstChild);
    this.addColGroups(formattingContext, rootViewNode, firstChild);
    const strategy = new TableLayoutStrategy(formattingContext, column);
    const iterator = new LayoutUtil.LayoutIterator(
      strategy,
      column.layoutContext,
    );
    const frame = Task.newFrame<Vtree.NodeContext>(
      "TableFormattingContext.doLayout",
    );
    iterator.iterate(nodeContext).thenFinish(frame);
    return frame.result();
  }

  /** @override */
  layout(
    nodeContext: Vtree.NodeContext,
    column: Layout.Column,
    leadingEdge: boolean,
  ): Task.Result<Vtree.NodeContext> {
    const formattingContext = getTableFormattingContext(
      nodeContext.formattingContext,
    );
    const rootViewNode = formattingContext.getRootViewNode(nodeContext);
    if (!rootViewNode) {
      return column.buildDeepElementView(nodeContext);
    } else {
      if (leadingEdge) {
        RepetitiveElementImpl.appendHeaderToAncestors(
          nodeContext.parent,
          column,
        );
      }
      return new LayoutRetryer(formattingContext, this).layout(
        nodeContext,
        column,
      );
    }
  }

  /** @override */
  createEdgeBreakPosition(
    position: Vtree.NodeContext,
    breakOnEdge: string | null,
    overflows: boolean,
    columnBlockSize: number,
  ): LayoutType.BreakPosition {
    return new BetweenTableRowBreakPosition(
      position,
      breakOnEdge,
      overflows,
      columnBlockSize,
    );
  }

  /** @override */
  startNonInlineElementNode(nodeContext: Vtree.NodeContext): boolean {
    return false;
  }

  /** @override */
  afterNonInlineElementNode(
    nodeContext: Vtree.NodeContext,
    stopAtOverflow: boolean,
  ): boolean {
    return false;
  }

  /** @override */
  finishBreak(
    column: Layout.Column,
    nodeContext: Vtree.NodeContext,
    forceRemoveSelf: boolean,
    endOfColumn: boolean,
  ): Task.Result<boolean> {
    const formattingContext = getTableFormattingContext(
      nodeContext.formattingContext,
    );
    if (nodeContext.display === "table-row") {
      Asserts.assert(nodeContext.sourceNode);
      const rowIndex = formattingContext.findRowIndexBySourceNode(
        nodeContext.sourceNode,
      );
      formattingContext.cellBreakPositions = [];
      let cells: TableCell[];
      if (!nodeContext.after) {
        cells = formattingContext.getCellsFallingOnRow(rowIndex);
      } else {
        cells =
          formattingContext.getRowSpanningCellsOverflowingTheRow(rowIndex);
      }
      if (cells.length) {
        const frame = Task.newFrame<boolean>(
          "TableLayoutProcessor.finishBreak",
        );
        let i = 0;
        frame
          .loopWithFrame((loopFrame) => {
            if (i === cells.length) {
              loopFrame.breakLoop();
              return;
            }
            const cell = cells[i++];
            const cellFragment = formattingContext.getCellFragmentOfCell(cell);
            const breakNodeContext =
              cellFragment.findAcceptableBreakPosition().nodeContext;
            Asserts.assert(breakNodeContext);
            const cellNodeContext = cellFragment.cellNodeContext;
            const cellNodePosition = cellNodeContext.toNodePosition();
            const breakChunkPosition = new VtreeImpl.ChunkPosition(
              breakNodeContext.toNodePosition(),
            );
            formattingContext.cellBreakPositions.push({
              cellNodePosition,
              breakChunkPosition,
              cell,
            } as BrokenTableCellPosition);
            const cellViewNode =
              cellNodeContext.viewNode as HTMLTableCellElement;
            cellFragment.column.layoutContext.processFragmentedBlockEdge(
              cellFragment.cellNodeContext,
            );
            if (rowIndex < cell.rowIndex + cell.rowSpan - 1) {
              cellViewNode.rowSpan = rowIndex - cell.rowIndex + 1;
            }
            if (!cellFragment.empty) {
              cellFragment.pseudoColumn
                .finishBreak(breakNodeContext, false, true)
                .then(() => {
                  Asserts.assert(cellFragment);
                  adjustCellHeight(
                    cellFragment,
                    formattingContext,
                    breakNodeContext,
                  );
                  loopFrame.continueLoop();
                });
            } else {
              loopFrame.continueLoop();
            }
          })
          .then(() => {
            column.clearOverflownViewNodes(nodeContext, false);
            column.layoutContext.processFragmentedBlockEdge(nodeContext);
            formattingContext.finishFragment();
            frame.finish(true);
          });
        return frame.result();
      }
    }
    formattingContext.finishFragment();
    return LayoutProcessor.blockLayoutProcessor.finishBreak(
      column,
      nodeContext,
      forceRemoveSelf,
      endOfColumn,
    );
  }

  /** @override */
  clearOverflownViewNodes(
    column: Layout.Column,
    parentNodeContext: Vtree.NodeContext,
    nodeContext: Vtree.NodeContext,
    removeSelf: boolean,
  ) {
    LayoutProcessor.BlockLayoutProcessor.prototype.clearOverflownViewNodes(
      column,
      parentNodeContext,
      nodeContext,
      removeSelf,
    );
  }
}

function adjustCellHeight(
  cellFragment: TableCellFragment,
  formattingContext: TableFormattingContext,
  breakNodeContext: Vtree.NodeContext,
): void {
  const repetitiveElements = formattingContext.getRepetitiveElements();
  if (!repetitiveElements) {
    return;
  }
  const vertical = formattingContext.vertical;
  const column = cellFragment.column;
  const cellContentElement = cellFragment.pseudoColumn.getColumnElement();
  const cellElement = cellFragment.cellNodeContext.viewNode as Element;
  const cellElementRect = column.clientLayout.getElementClientRect(cellElement);
  const padding = column.getComputedPaddingBorder(cellElement);
  if (vertical) {
    const width =
      cellElementRect.right -
      column.footnoteEdge -
      repetitiveElements.calculateOffset(breakNodeContext) -
      padding.right;
    Base.setCSSProperty(cellContentElement, "max-width", `${width}px`);
  } else {
    const height =
      column.footnoteEdge -
      repetitiveElements.calculateOffset(breakNodeContext) -
      cellElementRect.top -
      padding.top;
    Base.setCSSProperty(cellContentElement, "max-height", `${height}px`);
  }
  Base.setCSSProperty(cellContentElement, "overflow", "hidden");
}

export class LayoutRetryer extends LayoutRetryers.AbstractLayoutRetryer {
  constructor(
    private tableFormattingContext: TableFormattingContext,
    private readonly processor: TableLayoutProcessor,
  ) {
    super();
  }

  override resolveLayoutMode(
    nodeContext: Vtree.NodeContext,
  ): LayoutType.LayoutMode {
    const repetitiveElements =
      this.tableFormattingContext.getRepetitiveElements();
    if (!repetitiveElements || !repetitiveElements.doneInitialLayout) {
      return new LayoutEntireTable(this.tableFormattingContext, this.processor);
    } else {
      if (
        nodeContext.sourceNode ===
          this.tableFormattingContext.tableSourceNode &&
        !nodeContext.after
      ) {
        if (repetitiveElements) {
          repetitiveElements.preventSkippingHeader();
        }
      }
      return new LayoutFragmentedTable(
        this.tableFormattingContext,
        this.processor,
      );
    }
  }

  override clearNodes(initialPosition: Vtree.NodeContext) {
    super.clearNodes(initialPosition);
    const rootViewNode =
      this.tableFormattingContext.getRootViewNode(initialPosition);
    this.processor.removeColGroups(this.tableFormattingContext, rootViewNode);
  }

  override restoreState(nodeContext: Vtree.NodeContext, column: Layout.Column) {
    super.restoreState(nodeContext, column);
    this.tableFormattingContext.finishFragment();
  }
}

export class LayoutEntireTable extends RepetitiveElementImpl.LayoutEntireBlock {
  constructor(
    formattingContext: TableFormattingContext,
    public readonly processor: TableLayoutProcessor,
  ) {
    super(formattingContext);
  }

  override doLayout(
    nodeContext: Vtree.NodeContext,
    column: Layout.Column,
  ): Task.Result<Vtree.NodeContext> {
    return this.processor.doInitialLayout(nodeContext, column);
  }
}

export class EntireTableBreakPosition extends BreakPosition.EdgeBreakPosition {
  constructor(tableNodeContext: Vtree.NodeContext) {
    super(tableNodeContext, null, tableNodeContext.overflow, 0);
  }

  override getMinBreakPenalty(): number {
    if (!this.isEdgeUpdated) {
      throw new Error("EdgeBreakPosition.prototype.updateEdge not called");
    }
    return (
      (this.overflows ? 3 : 0) +
      (this.position.parent ? this.position.parent.breakPenalty : 0)
    );
  }

  override breakPositionChosen(column: Layout.Column): void {
    column.fragmentLayoutConstraints.push(
      new EntireTableLayoutConstraint(this.position.sourceNode),
    );
  }
}

export class EntireTableLayoutConstraint
  implements Layout.FragmentLayoutConstraint
{
  flagmentLayoutConstraintType: FragmentLayoutConstraintType = "EntireTable";

  constructor(public tableRootNode: Node) {}

  /** @override */
  allowLayout(
    nodeContext: Vtree.NodeContext,
    overflownNodeContext: Vtree.NodeContext,
    column: Layout.Column,
  ): boolean {
    // If the nodeContext overflows, any EntireTableLayoutConstraint should not
    // be registered in the first place. See
    // TableLayoutProcessor.prototype.doInitialLayout.
    Asserts.assert(!nodeContext.overflow);
    return false;
  }

  /** @override */
  nextCandidate(nodeContext: Vtree.NodeContext): boolean {
    return true;
  }

  /** @override */
  postLayout(
    allowed: boolean,
    positionAfter: Vtree.NodeContext,
    initialPosition: Vtree.NodeContext,
    column: Layout.Column,
  ) {
    Asserts.assert(positionAfter.sourceNode);
    tableLayoutOptionCache.push({
      root: positionAfter.sourceNode,
      tableLayoutOption: {
        calculateBreakPositionsInside: true,
      } as TableLayoutOption,
    });
  }

  /** @override */
  finishBreak(
    nodeContext: Vtree.NodeContext,
    column: Layout.Column,
  ): Task.Result<boolean> {
    return Task.newResult(true);
  }

  /** @override */
  equalsTo(constraint: Layout.FragmentLayoutConstraint): boolean {
    return (
      constraint instanceof EntireTableLayoutConstraint &&
      constraint.tableRootNode === this.tableRootNode
    );
  }

  /** @override */
  getPriorityOfFinishBreak(): number {
    return 0;
  }
}

export class LayoutFragmentedTable extends RepetitiveElementImpl.LayoutFragmentedBlock {
  constructor(
    formattingContext: TableFormattingContext,
    public readonly processor: TableLayoutProcessor,
  ) {
    super(formattingContext);
  }

  override doLayout(
    nodeContext: Vtree.NodeContext,
    column: Layout.Column,
  ): Task.Result<Vtree.NodeContext> {
    const repetitiveElements = this.formattingContext.getRepetitiveElements();
    if (
      repetitiveElements &&
      !repetitiveElements.isAfterLastContent(nodeContext)
    ) {
      const constraint = new TableRowLayoutConstraint(nodeContext);
      if (
        !column.fragmentLayoutConstraints.some((c) => constraint.equalsTo(c))
      ) {
        column.fragmentLayoutConstraints.unshift(constraint);
      }
    }
    return this.processor.doLayout(nodeContext, column);
  }
}

export class TableRowLayoutConstraint
  extends RepetitiveElementImpl.RepetitiveElementsOwnerLayoutConstraint
  implements Table.TableRowLayoutConstraint
{
  flagmentLayoutConstraintType: FragmentLayoutConstraintType = "TableRow";
  cellFragmentLayoutConstraints: {
    constraints: Layout.FragmentLayoutConstraint[];
    breakPosition: Vtree.NodeContext;
  }[] = [];

  constructor(nodeContext: Vtree.NodeContext) {
    super(nodeContext);
  }

  override allowLayout(
    nodeContext: Vtree.NodeContext,
    overflownNodeContext: Vtree.NodeContext,
    column: Layout.Column,
  ): boolean {
    const repetitiveElements = this.getRepetitiveElements();
    if (!repetitiveElements) {
      return true;
    }
    if (column.pseudoParent) {
      return true;
    }
    if (LayoutHelper.isOrphan(this.nodeContext.viewNode)) {
      return true;
    }
    if (!repetitiveElements.isEnableToUpdateState()) {
      return true;
    }
    if (
      (overflownNodeContext && !nodeContext) ||
      (nodeContext && nodeContext.overflow)
    ) {
      return false;
    } else {
      return true;
    }
  }

  override nextCandidate(nodeContext: Vtree.NodeContext): boolean {
    const formattingContext = getTableFormattingContext(
      this.nodeContext.formattingContext,
    );
    const cellFragmentConstraints = this.collectCellFragmentLayoutConstraints(
      nodeContext,
      formattingContext,
    );
    if (
      cellFragmentConstraints.some((entry) =>
        entry.constraints.some((constraint) =>
          constraint.nextCandidate(nodeContext),
        ),
      )
    ) {
      return true;
    }
    return super.nextCandidate(nodeContext);
  }

  override postLayout(
    allowed: boolean,
    positionAfter: Vtree.NodeContext,
    initialPosition: Vtree.NodeContext,
    column: Layout.Column,
  ) {
    const formattingContext = getTableFormattingContext(
      this.nodeContext.formattingContext,
    );
    this.cellFragmentLayoutConstraints =
      this.collectCellFragmentLayoutConstraints(
        positionAfter,
        formattingContext,
      );
    this.cellFragmentLayoutConstraints.forEach((entry) => {
      entry.constraints.forEach((constraint) => {
        constraint.postLayout(
          allowed,
          entry.breakPosition,
          initialPosition,
          column,
        );
      });
    });
    if (!allowed) {
      const rootViewNode = formattingContext.getRootViewNode(this.nodeContext);
      new TableLayoutProcessor().removeColGroups(
        formattingContext,
        rootViewNode as Element,
      );
      this.removeDummyRowNodes(initialPosition);
    }
    super.postLayout(allowed, positionAfter, initialPosition, column);
  }

  override finishBreak(
    nodeContext: Vtree.NodeContext,
    column: Layout.Column,
  ): Task.Result<boolean> {
    const formattingContext = getTableFormattingContext(
      this.nodeContext.formattingContext,
    );
    const frame: Task.Frame<boolean> = Task.newFrame("finishBreak");
    const constraints = this.cellFragmentLayoutConstraints.reduce(
      (array, entry) =>
        array.concat(
          entry.constraints.map((constraint) => ({
            constraint,
            breakPosition: entry.breakPosition,
          })),
        ),
      [],
    );
    let i = 0;
    frame
      .loop(() => {
        if (i < constraints.length) {
          const entry = constraints[i++];
          return entry.constraint
            .finishBreak(entry.breakPosition, column)
            .thenReturn(true);
        } else {
          return Task.newResult(false);
        }
      })
      .then(() => {
        frame.finish(true);
      });
    return frame
      .result()
      .thenAsync(() => super.finishBreak(nodeContext, column));
  }

  removeDummyRowNodes(nodeContext: Vtree.NodeContext) {
    if (
      !nodeContext ||
      nodeContext.display !== "table-row" ||
      !nodeContext.viewNode
    ) {
      return;
    }
    while ((nodeContext.viewNode as Element).previousElementSibling) {
      const dummyNode = (nodeContext.viewNode as Element)
        .previousElementSibling;
      if (dummyNode.parentNode) {
        dummyNode.parentNode.removeChild(dummyNode);
      }
    }
  }

  private collectCellFragmentLayoutConstraints(
    nodeContext: Vtree.NodeContext,
    formattingContext: TableFormattingContext,
  ): {
    constraints: Layout.FragmentLayoutConstraint[];
    breakPosition: Vtree.NodeContext;
  }[] {
    return this.getCellFragemnts(nodeContext, formattingContext).map(
      (entry) => ({
        constraints:
          entry.fragment.pseudoColumn.getColumn().fragmentLayoutConstraints,
        breakPosition: entry.breakPosition,
      }),
    );
  }

  private getCellFragemnts(
    nodeContext: Vtree.NodeContext,
    formattingContext: TableFormattingContext,
  ): { fragment: TableCellFragment; breakPosition: Vtree.NodeContext }[] {
    let rowIndex = Number.MAX_VALUE;
    if (nodeContext && nodeContext.display === "table-row") {
      Asserts.assert(nodeContext.sourceNode);
      rowIndex =
        formattingContext.findRowIndexBySourceNode(nodeContext.sourceNode) + 1;
    }
    rowIndex = Math.min(formattingContext.cellFragments.length, rowIndex);
    const cellFragments = [];
    for (let i = 0; i < rowIndex; i++) {
      if (!formattingContext.cellFragments[i]) {
        continue;
      }
      formattingContext.cellFragments[i].forEach((cellFragment) => {
        if (!cellFragment) {
          return;
        }
        cellFragments.push({
          fragment: cellFragment,
          breakPosition: cellFragment.findAcceptableBreakPosition().nodeContext,
        });
      });
    }
    return cellFragments;
  }

  getElementsOffsetsForTableCell(
    column: Layout.Column,
  ): RepetitiveElement.ElementsOffset[] {
    const formattingContext = getTableFormattingContext(
      this.nodeContext.formattingContext,
    );
    const position = formattingContext.findCellFromColumn(column);
    if (position) {
      return formattingContext.collectElementsOffsetOfUpperCells(position);
    } else {
      return formattingContext.collectElementsOffsetOfHighestColumn();
    }
  }

  override equalsTo(constraint: Layout.FragmentLayoutConstraint): boolean {
    if (!(constraint instanceof TableRowLayoutConstraint)) {
      return false;
    }
    return (
      getTableFormattingContext(this.nodeContext.formattingContext) ===
      getTableFormattingContext(constraint.nodeContext.formattingContext)
    );
  }
}

const tableLayoutProcessor = new TableLayoutProcessor();

function resolveFormattingContextHook(
  nodeContext: Vtree.NodeContext,
  firstTime: boolean,
  display: Css.Ident,
  position: Css.Ident,
  floatSide: Css.Val,
  isRoot: boolean,
): TableFormattingContext | null {
  if (!firstTime) {
    return null;
  }
  if (display === Css.ident.table) {
    const parent = nodeContext.parent;
    return new TableFormattingContext(
      parent ? parent.formattingContext : null,
      nodeContext.sourceNode as Element,
    );
  }
  return null;
}

function resolveLayoutProcessor(
  formattingContext,
): TableLayoutProcessor | null {
  if (formattingContext instanceof TableFormattingContext) {
    return tableLayoutProcessor;
  }
  return null;
}

Plugin.registerHook(
  Plugin.HOOKS.RESOLVE_FORMATTING_CONTEXT,
  resolveFormattingContextHook,
);

Plugin.registerHook(
  Plugin.HOOKS.RESOLVE_LAYOUT_PROCESSOR,
  resolveLayoutProcessor,
);
