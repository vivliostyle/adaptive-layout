/**
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
 * @fileoverview Assets - Bundle resources
 */

/** vivliostyle-viewport-screen.css */
export const VivliostyleViewportScreenCss = `
@media screen {
  [data-vivliostyle-viewer-viewport] {
    background: #aaaaaa;
  }

  [data-vivliostyle-page-container] {
    background: white;
    z-index: 0;
  }

  [data-vivliostyle-viewer-viewport] {
    box-sizing: border-box;
    display: flex;
    overflow: auto;
    position: relative;
  }

  [data-vivliostyle-outer-zoom-box] {
    margin: auto;
    overflow: hidden;
    flex: none;
  }

  [data-vivliostyle-viewer-viewport] [data-vivliostyle-spread-container] {
    display: flex;
    flex: none;
    justify-content: center;
    transform-origin: left top;
  }

  [data-vivliostyle-viewer-viewport][data-vivliostyle-page-progression="ltr"]
    [data-vivliostyle-spread-container] {
    flex-direction: row;
  }

  [data-vivliostyle-viewer-viewport][data-vivliostyle-page-progression="rtl"]
    [data-vivliostyle-spread-container] {
    flex-direction: row-reverse;
  }

  [data-vivliostyle-viewer-viewport] [data-vivliostyle-page-container] {
    margin: 0 auto;
    flex: none;
    transform-origin: center top;
  }

  [data-vivliostyle-viewer-viewport][data-vivliostyle-spread-view="true"]
    [data-vivliostyle-page-container][data-vivliostyle-page-side="left"] {
    margin-right: 1px;
    transform-origin: right top;
  }

  [data-vivliostyle-viewer-viewport][data-vivliostyle-spread-view="true"]
    [data-vivliostyle-page-container][data-vivliostyle-page-side="right"] {
    margin-left: 1px;
    transform-origin: left top;
  }

  [data-vivliostyle-viewer-viewport][data-vivliostyle-spread-view="true"]
    [data-vivliostyle-page-container][data-vivliostyle-unpaired-page="true"] {
    margin-left: auto;
    margin-right: auto;
    transform-origin: center top;
  }
}
`;

/** vivliostyle-viewport.css */
export const VivliostyleViewportCss = `
[data-vivliostyle-layout-box] {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  z-index: -1;
  transform-origin: left top;
}

[data-vivliostyle-debug] [data-vivliostyle-layout-box] {
  right: auto;
  bottom: auto;
  overflow: visible;
  z-index: auto;
}

[data-vivliostyle-spread-container] {
  transform: scale(var(--viv-outputScale,1));
  transform-origin: left top;
}

/* Emulate high pixel ratio using zoom & transform:scale() */
@supports (zoom: 8) {
  [data-vivliostyle-layout-box] {
    zoom: calc(var(--viv-outputPixelRatio,1) / var(--viv-devicePixelRatio,1));
    transform: scale(calc(var(--viv-devicePixelRatio,1) / var(--viv-outputPixelRatio,1)));
  }
  [data-vivliostyle-spread-container] {
    zoom: calc(var(--viv-outputPixelRatio,1) / var(--viv-devicePixelRatio,1));
    transform: scale(calc(var(--viv-outputScale,1) * var(--viv-devicePixelRatio,1) / var(--viv-outputPixelRatio,1)));
  }
  /* Workaround for Chromium's default border etc. widths not zoomed but scaled down */
  [data-vivliostyle-spread-container] :where([style*=border],[style*=outline],[style*=rule]) {
    border-width: medium;
    outline-width: medium;
    column-rule-width: medium;
  }
  [data-vivliostyle-spread-container] ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  [data-vivliostyle-spread-container] ::-webkit-scrollbar-track {
    background-color: #f4f4f4;
  }
  [data-vivliostyle-spread-container] ::-webkit-scrollbar-thumb {
    border-radius: 4px;
    background: #c7c7c7;
  }
  [data-vivliostyle-spread-container] ::-webkit-scrollbar-thumb:hover {
    background: #7d7d7d;
  }
}

[data-vivliostyle-page-container] {
  position: relative;
}

[data-vivliostyle-bleed-box] {
  position: absolute;
  overflow: hidden;
  background-origin: content-box !important;
  box-sizing: border-box;
}

[data-vivliostyle-page-box] ~ [data-vivliostyle-page-box] {
  display: none;
}

[data-vivliostyle-toc-box] {
  position: absolute;
  left: 3px;
  top: 3px;
  overflow: scroll;
  overflow-x: hidden;
  background: rgba(248, 248, 248, 0.9);
  border-radius: 2px;
  box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.4);
}

@media print {
  [data-vivliostyle-toc-box] {
    display: none;
  }

  [data-vivliostyle-outer-zoom-box],
  [data-vivliostyle-spread-container] {
    width: 100% !important;
    height: 100% !important;
  }

  [data-vivliostyle-spread-container] {
    --viv-outputScale: 1 !important;
    --viv-devicePixelRatio: 1 !important;
    zoom: normal !important;
    transform: none !important;
  }

  @supports (zoom: 8) {
    [data-vivliostyle-spread-container] [data-vivliostyle-page-container] {
      zoom: var(--viv-outputPixelRatio,1);
      transform: scale(calc(1 / var(--viv-outputPixelRatio,1)));
      transform-origin: left top;
    }
  }

  [data-vivliostyle-spread-container] [data-vivliostyle-page-container] {
    display: block !important;
    max-height: 100vh;
  }

  [data-vivliostyle-spread-container] [data-vivliostyle-page-container]:not(:last-child) {
    break-after: page;
  }

  /* Gecko-only hack, see https://bugzilla.mozilla.org/show_bug.cgi?id=267029#c17 */
  @-moz-document url-prefix()  {
    [data-vivliostyle-spread-container] [data-vivliostyle-page-container]:nth-last-child(n + 2) {
      top: -1px;
      margin-top: 1px;
      margin-bottom: -1px;
    }
    /* Workaround Gecko problem on page break */
    [data-vivliostyle-spread-container] [data-vivliostyle-page-container] {
      break-after: auto !important;
      height: 100% !important;
    }
  }
}
`;

