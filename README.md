# 2-in-1 Markdown A4 PDF Generator (A4 Cheat Sheet Generator)

> **A high-density, web-based Markdown editor and pagination engine designed to transform raw Markdown into perfectly formatted, multi-column A4 printable cheat sheets and PDFs.**

---

## 🎯 Executive Summary & Purpose

The **2-in-1 A4 Markdown PDF Generator** is a pure client-side web application built for students, developers, engineers, and researchers who need to generate compact, highly organized cheat sheets, revision notes, and reference guides. 

Standard Markdown parsers and print tools suffer from awkward page breaks, orphaned headings, ugly overflow, and rigid single-column layouts. This project solves those problems by implementing a custom **DOM-based virtual pagination and height measurement engine** that automatically splits content across physical A4 sheets in real time.

Whether you want a traditional **1-column portrait document**, a compact **2-in-1 landscape cheat sheet**, or an ultra-dense **3-in-1 layout**, this application handles paragraph splitting, code block line wrapping, list item unpacking, LaTeX math, diagrams, syntax highlighting, and orphan heading prevention automatically.

---

## 🔥 Key Features

### 1. Multi-Column Layout Modes
- **1 Column (1-in-1)**: Standard A4 Portrait sheet (210mm x 297mm).
- **2 Columns (2-in-1)**: A4 Landscape sheet (297mm x 210mm) divided into two logical portrait column pages. Perfect for exam cheat sheets.
- **3 Columns (3-in-1)**: A4 Landscape sheet divided into three high-density logical columns for maximum information packing.

### 2. Intelligent Real-Time Pagination & Node Splitting Engine
- **Pixel-Perfect Heights**: Uses a hidden DOM measuring container (`#measuring-container`) to dynamically calculate column heights before rendering into A4 sheets.
- **Paragraph Word-Splitting**: Breaks paragraphs at precise word boundaries when they cross column/page limits.
- **Code Block Line-Splitting**: Splits `<pre><code>` blocks line-by-line across column boundaries without cutting code in half.
- **List Item Unpacking**: Unpacks unordered (`<ul>`) and ordered (`<ol>`) lists into individual items so long lists flow seamlessly across page columns while preserving list numbering.
- **Blockquote Splitting**: Intelligently breaks blockquotes into upper and lower halves.

### 3. "Neat Layout" & Orphan Heading Prevention
- Toggleable **Neat Layout** feature automatically detects section headers (`<h1>`–`<h6>`, `<hr>`, or key-value label lines ending with `:`) at the very bottom of a column page.
- If a heading is left without sufficient content below it, the engine automatically pushes the heading to the top of the next column page, preventing awkward orphan titles.

