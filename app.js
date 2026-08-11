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

    function initMeasurements() {
        // Create a temporary dummy sheet to measure dimensions for current column count
        const dummySheet = document.createElement('div');
        dummySheet.className = 'a4-sheet';
        dummySheet.style.position = 'absolute';
        dummySheet.style.visibility = 'hidden';
        
        const cols = getColumnCount();
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

    function renderMarkdown() {
        const rawMd = mdInput.value;
        const html = marked.parse(rawMd);
        
        // Apply font size CSS variable to root for consistency
        const fontSize = fontSizeInput.value + 'px';
        document.documentElement.style.setProperty('--doc-font-size', fontSize);

        measuringContainer.innerHTML = `<div class="page-content">${html}</div>`;
        const parsedContent = measuringContainer.querySelector('.page-content');
        
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
        
        for (let i = 0; i < logicalPages.length; i += cols) {
            const sheet = document.createElement('div');
            sheet.className = 'a4-sheet';
            
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
        // A4 Landscape width is 297mm (~1122.5px at 96 DPI)
        const sheetWidthPx = 1122.5;
        
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
    
    printBtn.addEventListener('click', () => {
        window.print();
    });
    
    // Handle window resize
    window.addEventListener('resize', debounce(() => {
        initMeasurements();
        autoFitZoom();
        renderMarkdown();
    }, 300));

    // Initialize
    initMeasurements();
    autoFitZoom();
    renderMarkdown();

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