/** validation.txt */
export const ValidationTxt = `
/*
 * Copyright 2013 Google, Inc.
 * Copyright 2015 Daishinsha Inc.
 * Copyright 2019 Vivliostyle Foundation
 *
 * CSS property validation.
 */
NUM = POS_NUM | ZERO | NEGATIVE;
NNEG_NUM = POS_NUM | ZERO;
INT = POS_INT | ZERO | NEGATIVE;
NNEG_INT = POS_INT | ZERO;
PERCENTAGE = POS_PERCENTAGE | ZERO | NEGATIVE;
STRICT_PERCENTAGE = POS_PERCENTAGE | ZERO_PERCENTAGE | NEGATIVE;
NNEG_PERCENTAGE = POS_PERCENTAGE | ZERO;
LENGTH = POS_LENGTH | ZERO | NEGATIVE;
NNEG_LENGTH = POS_LENGTH | ZERO;
PLENGTH = LENGTH | PERCENTAGE;
PPLENGTH = POS_LENGTH | ZERO | POS_PERCENTAGE;
ALENGTH = LENGTH | auto;
APLENGTH = PLENGTH | auto;
PAPLENGTH = PPLENGTH | auto;
ANGLE = POS_ANGLE | ZERO | NEGATIVE;
LENGTH_OR_NUM = LENGTH | NUM;
ANGLE_OR_NUM = ANGLE | NUM;
MIN_MAX_FIT_CONTENT = min-content | max-content | fit-content;
BG_POSITION_TERM = PLENGTH | left | center | right | top | bottom;
URI_OR_NONE = URI | none;
IMAGE = URI | IMAGE_FUNCTION | none;
background-attachment = COMMA( [scroll | fixed | local]+ );
background-color = COLOR;
background-image = COMMA( IMAGE+ );
background-position = COMMA( SPACE(BG_POSITION_TERM{1,4})+ ); /* relaxed */
background-repeat = COMMA( [repeat | repeat-x | repeat-y | no-repeat]+ );
border-collapse = collapse | separate;
BORDER_SIDE_COLOR = COLOR;
BORDER_SIDE_STYLE = none | hidden | dotted | dashed | solid | double | groove | ridge | inset | outset;
BORDER_SIDE_WIDTH = thin: 1px | medium: 3px | thick: 5px | NNEG_LENGTH;
border-spacing = LENGTH LENGTH?;
border-top-color = BORDER_SIDE_COLOR;
border-right-color = BORDER_SIDE_COLOR;
border-bottom-color = BORDER_SIDE_COLOR;
border-left-color = BORDER_SIDE_COLOR;
border-top-style = BORDER_SIDE_STYLE;
border-right-style = BORDER_SIDE_STYLE;
border-bottom-style = BORDER_SIDE_STYLE;
border-left-style = BORDER_SIDE_STYLE;
border-top-width = BORDER_SIDE_WIDTH;
border-right-width = BORDER_SIDE_WIDTH;
border-bottom-width = BORDER_SIDE_WIDTH;
border-left-width = BORDER_SIDE_WIDTH;
BORDER_RADIUS = PLENGTH{1,2};
border-top-left-radius = BORDER_RADIUS;
border-top-right-radius = BORDER_RADIUS;
border-bottom-right-radius = BORDER_RADIUS;
border-bottom-left-radius = BORDER_RADIUS;
border-image-source = IMAGE;
border-image-slice = [NUM | PERCENTAGE]{1,4} || fill; /* relaxed */
border-image-width = [NUM | PLENGTH | auto]{1,4};
border-image-outset = [NUM | LENGTH]{1,4};
border-image-repeat = [ stretch | repeat | round | space ]{1,2};
bottom = APLENGTH;
caption-side = top | bottom;
clear = none | left | right | top | bottom | inline-start | inline-end | block-start | block-end | both | all | same;
clip = rect(ALENGTH{4}) | rect(SPACE(ALENGTH{4})) | auto;
color = COLOR;
LIST_STYLE_TYPE = IDENT;
TYPE_OR_UNIT_IN_ATTR = string | color | url | integer | number | length | angle | time | frequency;
ATTR = attr(SPACE(IDENT TYPE_OR_UNIT_IN_ATTR?) [ STRING | IDENT | COLOR | INT | NUM | PLENGTH | ANGLE | POS_TIME | FREQUENCY]?);
CONTENT_LIST = [ STRING | URI | counter(IDENT LIST_STYLE_TYPE?) |
    counters(IDENT STRING LIST_STYLE_TYPE?) | ATTR |
    target-counter([ STRING | URI ] IDENT LIST_STYLE_TYPE?) |
    target-counter(ATTR IDENT LIST_STYLE_TYPE?) |
    target-counters([ STRING | URI ] IDENT STRING LIST_STYLE_TYPE?) |
    target-counters(ATTR IDENT STRING LIST_STYLE_TYPE?) |
    leader([ dotted | solid | space ] | STRING ) |
    open-quote | close-quote | no-open-quote | no-close-quote |
    content([ text | before | after | first-letter ]?) |
    string(IDENT [first | start | last | first-except]?) |
    element(IDENT [first | start | last | first-except]?) ]+;
CONTENT = normal | none | CONTENT_LIST;
content = CONTENT;
COUNTER = [ IDENT INT? ]+ | none;
counter-increment = COUNTER;
counter-reset = COUNTER;
counter-set = COUNTER;
cursor = COMMA(URI* [ auto | crosshair | default | pointer | move | e-resize | ne-resize | nw-resize |
    n-resize | se-resize | sw-resize | s-resize | w-resize | text | wait | help | progress ]);
direction = ltr | rtl;
display = inline | block | list-item | inline-block | table | inline-table | table-row-group |
    table-header-group | table-footer-group | table-row | table-column-group | table-column |
    table-cell | table-caption | none | oeb-page-head | oeb-page-foot | flex | inline-flex |
    ruby | ruby-base | ruby-text | ruby-base-container | ruby-text-container | run-in | compact | marker |
    flow-root | grid | inline-grid | contents;
empty-cells = show | hide;
FAMILY = SPACE(IDENT+) | STRING;
FAMILY_LIST = COMMA( FAMILY+ );
font-family = FAMILY_LIST;
font-size = xx-small | x-small | small | medium | large | x-large | xx-large | larger | smaller | PPLENGTH;
font-style = normal | italic | oblique;
font-weight = normal | bold | bolder | lighter | POS_NUM;
height = PAPLENGTH | MIN_MAX_FIT_CONTENT;
left = APLENGTH;
letter-spacing = normal | LENGTH_OR_NUM;
line-height = normal | POS_NUM | PPLENGTH;
list-style-image = IMAGE;
list-style-position = inside | outside;
list-style-type = LIST_STYLE_TYPE;
margin-right = APLENGTH;
margin-left = APLENGTH;
margin-top = APLENGTH;
margin-bottom = APLENGTH;
NPLENGTH = none | PLENGTH;
max-height = NPLENGTH | MIN_MAX_FIT_CONTENT;
max-width = NPLENGTH | MIN_MAX_FIT_CONTENT;
min-height = APLENGTH | MIN_MAX_FIT_CONTENT;
min-width = APLENGTH | MIN_MAX_FIT_CONTENT;
orphans = POS_INT;
outline-offset = LENGTH;
outline-color = COLOR | invert;
outline-style = BORDER_SIDE_STYLE;
outline-width = BORDER_SIDE_WIDTH;
overflow = visible | hidden | scroll | auto | clip;
padding-right = PPLENGTH;
padding-left = PPLENGTH;
padding-top = PPLENGTH;
padding-bottom = PPLENGTH;
PAGE_BREAK = auto | always | avoid | left | right | recto | verso;
page-break-after = PAGE_BREAK;
page-break-before = PAGE_BREAK;
page-break-inside = avoid | auto;
position = static | relative | absolute | fixed | running(IDENT);
quotes = [STRING STRING]+ | none | auto;
right = APLENGTH;
table-layout = auto | fixed;
text-align = left | right | center | justify | start | end;
text-indent = PLENGTH;
text-transform = capitalize | uppercase | lowercase | none;
top = APLENGTH;
vertical-align = baseline | sub | super | top | text-top | middle | bottom | text-bottom | PLENGTH;
visibility = visible | hidden | collapse;
white-space = normal | pre | nowrap | pre-wrap | pre-line | break-spaces;
widows = POS_INT;
width = PAPLENGTH | MIN_MAX_FIT_CONTENT;
word-spacing = normal | LENGTH_OR_NUM;
z-index = auto | INT;

[epub,moz,webkit]hyphens = auto | manual | none;
[webkit]hyphenate-character = auto | STRING;

/* css-logical */
margin-block-start = APLENGTH;
margin-block-end = APLENGTH;
margin-inline-start = APLENGTH;
margin-inline-end = APLENGTH;
padding-block-start = APLENGTH;
padding-block-end = APLENGTH;
padding-inline-start = APLENGTH;
padding-inline-end = APLENGTH;
border-block-start-color = BORDER_SIDE_COLOR;
border-block-end-color = BORDER_SIDE_COLOR;
border-inline-start-color = BORDER_SIDE_COLOR;
border-inline-end-color = BORDER_SIDE_COLOR;
border-block-start-style = BORDER_SIDE_STYLE;
border-block-end-style = BORDER_SIDE_STYLE;
border-inline-start-style = BORDER_SIDE_STYLE;
border-inline-end-style = BORDER_SIDE_STYLE;
border-block-start-width = BORDER_SIDE_WIDTH;
border-block-end-width = BORDER_SIDE_WIDTH;
border-inline-start-width = BORDER_SIDE_WIDTH;
border-inline-end-width = BORDER_SIDE_WIDTH;
block-start = APLENGTH;
block-end = APLENGTH;
inline-start = APLENGTH;
inline-end = APLENGTH;
block-size = PAPLENGTH | MIN_MAX_FIT_CONTENT;
inline-size = PAPLENGTH | MIN_MAX_FIT_CONTENT;
max-block-size = NPLENGTH | MIN_MAX_FIT_CONTENT;
max-inline-size = NPLENGTH | MIN_MAX_FIT_CONTENT;
min-block-size = APLENGTH | MIN_MAX_FIT_CONTENT;
min-inline-size = APLENGTH | MIN_MAX_FIT_CONTENT;

SHAPE = auto | rectangle( PLENGTH{4} ) |  ellipse( PLENGTH{4} ) |  circle( PLENGTH{3} ) |
    polygon( SPACE(PLENGTH+)+ );
[epubx]shape-inside = SHAPE;
[epubx,webkit]shape-outside = SHAPE;
[epubx]wrap-flow = auto | both | start | end | maximum | clear | around /* epub al */;

TRANSFORM_FUNCTION = matrix(NUM{6}) | translate(PLENGTH{1,2}) | translateX(PLENGTH) | translateY(PLENGTH) |
 scale(NUM{1,2}) | scaleX(NUM) | scaleY(NUM) | rotate(ANGLE) | skewX(ANGLE) | skewY(ANGLE);
[epub]transform = none | TRANSFORM_FUNCTION+;
[epub]transform-origin = [[[ top | bottom | left | right] PLENGTH?] | center | PLENGTH]{1,2}; /* relaxed */

BOX = border-box | padding-box | content-box;
SHADOW = SPACE(inset || LENGTH{2,4} || COLOR); /* relaxed */
[webkit]background-size = COMMA( SPACE( [PLENGTH | auto ]{1,2} | cover | contain)+ );
[webkit]background-origin = COMMA( BOX+ );
[webkit]background-clip = COMMA( BOX+ );
[webkit]box-shadow = none | COMMA( SHADOW+ );
text-shadow = none |  COMMA( SHADOW+ );
[webkit]box-decoration-break = slice | clone;
FILTER_FUNCTION = blur(LENGTH) | brightness(NUM | PERCENTAGE) | contrast(NUM | PERCENTAGE) | drop-shadow(SPACE(LENGTH{2,3} COLOR?))
                | grayscale(NUM | PERCENTAGE) | hue-rotate(ANGLE) | invert(NUM | PERCENTAGE) | opacity(NUM | PERCENTAGE)
                | saturate(NUM | PERCENTAGE) | sepia(NUM | PERCENTAGE);
FILTER_FUNCTION_LIST = FILTER_FUNCTION+;
[webkit]filter = none | FILTER_FUNCTION_LIST;

opacity = NUM;

[moz,webkit]column-width = LENGTH | auto;
[moz,webkit]column-count = INT | auto;
[moz,webkit]column-gap = LENGTH | normal;
[moz,webkit]column-rule-color = COLOR;
[moz,webkit]column-rule-style = BORDER_SIDE_STYLE;
[moz,webkit]column-rule-width = BORDER_SIDE_WIDTH;
BREAK = auto | avoid | avoid-page | page | left | right | recto | verso | avoid-column | column | avoid-region | region;
break-before = BREAK;
break-after = BREAK;
break-inside = auto | avoid | avoid-page | avoid-column | avoid-region;
[webkit]column-span = none | auto | all;
[moz]column-fill = auto | balance | balance-all;
margin-break = auto | keep | discard;

src = COMMA([SPACE(URI format(STRING+)?) | local(FAMILY)]+); /* for font-face */

[epubx,webkit]flow-from = IDENT;
[epubx,webkit]flow-into = IDENT;
[epubx]flow-linger = INT | none;
[epubx]flow-priority = INT;
[epubx]flow-options = none | [ exclusive || last || static ];
[epubx]page = INT | auto | IDENT; /* page: IDENT is for CSS Paged Media */
[epubx]min-page-width = LENGTH;
[epubx]min-page-height = LENGTH;
[epubx]required = true | false;
[epubx]enabled = true | false;
[epubx]conflicting-partitions = COMMA(IDENT+);
[epubx]required-partitions = COMMA(IDENT+);
[epubx]snap-height = LENGTH | none;
[epubx]snap-width = LENGTH | none;
[epubx]flow-consume = all | some;
[epubx]utilization = NUM;
[epubx]text-zoom = font-size | scale;

[adapt]template = URI_OR_NONE | footnote;
[adapt]behavior = IDENT;

/* CSS Fonts */
COMMON_LIG_VALUES        = [ common-ligatures | no-common-ligatures ];
DISCRETIONARY_LIG_VALUES = [ discretionary-ligatures | no-discretionary-ligatures ];
HISTORICAL_LIG_VALUES    = [ historical-ligatures | no-historical-ligatures ];
CONTEXTUAL_ALT_VALUES    = [ contextual | no-contextual ];
font-variant-ligatures = normal | none | [ COMMON_LIG_VALUES || DISCRETIONARY_LIG_VALUES || HISTORICAL_LIG_VALUES || CONTEXTUAL_ALT_VALUES ];
font-variant-caps = normal | small-caps | all-small-caps | petite-caps | all-petite-caps | unicase | titling-caps;
NUMERIC_FIGURE_VALUES   = [ lining-nums | oldstyle-nums ];
NUMERIC_SPACING_VALUES  = [ proportional-nums | tabular-nums ];
NUMERIC_FRACTION_VALUES = [ diagonal-fractions | stacked-fractions ];
font-variant-numeric = normal | [ NUMERIC_FIGURE_VALUES || NUMERIC_SPACING_VALUES || NUMERIC_FRACTION_VALUES || ordinal || slashed-zero ];
EAST_ASIAN_VARIANT_VALUES = [ jis78 | jis83 | jis90 | jis04 | simplified | traditional ];
EAST_ASIAN_WIDTH_VALUES   = [ full-width | proportional-width ];
font-variant-east-asian = normal | [ EAST_ASIAN_VARIANT_VALUES || EAST_ASIAN_WIDTH_VALUES || ruby ];
font-variant_css2 = normal | small-caps; /* for font shorthand */
font-size-adjust = none | NNEG_NUM;
[webkit]font-kerning = auto | normal | none;
font-feature-settings = COMMA( normal | SPACE( STRING [ on | off | INT ]? )+ );
FONT_STRETCH_CSS3_VALUES = normal | wider | narrower | ultra-condensed | extra-condensed | condensed | semi-condensed | semi-expanded | expanded | extra-expanded | ultra-expanded;
font-stretch = FONT_STRETCH_CSS3_VALUES | PERCENTAGE;
font-stretch_css3 = FONT_STRETCH_CSS3_VALUES; /* for font shorthand */
font-display = [ auto | block | swap | fallback | optional ];
unicode-range = COMMA( URANGE+ );

/* CSS Images */
image-resolution = RESOLUTION;
object-fit = fill | contain | cover | none | scale-down;
object-position = COMMA( SPACE(BG_POSITION_TERM{1,4})+ ); /* relaxed */

/* CSS Paged Media */
PAGE_SIZE = a10 | a9 | a8 | a7 | a6 | a5 | a4 | a3 | a2 | a1 | a0
          | b10 | b9 | b8 | b7 | b6 | b5 | b4 | b3 | b2 | b1 | b0
          | c10 | c9 | c8 | c7 | c6 | c5 | c4 | c3 | c2 | c1 | c0
          | jis-b10 | jis-b9 | jis-b8 | jis-b7 | jis-b6 | jis-b5 | jis-b4 | jis-b3 | jis-b2 | jis-b1 | jis-b0
          | letter | legal | ledger;
bleed = auto | LENGTH;
marks = none | [ crop || cross ];
size = POS_LENGTH{1,2} | auto | [ PAGE_SIZE || [ portrait | landscape ] ];
crop-offset = auto | LENGTH;

/* CSS Page Floats */
float-reference = inline | column | region | page;
float = [ block-start || block-end || inline-start || inline-end || snap-block || snap-inline || left || right || top || bottom] | none | footnote;
float-min-wrap-block = PPLENGTH;

/* CSS Ruby */
ruby-align = start | center | space-between | space-around;
ruby-position = over | under | inter-character;

/* CSS Size Adjust */
[moz,webkit]text-size-adjust = auto | none | POS_PERCENTAGE;

/* CSS Text */
[webkit]line-break = auto | loose | normal | strict | anywhere;
overflow-wrap = normal | break-word | anywhere;
[moz]tab-size = NNEG_INT | NNEG_LENGTH;
[moz]text-align-last = auto | start | end | left | right | center | justify;
text-justify = auto | none | inter-word | inter-character;
word-break = normal | keep-all | break-all | break-word;
text-spacing-trim = auto | normal | space-all | trim-both | trim-auto |
    [[ trim-start | space-start | space-first ] ||
     [ trim-end | space-end | allow-end ] ||
     [ trim-adjacent | space-adjacent ]];
text-autospace = normal | auto | no-autospace |
    [[ ideograph-alpha || ideograph-numeric || punctuation ] || [ insert | replace ]];
hanging-punctuation = none | [ first || [ force-end | allow-end ] || last ];

/* CSS Text Decoration */
[webkit]text-decoration-color = COLOR;
[webkit]text-decoration-line = none | [ underline || overline || line-through || blink ];
[webkit]text-decoration-skip = none | [ objects || spaces || ink || edges || box-decoration ];
[webkit]text-decoration-style = solid | double | dotted | dashed | wavy;
[webkit]text-decoration-thickness = from-font | APLENGTH;
[epub,webkit]text-emphasis-color = COLOR;
[webkit]text-emphasis-position = [ over | under ] [ right | left ];
[epub,webkit]text-emphasis-style = none | [[ filled | open ] || [ dot | circle | double-circle | triangle | sesame ]] | STRING;
[webkit]text-underline-position = auto | [ under || [ left | right ]];

/* CSS Transforms */
[webkit]backface-visibility = visible | hidden;

/* CSS UI */
[moz,webkit]box-sizing = content-box | padding-box | border-box;
text-overflow = [clip | ellipsis | STRING]{1,2};

/* CSS Writing Modes */
[epub,webkit]text-combine = none | horizontal;
text-combine-upright = none | all; /* relaxed */
[epub,webkit]text-orientation = mixed | upright | sideways-right | sideways-left | sideways | use-glyph-orientation /* the following values are kept for backward-compatibility */ | vertical-right | rotate-right | rotate-left | rotate-normal | auto;
unicode-bidi = normal | embed | isolate | bidi-override | isolate-override | plaintext;
[epub,webkit]writing-mode = horizontal-tb | vertical-rl | lr-tb | rl-tb | tb-rl | lr | rl | tb;

/* CSS Flex box */
FLEX_BASIS = content | PAPLENGTH;
flex-direction = row | row-reverse | column | column-reverse;
flex-wrap = nowrap | wrap | wrap-reverse;
order = INT;
flex-grow = NNEG_NUM;
flex-shrink = NNEG_NUM;
flex-basis = FLEX_BASIS;
flex = none | [ [ NNEG_NUM NNEG_NUM? ] || FLEX_BASIS ];
justify-content = flex-start | flex-end | center | space-between | space-around;
align-items = flex-start | flex-end | center | baseline | stretch;
align-self = auto | flex-start | flex-end | center | baseline | stretch;
align-content = flex-start | flex-end | center | space-between | space-around | stretch;

/* Pointer Events */
touch-action = auto | none | [ pan-x || pan-y ] | manipulation;

/* SVG 2 */
OPACITY_VALUE = NUM | PERCENTAGE;
DASH_ARRAY = COMMA( SPACE( [ LENGTH | PERCENTAGE | NUM ]+ )+ );
PAINT = none | child | child(INT) | COLOR | SPACE( URI [none | COLOR]? ) | context-fill | context-stroke;
color-interpolation = auto | sRGB | linearRGB;
color-rendering = auto | optimizeSpeed | optimizeQuality;
fill = PAINT;
fill-opacity = OPACITY_VALUE;
fill-rule = nonzero | evenodd;
glyph-orientation-vertical = auto | NUM | ANGLE;
image-rendering = auto | optimizeSpeed | optimizeQuality | crisp-edges | pixelated;
marker-start = none | URI;
marker-mid = none | URI;
marker-end = none | URI;
pointer-events = bounding-box | visiblePainted | visibleFill | visibleStroke | visible | painted | fill | stroke | all | none;
paint-order = normal | [ fill || stroke || markers ];
shape-rendering = auto | optimizeSpeed | crispEdges | geometricPrecision;
stop-color = COLOR;
stop-opacity = OPACITY_VALUE;
stroke = PAINT;
stroke-dasharray = none | DASH_ARRAY;
stroke-dashoffset = PERCENTAGE | LENGTH_OR_NUM;
stroke-linecap = butt | round | square;
stroke-linejoin = miter | round | bevel;
stroke-miterlimit = NUM;
stroke-opacity = OPACITY_VALUE;
stroke-width = PERCENTAGE | LENGTH_OR_NUM;
text-anchor = start | middle | end;
text-rendering = auto | optimizeSpeed | optimizeLegibility | geometricPrecision;
vector-effect = none | SPACE( [ non-scaling-stroke | non-scaling-size | non-rotation | fixed-position ]+ [ viewport | screen ]? );

/* SVG 1.1 */
alignment-baseline = auto | baseline | before-edge | text-before-edge | middle | central | after-edge | text-after-edge | ideographic | alphabetic | hanging | mathematical;
baseline-shift = baseline | sub | super | PERCENTAGE | LENGTH_OR_NUM;
dominant-baseline = auto | use-script | no-change | reset-size | ideographic | alphabetic | hanging | mathematical | central | middle | text-after-edge | text-before-edge;
mask = none | URI;

/* css-masking-1 */
SHAPE_RADIUS = PLENGTH | closest-side | farthest-side;
FILL_RULE = nonzero | evenodd;
SHAPE_BOX = BOX | margin-box;
GEOMETRY_BOX = SHAPE_BOX | fill-box | stroke-box | view-box;
BASIC_SHAPE =
    inset( SPACE( PLENGTH{1,4} [ round PLENGTH{1,4} [ SLASH PLENGTH{1,4} ]? ]? ) )
  | circle(  SPACE( [SHAPE_RADIUS]?    [at BG_POSITION_TERM{1,4}]? ) )
  | ellipse( SPACE( SHAPE_RADIUS{2}? [at BG_POSITION_TERM{1,4}]? ) )
  | polygon( FILL_RULE? COMMA( SPACE( PLENGTH{2} )+ )+ );
[webkit]clip-path = none | URI | [ BASIC_SHAPE || GEOMETRY_BOX ];
clip-rule = nonzero | evenodd;

/* filters */
flood-color = COLOR;
flood-opacity = OPACITY_VALUE;
lighting-color = COLOR;

/* compositing-1 */
BLEND_MODE = normal | multiply | screen | overlay | darken | lighten | color-dodge | color-burn | hard-light | soft-light | difference | exclusion | hue | saturation | color | luminosity;
mix-blend-mode = BLEND_MODE;
isolation = auto | isolate;
background-blend-mode = COMMA( BLEND_MODE+ );

/* CSS GCPM */
string-set = COMMA( SPACE( IDENT CONTENT_LIST )+ | none );
footnote-policy = auto | line;

/* CSS Repeated Headers and Footers */
[viv]repeat-on-break = auto | none | header | footer;

/* Compatibility */
[webkit]text-fill-color = COLOR;
[webkit]text-stroke-color = COLOR;
[webkit]text-stroke-width = BORDER_SIDE_WIDTH;

DEFAULTS

background-attachment: scroll;
background-color: transparent;
background-image: none;
background-repeat: repeat;
background-position: 0% 0%;
background-clip: border-box;
background-origin: padding-box;
background-size: auto;
border-top-color: currentColor;
border-right-color: currentColor;
border-bottom-color: currentColor;
border-left-color: currentColor;
border-top-style: none;
border-right-style: none;
border-bottom-style: none;
border-left-style: none;
border-top-width: 3px;
border-right-width: 3px;
border-bottom-width: 3px;
border-left-width: 3px;
border-top-left-radius: 0;
border-top-right-radius: 0;
border-bottom-right-radius: 0;
border-bottom-left-radius: 0;
border-image-source: none;
border-image-slice: 100%;
border-image-width: 1;
border-image-outset: 0;
border-image-repeat: stretch;
column-count: auto;
column-gap: normal;
column-width: auto;
column-rule-color: currentColor;
column-rule-style: none;
column-rule-width: 3px;
column-fill: balance;
outline-color: currentColor;
outline-style: none;
outline-width: 3px;
flex-direction: row;
flex-wrap: nowrap;
font-family: serif;
font-style: normal;
font-size: medium;
font-size-adjust: none;
font-kerning: auto;
font-feature-settings: normal;
font-variant-ligatures: normal;
font-variant-caps: normal;
font-variant-numeric: normal;
font-variant-east-asian: normal;
font-weight: normal;
font-stretch: normal;
line-height: normal;
list-style-image: none;
list-style-position: outside;
list-style-type: disc;
margin-bottom: auto;
margin-left: auto;
margin-right: auto;
margin-top: auto;
padding-bottom: auto;
padding-left: auto;
padding-right: auto;
padding-top: auto;
text-autospace: normal;
text-emphasis-color: currentColor;
text-emphasis-style: none;
text-spacing-trim: normal;
text-stroke-color: currentColor;
text-stroke-width: 0;
marker-start: none;
marker-mid: none;
marker-end: none;

/* css-logical */
border-block-start-color: currentColor;
border-block-end-color: currentColor;
border-inline-start-color: currentColor;
border-inline-end-color: currentColor;
border-block-start-style: none;
border-block-end-style: none;
border-inline-start-style: none;
border-inline-end-style: none;
border-block-start-width: 3px;
border-block-end-width: 3px;
border-inline-start-width: 3px;
border-inline-end-width: 3px;

SHORTHANDS

all = ALL;
background = COMMA background-image [background-position [ / background-size ]] background-repeat
     background-attachment [background-origin background-clip] background-color; /* background-color is a special case, see the code */
border-top = border-top-width border-top-style border-top-color;
border-right = border-right-width border-right-style border-right-color;
border-bottom = border-bottom-width border-bottom-style border-bottom-color;
border-left = border-left-width border-left-style border-left-color;
border-width = INSETS border-top-width border-right-width border-bottom-width border-left-width;
border-style = INSETS border-top-style border-right-style border-bottom-style border-left-style;
border-color = INSETS border-top-color border-right-color border-bottom-color border-left-color;
border = border-width border-style border-color;
border-image = border-image-source border-image-slice [ / border-image-width [ / border-image-outset ] ]
     border-image-repeat;
border-radius = INSETS_SLASH border-top-left-radius border-top-right-radius
     border-bottom-right-radius border-bottom-left-radius;
[moz,webkit]columns = column-width column-count;
[moz,webkit]column-rule = column-rule-width column-rule-style column-rule-color;
flex-flow = flex-direction flex-wrap;
oeb-column-number = column-count;
outline = outline-width outline-style outline-color;
list-style = list-style-position list-style-type list-style-image;
margin = INSETS margin-top margin-right margin-bottom margin-left;
padding = INSETS padding-top padding-right padding-bottom padding-left;
font = FONT font-style font-variant_css2 font-weight font-stretch_css3 /* font-size line-height font-family are special-cased */;
font-variant = font-variant-ligatures font-variant-caps font-variant-numeric font-variant-east-asian;
[epub,webkit]text-emphasis = text-emphasis-style text-emphasis-color;
marker = INSETS marker-start marker-mid marker-end;
[webkit]text-stroke = text-stroke-width text-stroke-color;
text-decoration = text-decoration-line text-decoration-color text-decoration-style text-decoration-thickness;
text-spacing = TEXT_SPACING text-autospace text-spacing-trim;

/* css-logical */
margin-block = INSETS margin-block-start margin-block-end;
margin-inline = INSETS margin-inline-start margin-inline-end;
padding-block = INSETS padding-block-start padding-block-end;
padding-inline = INSETS padding-inline-start padding-inline-end;
border-block-width = INSETS border-block-start-width border-block-end-width;
border-block-style = INSETS border-block-start-style border-block-end-style;
border-block-color = INSETS border-block-start-color border-block-end-color;
border-inline-width = INSETS border-inline-start-width border-inline-end-width;
border-inline-style = INSETS border-inline-start-style border-inline-end-style;
border-inline-color = INSETS border-inline-start-color border-inline-end-color;
border-block = border-block-width border-block-style border-block-color;
border-inline = border-inline-width border-inline-style border-inline-color;
border-block-start = border-block-start-width border-block-start-style border-block-start-color;
border-block-end = border-block-end-width border-block-end-style border-block-end-color;
border-inline-start = border-inline-start-width border-inline-start-style border-inline-start-color;
border-inline-end = border-inline-end-width border-inline-end-style border-inline-end-color;
inset-block-start = block-start;
inset-block-end = block-end;
inset-inline-start = inline-start;
inset-inline-end = inline-end;
inset-block = INSETS block-start block-end;
inset-inline = INSETS inline-start inline-end;
inset = INSETS top right bottom left;

/* old names  */
word-wrap = overflow-wrap;
[adapt,webkit]margin-before = margin-block-start;
[adapt,webkit]margin-after = margin-block-end;
[adapt,webkit]margin-start = margin-inline-start;
[adapt,webkit]margin-end = margin-inline-end;
[adapt,webkit]padding-before = padding-block-start;
[adapt,webkit]padding-after = padding-block-end;
[adapt,webkit]padding-start = padding-inline-start;
[adapt,webkit]padding-end = padding-inline-end;
[adapt,webkit]border-before-color = border-block-start-color;
[adapt,webkit]border-after-color = border-block-end-color;
[adapt,webkit]border-start-color = border-inline-start-color;
[adapt,webkit]border-end-color = border-inline-end-color;
[adapt,webkit]border-before-style = border-block-start-style;
[adapt,webkit]border-after-style = border-block-end-style;
[adapt,webkit]border-start-style = border-inline-start-style;
[adapt,webkit]border-end-style = border-inline-end-style;
[adapt,webkit]border-before-width = border-block-start-width;
[adapt,webkit]border-after-width = border-block-end-width;
[adapt,webkit]border-start-width = border-inline-start-width;
[adapt,webkit]border-end-width = border-inline-end-width;
[adapt,webkit]before = block-start;
[adapt,webkit]after = block-end;
[adapt,webkit]start = inline-start;
[adapt,webkit]end = inline-end;

`;