### 4. Rich Markdown & Scientific Content Support
- **LaTeX Math (KaTeX)**: Full inline (`$E=mc^2$`) and block (`$$\sum_{i=1}^n i$$`) rendering.
- **Diagrams & Flowcharts (Mermaid.js)**: Renders code blocks tagged `mermaid` into sharp SVG diagrams.
- **Syntax Highlighting (Highlight.js)**: Code highlighting styled for clean black-and-white or color printing (GitHub style).
- **GitHub-Style Callout Alerts**: Supports `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, and `> [!CAUTION]`.
- **Extended Markdown Syntax**:
  - Highlights: `==highlighted text==`
  - Subscripts & Superscripts: `~subscript~` and `^superscript^`
  - Emojis: `:smile:`, `:rocket:`, `:star:`, `:check:`, `:fire:`, `:bulb:`, etc.
  - Footnotes: `[^1]` with automatic bottom reference rendering.
  - Definition Lists: `: definition` format.
  - Abbreviations: `*[ABBR]: Full Title`.

### 5. Interactive Zoom & Preview Controls
- **Flexible Font Sizing**: Fine-tune font sizes from **6px to 16px** (in 0.5px increments) with instant re-pagination.
- **Zoom Controls**: Zoom In (`+`), Zoom Out (`-`), and Auto-Fit Page (`Fit Page`), as well as `Ctrl` + Mouse Wheel zooming.
- **Page Numbering**: Toggleable page number footers on each column page with reserved height to maintain stable text alignment.
- **Mobile-Responsive Dual-Pane UI**: Split view for desktop; tabbed switching (Editor vs Preview) for mobile devices.

### 6. One-Click PDF Export / Print
- Integrated **Print / Save PDF** trigger invoking `window.print()`.
- Custom `@media print` rules hide editor toolbars, reset margins, and configure native `@page { size: A4 landscape; margin: 0; }` or `@page { size: A4 portrait; margin: 0; }` for seamless PDF exports.

---

## 🛠️ Technology Stack & Architecture

| Layer | Technology / Library | Purpose |
| --- | --- | --- |
| **Structure** | HTML5 | Application shell, controls toolbar, dual-pane flex containers |
| **Styling** | Vanilla CSS3 | Modular CSS variables, flexbox/grid layout, A4 paper simulation, print media queries |
| **Logic Engine** | Vanilla JavaScript (ES6+) | Preprocessing, DOM measurement, node splitting, dynamic sheet rendering |
| **Markdown Parser** | [Marked.js](https://marked.js.org/) | High-performance Markdown to HTML conversion |
| **Math Renderer** | [KaTeX](https://katex.org/) | Fast LaTeX math parsing and HTML/SVG rendering |
| **Diagram Engine** | [Mermaid.js](https://mermaid.js.org/) | Flowcharts, sequence diagrams, and architecture visualizations |
| **Code Highlighting** | [Highlight.js](https://highlightjs.org/) | Code block syntax highlighting |

---

## 📁 Codebase Directory Structure

```
clever-borg/
├── index.html       # Main application layout, toolbar controls, CDN dependencies
├── app.js           # Engine core: preprocessor, layout measurement, pagination & print logic
├── style.css        # Responsive styling system, A4 screen simulation & @media print styles
├── sample.md        # Comprehensive default study guide sample (demonstrating tables, math & notes)
└── PROJECT_DESCRIPTION.md # Detailed technical and functional project description
```

---

## 💡 How It Works Under the Hood

1. **Input & Debounce**: When the user edits text in `#markdown-input` or adjusts controls (Font Size, Columns, Neat Layout toggle), the `debouncedRender()` function triggers.
2. **Preprocessing**: `preprocessMarkdown()` scans for custom syntax like KaTeX math (`$...$`, `$$...$$`), highlights (`==...==`), subscripts, superscripts, footnotes, and abbreviations before passing to `marked.parse()`.
3. **DOM Post-Processing**: `postProcessDOM()` converts GitHub alert blockquotes into styled callouts, processes definition lists, highlights code snippets using `hljs`, and asynchronously renders `mermaid` SVG diagrams.
4. **List Unpacking**: Lists are unpacked into individual items to enable mid-list column splits while preserving numerical sequences.
5. **DOM Height Measurement & Node Splitting**:
   - Nodes are tested against `getAvailablePageHeight()` inside an off-screen container.
   - If a node overflows, `splitParagraphNode()`, `splitPreNode()`, or `splitBlockquoteNode()` breaks the element down to the exact line or word that fits.
   - `preventOrphans` checks if trailing nodes on a page are isolated headings, carrying them over to the next page if needed.
6. **Sheet Assembly**: Logical column pages are grouped into physical `div.a4-sheet` containers according to the selected column count (1, 2, or 3) and rendered into the preview container.

---

## 🚀 How to Run the Project

1. **No Build Step Required**: This is a pure static web app.
2. **Open in Browser**: Simply double-click `index.html` or open it with any web browser (Chrome, Edge, Firefox, Safari).
3. **Local Server (Optional)**: Run a local static server if desired:
   ```bash
   npx serve .
   ```
4. **Exporting to PDF**:
   - Click **Print / Save PDF** (or press `Ctrl+P`).
   - Select **Save as PDF** in the browser print dialog.
   - Ensure background graphics are enabled and margins are set to **None / Default**.

---

## 🎓 Typical Use Cases

- **Student Exam Cheat Sheets**: Create dense 2-in-1 or 3-in-1 formula sheets and revision summaries.
- **Developer Quick Reference Sheets**: Printable cheat sheets for CLI commands, API endpoints, or language syntaxes.
- **Meeting & Project Notes**: Compact printed summaries for presentations or review sessions.
- **LaTeX Math Handouts**: Print-ready assignments and formula reference cards.
