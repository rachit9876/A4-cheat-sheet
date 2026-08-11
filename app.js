document.addEventListener('DOMContentLoaded', () => {
    const mdInput = document.getElementById('markdown-input');
    const previewContainer = document.getElementById('preview-container');
    const measuringContainer = document.getElementById('measuring-container');
    const fontSizeInput = document.getElementById('font-size-input');
    const colsInput = document.getElementById('cols-input');
    const pageNumToggle = document.getElementById('page-num-toggle');
    const neatLayoutToggle = document.getElementById('neat-layout-toggle');
    const printBtn = document.getElementById('print-btn');

    let maxPageHeight = 0;

    function getColumnCount() {
        return colsInput ? parseInt(colsInput.value, 10) || 2 : 2;
    }

    function updatePageOrientationStyle(cols) {
        let printStyleTag = document.getElementById('dynamic-print-style');
        if (!printStyleTag) {
            printStyleTag = document.createElement('style');
            printStyleTag.id = 'dynamic-print-style';
            document.head.appendChild(printStyleTag);
        }
        
        if (cols === 1) {
            document.body.classList.add('portrait-orientation');
            printStyleTag.textContent = `
                @media print {
                    @page { size: A4 portrait; margin: 0; }
                }
            `;
        } else {
            document.body.classList.remove('portrait-orientation');
            printStyleTag.textContent = `
                @media print {
                    @page { size: A4 landscape; margin: 0; }
                }
            `;
        }
    }

    function initMeasurements() {
        const cols = getColumnCount();
        // Create a temporary dummy sheet to measure dimensions for current column count
        const dummySheet = document.createElement('div');
        dummySheet.className = 'a4-sheet' + (cols === 1 ? ' portrait' : '');
        dummySheet.style.position = 'absolute';
        dummySheet.style.visibility = 'hidden';
        
        for (let c = 0; c < cols; c++) {
            const dummyPage = document.createElement('div');
            dummyPage.className = 'logical-page';
            
            const dummyContent = document.createElement('div');
            dummyContent.className = 'page-content';
            dummyContent.style.height = '100%';
            
            dummyPage.appendChild(dummyContent);
            dummySheet.appendChild(dummyPage);
        }
        
        document.body.appendChild(dummySheet);
        
        const firstDummyContent = dummySheet.querySelector('.page-content');
        maxPageHeight = firstDummyContent.clientHeight;
        const pageWidth = firstDummyContent.clientWidth;
        
        // Setup measuring container to match column width exactly
        measuringContainer.style.width = pageWidth + 'px';
        
        document.body.removeChild(dummySheet);
    }

    function getAvailablePageHeight() {
        // Reserve a constant footer height so toggling page numbers never shifts text layout
        const pageNumReservation = 16;
        return maxPageHeight - pageNumReservation;
    }

    function splitParagraphNode(pNode, currentPageNodes, availableHeight, tempMeasurer) {
        const words = pNode.innerHTML.split(/(\s+)/);
        if (words.length <= 1) return null;

        const headP = pNode.cloneNode(false);
        const tailP = pNode.cloneNode(false);

        let lastValidHeadHTML = '';
        let splitIndex = -1;

        for (let i = 0; i < words.length; i++) {
            const testHTML = words.slice(0, i + 1).join('');
            headP.innerHTML = testHTML;
            
            const testNodes = [...currentPageNodes, headP];
            const h = measurePageNodesHeight(testNodes, tempMeasurer);
            
            if (h > availableHeight - 3) {
                break;
            }
            if (testHTML.trim().length > 0) {
                lastValidHeadHTML = testHTML;
                splitIndex = i;
            }
        }

        if (splitIndex <= 0 || !lastValidHeadHTML.trim()) {
            return null;
        }

        headP.innerHTML = lastValidHeadHTML;
        tailP.innerHTML = words.slice(splitIndex + 1).join('');

        if (!tailP.innerHTML.trim()) {
            return null;
        }

        return { head: headP, tail: tailP };
    }

    function splitPreNode(preNode, currentPageNodes, availableHeight, tempMeasurer) {
        const codeEl = preNode.querySelector('code');
        const textContent = codeEl ? codeEl.textContent : preNode.textContent;
        const lines = textContent.split('\n');
        
        if (lines.length <= 1) return null;
        
        const headPre = preNode.cloneNode(true);
        const tailPre = preNode.cloneNode(true);
        const headCode = headPre.querySelector('code') || headPre;
        const tailCode = tailPre.querySelector('code') || tailPre;
        
        let lastValidLinesCount = 0;
        
        for (let i = 1; i < lines.length; i++) {
            headCode.textContent = lines.slice(0, i).join('\n');
            
            const testNodes = [...currentPageNodes, headPre];
            const h = measurePageNodesHeight(testNodes, tempMeasurer);
            
            if (h > availableHeight - 3) {
                break;
            }
            lastValidLinesCount = i;
        }
        
        if (lastValidLinesCount === 0) return null;
        
        headCode.textContent = lines.slice(0, lastValidLinesCount).join('\n');
        tailCode.textContent = lines.slice(lastValidLinesCount).join('\n');
        
        return { head: headPre, tail: tailPre };
    }

    function splitBlockquoteNode(bqNode, currentPageNodes, availableHeight, tempMeasurer) {
        const children = Array.from(bqNode.children);
        if (children.length <= 1) {
            return splitParagraphNode(bqNode, currentPageNodes, availableHeight, tempMeasurer);
        }
        
        const headBq = bqNode.cloneNode(false);
        const tailBq = bqNode.cloneNode(false);
        
        let lastValidCount = 0;
        
        for (let i = 1; i <= children.length; i++) {
            headBq.innerHTML = '';
            children.slice(0, i).forEach(child => headBq.appendChild(child.cloneNode(true)));
            
            const testNodes = [...currentPageNodes, headBq];
            const h = measurePageNodesHeight(testNodes, tempMeasurer);
            
            if (h > availableHeight - 3) {
                break;
            }
            lastValidCount = i;
        }
        
        if (lastValidCount === 0) return null;
        
        headBq.innerHTML = '';
        children.slice(0, lastValidCount).forEach(child => headBq.appendChild(child.cloneNode(true)));
        
        tailBq.innerHTML = '';
        children.slice(lastValidCount).forEach(child => tailBq.appendChild(child.cloneNode(true)));
        
        return { head: headBq, tail: tailBq };
    }

    function isHeadingOrLabel(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
        
        const tag = node.tagName;
        if (tag.match(/^H[1-6]$/)) return true;
        if (tag === 'HR') return true;
        
        // Paragraph acting as a sub-heading or label
        if (tag === 'P') {
            const text = node.textContent.trim();
            if (text.endsWith(':')) return true;
            
            const children = Array.from(node.children);
            if (children.length > 0 && children.every(c => c.tagName === 'STRONG' || c.tagName === 'B' || c.tagName === 'EM')) {
                return true;
            }
        }
        
        return false;
    }

    function measurePageNodesHeight(nodesArray, tempMeasurer) {
        tempMeasurer.innerHTML = '';
        const content = document.createElement('div');
        content.className = 'page-content';
        
        nodesArray.forEach(node => {
            const cloned = node.cloneNode(true);
            const lastChild = content.lastElementChild;
            if (lastChild && 
                (cloned.tagName === 'UL' || cloned.tagName === 'OL') && 
                cloned.tagName === lastChild.tagName) {
                Array.from(cloned.children).forEach(li => {
                    lastChild.appendChild(li);
                });
            } else {
                content.appendChild(cloned);
            }
        });
        
        tempMeasurer.appendChild(content);
        return content.clientHeight;
    }

    function preprocessMarkdown(rawMd) {
        if (!rawMd) return '';
        let md = rawMd;

        // 1. Convert KaTeX Math Blocks $$ ... $$
        md = md.replace(/\$\$([\s\S]+?)\$\$/g, (match, mathContent) => {
            if (window.katex) {
                try {
                    return katex.renderToString(mathContent.trim(), { displayMode: true, throwOnError: false });
                } catch (e) { console.error(e); }
            }
            return match;
        });

        // 2. Convert KaTeX Inline Math $ ... $
        md = md.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, (match, prefix, mathContent) => {
            if (window.katex) {
                try {
                    return prefix + katex.renderToString(mathContent.trim(), { displayMode: false, throwOnError: false });
                } catch (e) { console.error(e); }
            }
            return match;
        });

        // 3. Highlight ==text== -> <mark>text</mark>
        md = md.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');

        // 4. Subscript ~text~ -> <sub>text</sub>
        md = md.replace(/~([^~\s\n]+?)~/g, '<sub>$1</sub>');

        // 5. Superscript ^text^ -> <sup>text</sup>
        md = md.replace(/\^([^\^\s\n]+?)\^/g, '<sup>$1</sup>');

        // 6. Emojis
        const emojiMap = {
            ':smile:': '😄', ':rocket:': '🚀', ':heart:': '❤️', ':+1:': '👍',
            ':tada:': '🎉', ':warning:': '⚠️', ':check:': '✅', ':x:': '❌',
            ':star:': '⭐', ':fire:': '🔥', ':bulb:': '💡', ':100:': '💯'
        };
        for (const [key, val] of Object.entries(emojiMap)) {
            md = md.replaceAll(key, val);
        }

        // 7. Footnotes extraction
        const footnotes = [];
        md = md.replace(/^\[\^([^\]]+)\]:\s*(.+)$/gm, (match, id, text) => {
            footnotes.push({ id, text });
            return '';
        });

        // Footnote references [^1]
        md = md.replace(/\[\^([^\]]+)\]/g, (match, id) => {
            return `<sup><a href="#fn-${id}" id="fnref-${id}">[${id}]</a></sup>`;
        });

        // Append Footnotes section if footnotes exist
        if (footnotes.length > 0) {
            md += '\n\n---\n<section class="footnotes"><ol>';
            footnotes.forEach(fn => {
                md += `<li id="fn-${fn.id}">${fn.text} <a href="#fnref-${fn.id}">↩</a></li>`;
            });
            md += '</ol></section>';
        }

        // 8. Abbreviations (*[ABBR]: Full Name)
        const abbrs = {};
        md = md.replace(/^\*\[([^\]]+)\]:\s*(.+)$/gm, (match, abbr, title) => {
            abbrs[abbr] = title;
            return '';
        });

        for (const [abbr, title] of Object.entries(abbrs)) {
            const regex = new RegExp(`\\b${abbr}\\b`, 'g');
            md = md.replace(regex, `<abbr title="${title}">${abbr}</abbr>`);
        }

        return md;
    }

    async function postProcessDOM(parsedContent) {
        // 1. GitHub Alerts (> [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION])
        const blockquotes = Array.from(parsedContent.querySelectorAll('blockquote'));
        blockquotes.forEach(bq => {
            const text = bq.textContent.trim();
            const match = text.match(/^\[\!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
            if (match) {
                const type = match[1].toUpperCase();
                const lowerType = type.toLowerCase();
                const alertDiv = document.createElement('div');
                alertDiv.className = `markdown-alert markdown-alert-${lowerType}`;
                
                let inner = bq.innerHTML.replace(/\[\!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i, '').trim();
                if (inner.startsWith('<p>') && inner.endsWith('</p>')) {
                    inner = inner.substring(3, inner.length - 4).trim();
                }
                
                alertDiv.innerHTML = `<div class="markdown-alert-title">${type}</div><div class="markdown-alert-body">${inner}</div>`;
                bq.parentNode.replaceChild(alertDiv, bq);
            }
        });

        // 2. Definition Lists (: Definition transform)
        const paragraphs = Array.from(parsedContent.querySelectorAll('p'));
        paragraphs.forEach(p => {
            const text = p.textContent.trim();
            if (text.startsWith(': ')) {
                const prev = p.previousElementSibling;
                if (prev) {
                    const dl = document.createElement('dl');
                    const dt = document.createElement('dt');
                    dt.innerHTML = prev.innerHTML;
                    const dd = document.createElement('dd');
                    dd.innerHTML = p.innerHTML.substring(2).trim();
                    dl.appendChild(dt);
                    dl.appendChild(dd);
                    
                    if (prev.parentNode) {
                        prev.parentNode.insertBefore(dl, prev);
                        prev.remove();
                    }
                    p.remove();
                }
            }
        });

        // 3. Highlight.js Syntax Highlighting
        if (window.hljs) {
            parsedContent.querySelectorAll('pre code').forEach(block => {
                if (!block.classList.contains('language-mermaid')) {
                    try { hljs.highlightElement(block); } catch (e) {}
                }
            });
        }

        // 4. Async Mermaid Diagrams Rendering
        if (window.mermaid) {
            try {
                mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
            } catch (e) {}
            
            const mermaidBlocks = Array.from(parsedContent.querySelectorAll('pre code.language-mermaid'));
            for (let i = 0; i < mermaidBlocks.length; i++) {
                const block = mermaidBlocks[i];
                const pre = block.parentElement;
                const code = block.textContent.trim();
                const id = 'mermaid-svg-' + Date.now() + '-' + i;
                try {
                    const { svg } = await mermaid.render(id, code);
                    const container = document.createElement('div');
                    container.className = 'mermaid';
                    container.innerHTML = svg;
                    if (pre && pre.parentNode) {
                        pre.parentNode.replaceChild(container, pre);
                    }
                } catch (err) {
                    console.error('Mermaid render error:', err);
                    const dummy = document.getElementById(id);
                    if (dummy) dummy.remove();
                }
            }
        }
    }

    async function renderMarkdown() {
        const rawMd = mdInput.value;
        const preprocessedMd = preprocessMarkdown(rawMd);
        const html = marked.parse(preprocessedMd);
        
        // Apply font size CSS variable to root for consistency
        const fontSize = fontSizeInput.value + 'px';
        document.documentElement.style.setProperty('--doc-font-size', fontSize);

        measuringContainer.innerHTML = `<div class="page-content">${html}</div>`;
        const parsedContent = measuringContainer.querySelector('.page-content');

        // Apply DOM Post-Processors (Alerts, Definitions, Highlight.js, Mermaid SVG)
        await postProcessDOM(parsedContent);
        
        const rawNodes = Array.from(parsedContent.childNodes);
        const nodes = [];

        // Unpack list items into individual elements so lists split cleanly across pages
        rawNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) {
                return;
            }
            if (node.nodeType === Node.ELEMENT_NODE && (node.tagName === 'UL' || node.tagName === 'OL')) {
                const listItems = Array.from(node.children).filter(child => child.tagName === 'LI');
                if (listItems.length > 0) {
                    listItems.forEach((li, idx) => {
                        const wrapper = document.createElement(node.tagName);
                        if (node.tagName === 'OL') {
                            const startAttr = node.getAttribute('start');
                            const startVal = startAttr ? parseInt(startAttr, 10) : 1;
                            wrapper.setAttribute('start', (startVal + idx).toString());
                        }
                        wrapper.appendChild(li.cloneNode(true));
                        nodes.push(wrapper);
                    });
                    return;
                }
            }
            nodes.push(node);
        });
        
        const logicalPages = [];
        let currentPageNodes = [];
        const availableHeight = getAvailablePageHeight();
        
        // Reset preview container
        previewContainer.innerHTML = '';
        
        const startNewPage = () => {
            if (currentPageNodes.length > 0) {
                logicalPages.push(currentPageNodes);
            }
            currentPageNodes = [];
        };
        
        // Temporary container to measure page nodes
        const tempMeasurer = document.createElement('div');
        tempMeasurer.style.position = 'absolute';
        tempMeasurer.style.visibility = 'hidden';
        tempMeasurer.style.width = measuringContainer.style.width;
        document.body.appendChild(tempMeasurer);

        for (let i = 0; i < nodes.length; i++) {
            let node = nodes[i];
            
            const testNodes = [...currentPageNodes, node];
            const testHeight = measurePageNodesHeight(testNodes, tempMeasurer);
            
            // Check if adding this node exceeds available page height
            if (testHeight > availableHeight - 3 && currentPageNodes.length > 0) {
                let splitResult = null;
                if (node.tagName === 'P') {
                    splitResult = splitParagraphNode(node, currentPageNodes, availableHeight, tempMeasurer);
                } else if (node.tagName === 'PRE') {
                    splitResult = splitPreNode(node, currentPageNodes, availableHeight, tempMeasurer);
                } else if (node.tagName === 'BLOCKQUOTE') {
                    splitResult = splitBlockquoteNode(node, currentPageNodes, availableHeight, tempMeasurer);
                }
                
                if (splitResult && splitResult.head && splitResult.tail) {
                    currentPageNodes.push(splitResult.head);
                    startNewPage();
                    node = splitResult.tail;
                } else {
                    const preventOrphans = neatLayoutToggle ? neatLayoutToggle.checked : true;
                    const trailingHeadings = [];
                    
                    if (preventOrphans) {
                        while (currentPageNodes.length > 0) {
                            const lastNode = currentPageNodes[currentPageNodes.length - 1];
                            if (isHeadingOrLabel(lastNode)) {
                                trailingHeadings.unshift(currentPageNodes.pop());
                            } else {
                                break;
                            }
                        }
                    }
                    
                    // If popping these trailing headings would empty the page completely, put them back
                    if (currentPageNodes.length === 0 && trailingHeadings.length > 0) {
                        while (trailingHeadings.length > 0) {
                            currentPageNodes.push(trailingHeadings.shift());
                        }
                        startNewPage();
                    } else if (trailingHeadings.length > 0) {
                        startNewPage();
                        trailingHeadings.forEach(hNode => {
                            if (hNode.tagName !== 'HR') {
                                currentPageNodes.push(hNode);
                            }
                        });
                    } else {
                        startNewPage();
                    }
                }
            }
            
            currentPageNodes.push(node);
        }
        
        if (currentPageNodes.length > 0) {
            logicalPages.push(currentPageNodes);
        }
        
        document.body.removeChild(tempMeasurer);
        
        // Render into sheets
        renderSheets(logicalPages);
    }
    
    function renderSheets(logicalPages) {
        let pageIndex = 1;
        const showPageNums = pageNumToggle.checked;
        const cols = getColumnCount();
        
        updatePageOrientationStyle(cols);
        
        for (let i = 0; i < logicalPages.length; i += cols) {
            const sheet = document.createElement('div');
            sheet.className = 'a4-sheet' + (cols === 1 ? ' portrait' : '');
            
            for (let c = 0; c < cols; c++) {
                if (i + c < logicalPages.length) {
                    const page = createLogicalPageElement(logicalPages[i + c], pageIndex++, showPageNums);
                    sheet.appendChild(page);
                } else {
                    const emptyPage = document.createElement('div');
                    emptyPage.className = 'logical-page empty-page';
                    sheet.appendChild(emptyPage);
                }
            }
            
            previewContainer.appendChild(sheet);
        }
    }
    
    function createLogicalPageElement(nodes, pageNum, showPageNums) {
        const page = document.createElement('div');
        page.className = 'logical-page';
        
        const content = document.createElement('div');
        content.className = 'page-content';
        
        nodes.forEach(node => {
            const cloned = node.cloneNode(true);
            const lastChild = content.lastElementChild;
            // Merge adjacent UL or OL list wrappers into single lists
            if (lastChild && 
                (cloned.tagName === 'UL' || cloned.tagName === 'OL') && 
                cloned.tagName === lastChild.tagName) {
                Array.from(cloned.children).forEach(li => {
                    lastChild.appendChild(li);
                });
            } else {
                content.appendChild(cloned);
            }
        });
        
        page.appendChild(content);
        
        if (showPageNums) {
            const pageNumEl = document.createElement('div');
            pageNumEl.className = 'page-number';
            pageNumEl.textContent = pageNum;
            page.appendChild(pageNumEl);
        }
        
        return page;
    }

    // Debounce function
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    const debouncedRender = debounce(renderMarkdown, 300);

    // Zoom functionality
    let currentZoom = 1.0;
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomFitBtn = document.getElementById('zoom-fit-btn');
    const zoomLevelText = document.getElementById('zoom-level-text');

    function updateZoomDisplay() {
        previewContainer.style.zoom = currentZoom;
        if (zoomLevelText) {
            zoomLevelText.textContent = Math.round(currentZoom * 100) + '%';
        }
    }

    function autoFitZoom() {
        const previewPane = document.querySelector('.preview-pane');
        if (!previewPane) return;
        // Available width in px (subtract 40px padding)
        const availableWidth = previewPane.clientWidth - 40;
        const cols = getColumnCount();
        // A4 Landscape width is 297mm (~1122.5px); A4 Portrait width is 210mm (~793.7px)
        const sheetWidthPx = cols === 1 ? 793.7 : 1122.5;
        
        if (availableWidth > 0) {
            let fitRatio = availableWidth / sheetWidthPx;
            // Bound fit zoom between 0.35 and 1.0 for optimal view
            currentZoom = Math.min(1.0, Math.max(0.35, fitRatio));
            updateZoomDisplay();
        }
    }

    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            currentZoom = Math.max(0.2, currentZoom - 0.05);
            updateZoomDisplay();
        });
    }

    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            currentZoom = Math.min(2.0, currentZoom + 0.05);
            updateZoomDisplay();
        });
    }

    if (zoomFitBtn) {
        zoomFitBtn.addEventListener('click', () => {
            autoFitZoom();
        });
    }

    // Event Listeners
    mdInput.addEventListener('input', debouncedRender);
    fontSizeInput.addEventListener('input', renderMarkdown);
    fontSizeInput.addEventListener('change', renderMarkdown);
    pageNumToggle.addEventListener('change', renderMarkdown);
    neatLayoutToggle.addEventListener('change', renderMarkdown);
    
    if (colsInput) {
        colsInput.addEventListener('change', () => {
            initMeasurements();
            renderMarkdown();
            autoFitZoom();
        });
    }
    
    const tabEditorBtn = document.getElementById('tab-editor-btn');
    const tabPreviewBtn = document.getElementById('tab-preview-btn');

    if (tabEditorBtn && tabPreviewBtn) {
        tabEditorBtn.addEventListener('click', () => {
            document.body.classList.remove('show-preview-mobile');
            tabEditorBtn.classList.add('active');
            tabPreviewBtn.classList.remove('active');
        });

        tabPreviewBtn.addEventListener('click', () => {
            document.body.classList.add('show-preview-mobile');
            tabPreviewBtn.classList.add('active');
            tabEditorBtn.classList.remove('active');
            autoFitZoom();
        });
    }

    const exitPreviewMobileBtn = document.getElementById('exit-preview-mobile-btn');
    if (exitPreviewMobileBtn) {
        exitPreviewMobileBtn.addEventListener('click', () => {
            document.body.classList.remove('show-preview-mobile');
            if (tabEditorBtn) tabEditorBtn.classList.add('active');
            if (tabPreviewBtn) tabPreviewBtn.classList.remove('active');
        });
    }

    printBtn.addEventListener('click', () => {
        window.print();
    });
    
    // Handle window resize
    window.addEventListener('resize', debounce(() => {
        initMeasurements();
        autoFitZoom();
        renderMarkdown();
    }, 300));

    async function loadDefaultSample() {
        try {
            const response = await fetch('sample.md');
            if (response.ok) {
                const text = await response.text();
                mdInput.value = text;
            }
        } catch (err) {
            console.warn('Could not fetch sample.md:', err);
        }

        // On mobile devices (< 768px), default to Preview mode first
        if (window.innerWidth <= 768) {
            document.body.classList.add('show-preview-mobile');
            if (tabPreviewBtn) tabPreviewBtn.classList.add('active');
            if (tabEditorBtn) tabEditorBtn.classList.remove('active');
        }

        initMeasurements();
        autoFitZoom();
        await renderMarkdown();
    }

    // Initialize
    loadDefaultSample();

    const previewPane = document.querySelector('.preview-pane');
    if (previewPane) {
        previewPane.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const zoomStep = 0.05;
                if (e.deltaY < 0) {
                    currentZoom += zoomStep; // Zoom in
                } else {
                    currentZoom -= zoomStep; // Zoom out
                }
                currentZoom = Math.max(0.2, Math.min(2.0, currentZoom));
                updateZoomDisplay();
            }
        }, { passive: false });
    }
});