/** user-agent.xml */
export const UserAgentXml = `
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:s="http://www.pyroxy.com/ns/shadow">
<head>
<style><![CDATA[

.-vivliostyle-footnote-content {
  float: footnote;
}

.-vivliostyle-table-cell-container {
  display: block;
}

]]></style>
</head>
<body>

<s:template id="footnote"><s:content/><s:include class="-vivliostyle-footnote-content"/></s:template>

<s:template id="table-cell"><div data-vivliostyle-flow-root="true" class="-vivliostyle-table-cell-container"><s:content/></div></s:template>

</body>
</html>`;

/** user-agent-page.css */
export const UserAgentPageCss = `
@namespace "http://www.w3.org/1999/xhtml";

:root {
  hyphens: -epubx-expr(pref-hyphenate? "auto": "manual");
}
:root[data-vivliostyle-epub-spine-properties~="page-spread-left"] {
  break-before: left;
}
:root[data-vivliostyle-epub-spine-properties~="page-spread-right"] {
  break-before: right;
}

@-adapt-footnote-area {
  display: block;
  margin-block-start: 0.5em;
  margin-block-end: 0.5em;
}

@-adapt-footnote-area ::before {
  display: block;
  border-block-start-width: 1px;
  border-block-start-style: solid;
  border-block-start-color: black;
  margin-block-end: 0.4em;
  margin-inline-start: 0;
  margin-inline-end: 60%;
}

/* default page master */
@-epubx-page-master :background-host {
  @-epubx-partition :layout-host {
    -epubx-flow-from: body;
    top: -epubx-expr(header.margin-bottom-edge);
    bottom: -epubx-expr(page-height - footer.margin-top-edge);
    left: 0px;
    right: 0px;
    column-width: 25em;
  }
  @-epubx-partition footer :oeb-page-foot {
    writing-mode: horizontal-tb;
    -epubx-flow-from: oeb-page-foot;
    bottom: 0px;
    left: 0px;
    right: 0px;
  }
  @-epubx-partition header :oeb-page-head {
    writing-mode: horizontal-tb;
    -epubx-flow-from: oeb-page-head;
    top: 0px;
    left: 0px;
    right: 0px;
  }
}

@page {
  @top-left-corner {
    text-align: right;
    vertical-align: middle;
  }
  @top-left {
    text-align: left;
    vertical-align: middle;
  }
  @top-center {
    text-align: center;
    vertical-align: middle;
  }
  @top-right {
    text-align: right;
    vertical-align: middle;
  }
  @top-right-corner {
    text-align: left;
    vertical-align: middle;
  }
  @left-top {
    text-align: center;
    vertical-align: top;
  }
  @left-middle {
    text-align: center;
    vertical-align: middle;
  }
  @left-bottom {
    text-align: center;
    vertical-align: bottom;
  }
  @right-top {
    text-align: center;
    vertical-align: top;
  }
  @right-middle {
    text-align: center;
    vertical-align: middle;
  }
  @right-bottom {
    text-align: center;
    vertical-align: bottom;
  }
  @bottom-left-corner {
    text-align: right;
    vertical-align: middle;
  }
  @bottom-left {
    text-align: left;
    vertical-align: middle;
  }
  @bottom-center {
    text-align: center;
    vertical-align: middle;
  }
  @bottom-right {
    text-align: right;
    vertical-align: middle;
  }
  @bottom-right-corner {
    text-align: left;
    vertical-align: middle;
  }
}

@media print {
  @page {
    margin: 10%;
  }
}
`;

/** user-agent-base.css */
export const UserAgentBaseCss = `
@namespace "http://www.w3.org/1999/xhtml";
@namespace m "http://www.w3.org/1998/Math/MathML";
@namespace epub "http://www.idpf.org/2007/ops";

html,
address,
blockquote,
body,
dd,
div,
dl,
dt,
fieldset,
form,
frame,
frameset,
h1,
h2,
h3,
h4,
h5,
h6,
noframes,
ol,
p,
ul,
center,
dir,
hr,
menu,
pre,
details,
dialog,
legend,
listing,
optgroup,
option,
plaintext,
search,
xmp,
article,
section,
nav,
aside,
hgroup,
footer,
header,
figure,
figcaption,
main {
  display: block;
}
li {
  display: list-item;
}
head {
  display: none !important;
}
table {
  display: table;
}
tr {
  display: table-row;
}
thead {
  display: table-header-group;
  break-after: avoid;
}
tbody {
  display: table-row-group;
}
tfoot {
  display: table-footer-group;
  break-before: avoid;
}
col {
  display: table-column;
}
colgroup {
  display: table-column-group;
}
td,
th {
  display: table-cell;
}
caption {
  display: table-caption;
  text-align: center;
}
th {
  font-weight: bolder;
  text-align: center;
}
*[hidden],
link,
style,
script {
  display: none;
}
h1 {
  font-size: 2em;
  margin-block: 0.67em;
}
h2 {
  font-size: 1.5em;
  margin-block: 0.83em;
}
h3 {
  font-size: 1.17em;
  margin-block: 1em;
}
h4 {
  font-size: 1em;
  margin-block: 1.33em;
}
h5 {
  font-size: 0.83em;
  margin-block: 1.67em;
}
h6 {
  font-size: 0.67em;
  margin-block: 2.33em;
}
h1,
h2,
h3,
h4,
h5,
h6 {
  font-weight: bold;
  break-after: avoid;
}
p,
blockquote,
figure,
ul,
ol,
dl,
dir,
menu {
  margin-block: 1em;
}
b,
strong {
  font-weight: bolder;
}
blockquote,
figure {
  margin-inline: 40px;
}
i,
cite,
dfn,
em,
var,
address {
  font-style: italic;
}
pre,
tt,
code,
kbd,
samp {
  font-family: monospace;
  text-spacing: none;
  hanging-punctuation: none;
}
listing,
plaintext,
xmp,
pre {
  white-space: pre;
}
pre[wrap] {
  white-space: pre-wrap;
}
button,
textarea,
input,
select {
  display: inline-block;
}
big {
  font-size: 1.17em;
}
small,
sub,
sup {
  font-size: 0.83em;
}
sub {
  vertical-align: sub;
}
sup {
  vertical-align: super;
}
table {
  box-sizing: border-box;
  border-spacing: 2px;
  border-collapse: separate;
  text-indent: initial;
}
thead,
tbody,
tfoot,
table > tr {
  vertical-align: middle;
}
tr,
td,
th {
  vertical-align: inherit;
}
s,
strike,
del {
  text-decoration: line-through;
}
hr {
  border-style: inset;
  border-width: 1px;
  margin-block: 0.5em;
}
hr[color],
hr[noshade] {
  border-style: solid;
}
ol,
ul,
dir,
menu {
  padding-inline-start: 40px;
}
dd {
  margin-inline-start: 40px;
}
ol ul,
ul ol,
ul ul,
ol ol {
  margin-block: 0;
}
u,
ins {
  text-decoration: underline;
}
center {
  text-align: center;
}
q::before {
  content: open-quote;
}
q::after {
  content: close-quote;
}

ruby {
  display: ruby;
}
rp {
  display: none;
}
rbc {
  display: ruby-base-container;
}
rtc {
  display: ruby-text-container;
}
rb {
  display: ruby-base;
  white-space: nowrap;
}
rt {
  display: ruby-text;
}
rtc,
rt {
  text-emphasis: none;
  white-space: nowrap;
  line-height: 1;
}
rtc,
rt {
  font-size: 50%;
}
rtc:lang(zh-TW),
rt:lang(zh-TW) {
  font-size: 30%;
}
rtc > rt,
rtc > rt:lang(zh-TW) {
  font-size: 100%;
}

/* Bidi settings */
bdo[dir="ltr"] {
  direction: ltr;
  unicode-bidi: bidi-override;
}
bdo[dir="rtl"] {
  direction: rtl;
  unicode-bidi: bidi-override;
}
*[dir="ltr"] {
  direction: ltr;
  unicode-bidi: isolate;
}
*[dir="rtl"] {
  direction: rtl;
  unicode-bidi: isolate;
}

/* MathML */
m|math[display="block"] {
  display: block;
  display: block math;
}

/*------------------ epub-specific ---------------------*/

a[epub|type="noteref"],
a[epub\\:type="noteref"] {
  font-size: 0.75em;
  vertical-align: super;
  line-height: 0.01;
}

a[epub|type="noteref"]:href-epub-type(footnote, aside),
a[epub\\:type="noteref"]:href-epub-type(footnote, aside) {
  -adapt-template: footnote;
  text-decoration: none;
}

aside[epub|type="footnote"],
aside[epub\\:type="footnote"] {
  display: none;
}

aside[epub|type="footnote"]:footnote-content,
aside[epub\\:type="footnote"]:footnote-content {
  display: block;
  margin: 0.25em;
  font-size: 1.2em;
  line-height: 1.2;
}

epub|trigger {
  display: none;
}

epub|switch {
  display: inline;
}

epub|default {
  display: inline;
}

epub|case {
  display: none;
}

epub|case[required-namespace::supported] {
  display: inline;
}

epub|case[required-namespace::supported] ~ epub|case {
  display: none;
}

epub|case[required-namespace::supported] ~ epub|default {
  display: none;
}
`;

/** user-agent-toc.css */
export const UserAgentTocCss = `
@namespace "http://www.w3.org/1999/xhtml";

*:not([data-vivliostyle-role=doc-toc],
  [data-vivliostyle-role=doc-toc] *,
  :has([data-vivliostyle-role=doc-toc]),
  :is(h1,h2,h3,h4,h5,h6):has(+:not(nav)[data-vivliostyle-role=doc-toc])) {
  display: none;
}

[hidden] {
  display: revert;
}

[data-vivliostyle-role=doc-toc] li a {
  -adapt-behavior: toc-node-anchor;
}

[data-vivliostyle-role=doc-toc] li {
  -adapt-behavior: toc-node;
}

[data-vivliostyle-role=doc-toc] li > :not(ul,ol):first-child {
  -adapt-behavior: toc-node-first-child;
}

[data-vivliostyle-role=doc-toc] :is(ol,ul),
[data-vivliostyle-role=doc-toc]:is(ol,ul) {
  -adapt-behavior: toc-container;
}
`;

/** vivliostyle-polyfill.css */
export const VivliostylePolyfillCss = `
[data-viv-margin-discard~="block-start"] {
  margin-block-start: 0 !important;
}
[data-viv-margin-discard~="block-end"] {
  margin-block-end: 0 !important;
}
[data-viv-margin-discard~="inline-start"] {
  margin-inline-start: 0 !important;
}
[data-viv-margin-discard~="inline-end"] {
  margin-inline-end: 0 !important;
}

[data-viv-box-break~="inline-start"]:not([data-viv-box-break~="clone"]) {
  margin-inline-start: 0 !important;
  padding-inline-start: 0 !important;
  border-inline-start-width: 0 !important;
  border-start-start-radius: 0 !important;
  border-end-start-radius: 0 !important;
}
[data-viv-box-break~="inline-end"]:not([data-viv-box-break~="clone"]) {
  margin-inline-end: 0 !important;
  padding-inline-end: 0 !important;
  border-inline-end-width: 0 !important;
  border-start-end-radius: 0 !important;
  border-end-end-radius: 0 !important;
}
[data-viv-box-break~="block-start"]:not([data-viv-box-break~="clone"]) {
  margin-block-start: 0 !important;
  padding-block-start: 0 !important;
  border-block-start-width: 0 !important;
  border-start-start-radius: 0 !important;
  border-start-end-radius: 0 !important;
}
[data-viv-box-break~="block-end"]:not([data-viv-box-break~="clone"]) {
  margin-block-end: 0 !important;
  padding-block-end: 0 !important;
  border-block-end-width: 0 !important;
  border-end-start-radius: 0 !important;
  border-end-end-radius: 0 !important;
}
[data-viv-box-break~="block-start"][data-viv-box-break~="text-start"] {
  text-indent: 0 !important;
}
[data-viv-box-break~="block-end"][data-viv-box-break~="text-end"][data-viv-box-break~="justify"] {
  text-align-last: justify !important;
}
[data-viv-box-break~="block-end"][data-viv-box-break~="text-end"][data-viv-box-break~="justify"] > * {
  text-align-last: auto;
}
[data-viv-box-break~="block-end"][data-viv-box-break~="text-end"]:not([data-viv-box-break~="justify"]) {
  text-align-last: auto !important;
}

span.viv-anonymous-block {
  display: block;
}

[data-vivliostyle-page-container] {
  text-spacing-trim: space-all;
  text-autospace: no-autospace;
}
viv-ts-open.viv-ts-auto > viv-ts-inner,
viv-ts-open.viv-ts-trim > viv-ts-inner {
  margin-inline-start: -0.5em;
}
viv-ts-close.viv-ts-auto > viv-ts-inner,
viv-ts-close.viv-ts-trim > viv-ts-inner {
  letter-spacing: -0.5em;
}
viv-ts-close.viv-hang-end > viv-ts-inner,
viv-ts-close.viv-hang-last > viv-ts-inner {
  letter-spacing: -1em;
}
viv-ts-open.viv-ts-auto::before,
viv-ts-close.viv-ts-auto::after,
viv-ts-close.viv-hang-end::after {
  content: " ";
  font-family: Courier, monospace;
  word-spacing: normal;
  letter-spacing: -0.11em;
  line-height: 0;
  text-orientation: mixed;
  visibility: hidden;
}
viv-ts-close.viv-hang-end:not(.viv-hang-hw)::after {
  letter-spacing: 0.4em;
}
viv-ts-close.viv-hang-hw > viv-ts-inner {
  letter-spacing: -0.5em;
}
viv-ts-open.viv-hang-first > viv-ts-inner {
  display: inline-block;
  line-height: 1;
  inline-size: 1em;
  text-indent: 0;
  text-align: end;
  text-align-last: end;
  margin-inline-start: -1em;
}
viv-ts-thin-sp::after {
  content: " ";
  font-family: Times, serif;
  word-spacing: normal;
  letter-spacing: -0.125em;
  line-height: 0;
  text-orientation: mixed;
  visibility: hidden;
}
[style*=text-decoration] :is(viv-ts-thin-sp, viv-ts-close.viv-ts-auto)::after {
  visibility: visible;
}

span[data-viv-leader] {
  text-combine-upright: none;
  text-orientation: mixed;
  white-space: pre;
}
`;
