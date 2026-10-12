(() => {
  const app = document.getElementById('app');
  const canvas = document.getElementById('canvas');
  const graphWorld = document.getElementById('graph-world');
  const graphScene = document.getElementById('graph-scene');
  const nodeLayer = document.getElementById('node-layer');
  const edgeLayer = document.getElementById('edge-layer');
  const connections = document.getElementById('connections');
  const emptyState = document.getElementById('empty-state');
  const viewConfig = {
    flow: { title: '画面フロー', kinds: ['screen'], edgeKinds: new Set(['navigates']) },
    concept: { title: 'Concept map', kinds: ['concept'], edgeKinds: null },
    erd: { title: 'Data model', kinds: ['table'], edgeKinds: new Set(['references']) }
  };
  let graph;
  let layouts;
  let currentView = 'flow';
  let currentScreenId = null;
  let previewMode = 'screenshot';
  let visibleNodes = [];
  let visibleEdges = [];
  let selectedId = null;
  let drag = null;
  let hoveredNodeId = null;
  let focusedNodeId = null;
  let zoomScale = 1;
  let gestureStartScale = 1;
  let gestureActive = false;
  let dagreLayout = null;
  let layoutOffsetX = 0;
  let graphMarginX = 0;
  let graphMarginY = 0;
  let stageSize = { width: 0, height: 640 };
  let saveTimer;
  let saveQueue = Promise.resolve();
  let lightboxOpener = null;
  const selectedPreviewByScreen = new Map();

  const byId = id => graph.nodes.find(node => node.id === id);
  const elementById = id => Array.from(nodeLayer.children).find(element => element.dataset.nodeId === id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function updateZoomControls() {
    const zoom = window.DesignMapZoom;
    const percent = Math.round(zoomScale * 100);
    document.getElementById('zoom-level').textContent = `${percent}%`;
    document.getElementById('zoom-out').disabled = Boolean(zoom && zoomScale <= zoom.MIN_SCALE);
    document.getElementById('zoom-in').disabled = Boolean(zoom && zoomScale >= zoom.MAX_SCALE);
  }

  function updateGraphDimensions() {
    graphMarginX = Math.max(0, canvas.clientWidth / 2);
    graphMarginY = Math.max(0, (Number(window.innerHeight) || canvas.clientHeight || 640) / 2);
    graphScene.style.left = `${graphMarginX}px`;
    graphScene.style.top = `${graphMarginY}px`;
    graphWorld.style.width = `${stageSize.width * zoomScale + graphMarginX * 2}px`;
    graphWorld.style.height = `${stageSize.height * zoomScale + graphMarginY * 2}px`;
    graphScene.style.setProperty('--graph-scale', String(zoomScale));
    canvas.style.minHeight = `${Math.max(640, stageSize.height * zoomScale + graphMarginY * 2)}px`;
  }

  function setZoomAt(nextScale, clientX, clientY) {
    const zoom = window.DesignMapZoom;
    if (!zoom) throw new Error('Zoom controls are unavailable; check that zoom.js loaded before app.js.');
    if (canvas.hidden || currentView === 'preview') return;
    const next = zoom.clampScale(nextScale);
    if (Math.abs(next - zoomScale) < 0.001) return;

    const rect = canvas.getBoundingClientRect();
    const pointerX = clientX - rect.left - canvas.clientLeft;
    const pointerY = clientY - rect.top - canvas.clientTop;
    const oldScale = zoomScale;
    const anchorY = (canvas.scrollTop + pointerY - graphMarginY) / oldScale;
    const nextMarginX = Math.max(0, canvas.clientWidth / 2);
    const nextMarginY = Math.max(0, (Number(window.innerHeight) || canvas.clientHeight || 640) / 2);
    const nextScrollLeft = zoom.anchoredScroll(canvas.scrollLeft, pointerX, oldScale, next, graphMarginX, nextMarginX);
    const nextScrollTop = zoom.anchoredScroll(canvas.scrollTop, pointerY, oldScale, next, graphMarginY, nextMarginY);
    zoomScale = next;
    updateZoomControls();
    updateGraphDimensions();
    canvas.scrollLeft = nextScrollLeft;
    canvas.scrollTop = nextScrollTop;
    if (typeof window.scrollBy === 'function') {
      const after = canvas.getBoundingClientRect();
      const pointY = after.top + canvas.clientTop + graphMarginY + anchorY * next - canvas.scrollTop;
      window.scrollBy(0, pointY - clientY);
    }
  }

  function zoomAtViewportCenter(nextScale) {
    const rect = canvas.getBoundingClientRect();
    const x = clamp(window.innerWidth / 2, rect.left + canvas.clientLeft, rect.right);
    const y = clamp(window.innerHeight / 2, rect.top + canvas.clientTop, rect.bottom);
    setZoomAt(nextScale, x, y);
  }

  function sourceLabel(node) {
    if (!node?.source?.file) return '—';
    return `${node.source.file}${node.source.line ? `:${node.source.line}` : ''}`;
  }

  function confidenceLabel(item) {
    const score = Math.round(Number(item.confidence || 0) * 100);
    return `${item.origin || 'unknown'} · ${score}%`;
  }

  function previewChoices(node) {
    const choices = [];
    if (node.image) choices.push({ key: 'image', label: 'Screen image', image: node.image, captureSource: null, timestamp: null, storyUrl: null });
    (node.previews || []).forEach((preview, index) => choices.push({
      key: `story:${preview.storyId || index}`,
      label: preview.label,
      image: preview.image,
      captureSource: preview.captureSource,
      timestamp: preview.timestamp,
      storyUrl: preview.storyUrl,
      storyId: preview.storyId
    }));
    return choices;
  }

  function selectedPreview(node) {
    const choices = previewChoices(node);
    const selected = selectedPreviewByScreen.get(node.id) || sessionStorage.getItem(`design-map-state:${node.id}`);
    return choices.find(choice => choice.key === selected) || choices[0] || null;
  }

  function imageUrl(path) {
    return `../${path.split('/').map(encodeURIComponent).join('/')}`;
  }

  function safeStoryUrl(value) {
    if (typeof value !== 'string' || !value) return null;
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null;
    } catch {
      return null;
    }
  }

  function storybookEmbedUrl(choice) {
    const source = safeStoryUrl(choice?.storyUrl);
    if (!source || !choice?.storyId) return null;
    const hostname = source.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) return null;
    const directory = source.pathname.endsWith('/') ? source.pathname : source.pathname.slice(0, source.pathname.lastIndexOf('/') + 1);
    const iframe = new URL(`${directory}iframe.html`, source.origin);
    iframe.searchParams.set('id', choice.storyId);
    iframe.searchParams.set('viewMode', 'story');
    return iframe.href;
  }

  function setStatus(message, error = false) {
    const element = document.getElementById('save-status');
    document.getElementById('save-status-text').textContent = message;
    document.getElementById('retry-save').hidden = !error;
    element.style.color = error ? 'var(--orange)' : '';
    element.classList.add('visible');
    clearTimeout(saveTimer);
    if (!error) saveTimer = setTimeout(() => element.classList.remove('visible'), 1800);
  }

  function openPreview(imageSrc, alt, caption, opener) {
    if (!imageSrc) return;
    const dialog = document.getElementById('preview-lightbox');
    document.getElementById('preview-lightbox-image').src = imageSrc;
    document.getElementById('preview-lightbox-image').alt = alt || 'Screen preview';
    document.getElementById('preview-lightbox-caption').textContent = caption || alt || '';
    lightboxOpener = opener instanceof HTMLElement ? opener : null;
    if (!dialog.open) dialog.showModal();
    document.getElementById('preview-lightbox-close').focus();
  }

  function bindScreenPreview(element, node) {
    const button = element.querySelector('[data-open-preview]');
    if (!button) return;
    button.querySelector('img').addEventListener('error', () => {
      button.disabled = true;
      button.setAttribute('aria-label', '画像を読み込めません');
      const missing = document.createElement('div');
      missing.className = 'screen-no-preview';
      missing.textContent = '画像を読み込めません';
      button.replaceChildren(missing);
    });
    button.addEventListener('pointerdown', event => event.stopPropagation());
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const choice = selectedPreview(node);
      if (!choice?.image) return;
      openPreview(imageUrl(choice.image), `${node.label} · ${choice.label}`, `${node.label} · ${choice.label}`, button);
    });
  }

  function nodeMarkup(node) {
    const route = node.route || '';
    if (node.kind === 'screen') {
      const choice = selectedPreview(node);
      const preview = choice?.image
        ? `<button class="screen-preview-button" type="button" data-open-preview aria-haspopup="dialog" aria-label="画像を拡大: ${escapeHtml(node.label)} · ${escapeHtml(choice.label)}"><img src="${escapeHtml(imageUrl(choice.image))}" alt=""></button>`
        : '<div class="screen-no-preview">プレビュー未登録</div>';
      return `<div class="screen-preview">${preview}</div><div class="screen-state">${escapeHtml(choice?.label || 'プレビュー未登録')}</div><div class="node-head screen-node-head"><strong>${escapeHtml(node.label)}</strong><small>${escapeHtml(route || 'route unavailable')}</small></div>`;
    }
    if (node.kind === 'table') {
      const fields = (node.fields || []).slice(0, 6).map(field => `<div class="field"><span class="key">${field.primary ? '◆' : field.foreign ? '↗' : '·'}</span><strong>${escapeHtml(field.name)}</strong><code>${escapeHtml(field.type || '')}</code></div>`).join('');
      return `<div class="node-head"><span>▤</span><span>${escapeHtml(node.label)}</span></div>${fields || '<div class="field"><span>·</span><strong>Fields unavailable</strong></div>'}`;
    }
    return `<div class="node-head"><span>${escapeHtml(node.label)}</span><small>${escapeHtml(node.origin || '')}</small></div>`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function applyPositions() {
    if (!window.DesignMapLayout?.layoutGraph) {
      throw new Error('Dagre automatic layout is unavailable; check that dagre.min.js and layout.js loaded before app.js.');
    }
    const measuredNodes = visibleNodes.map(node => {
      const element = elementById(node.id);
      if (!element?.offsetWidth || !element.offsetHeight) {
        throw new Error(`Dagre could not measure visible node ${node.id}.`);
      }
      return { id: node.id, width: element.offsetWidth, height: element.offsetHeight };
    });
    const measureCanvas = document.createElement('canvas');
    const measureContext = measureCanvas.getContext('2d');
    if (measureContext) measureContext.font = `10px ${getComputedStyle(document.body).fontFamily}`;
    const measuredEdges = visibleEdges.map(edge => {
      const label = edge.label || edge.kind.replaceAll('_', ' ');
      const textWidth = measureContext ? measureContext.measureText(label).width : Array.from(label).length * 6;
      return { ...edge, layoutLabelWidth: textWidth + 10, layoutLabelHeight: 14 };
    });
    dagreLayout = window.DesignMapLayout.layoutGraph(measuredNodes, measuredEdges);
    stageSize = {
      width: Math.max(dagreLayout.width, canvas.clientWidth),
      height: Math.max(640, dagreLayout.height)
    };
    layoutOffsetX = Math.max(0, (stageSize.width - dagreLayout.width) / 2);
    canvas.style.setProperty('--graph-width', `${stageSize.width}px`);
    canvas.style.setProperty('--graph-height', `${stageSize.height}px`);
    updateGraphDimensions();
    const saved = layouts.views[currentView] || {};
    Array.from(nodeLayer.children).forEach(element => {
      const position = saved[element.dataset.nodeId];
      const maxLeft = Math.max(8, stageSize.width - element.offsetWidth - 8);
      const maxTop = Math.max(8, stageSize.height - element.offsetHeight - 8);
      if (position?.pinned) {
        element.style.left = `${clamp(position.x, 0, 1) * maxLeft}px`;
        element.style.top = `${clamp(position.y, 0, 1) * maxTop}px`;
        element.classList.add('pinned');
      } else {
        const automatic = dagreLayout.positions[element.dataset.nodeId];
        element.style.left = `${clamp(automatic.left + layoutOffsetX, 8, maxLeft)}px`;
        element.style.top = `${clamp(automatic.top, 8, maxTop)}px`;
        element.classList.remove('pinned');
      }
    });
    requestAnimationFrame(drawEdges);
  }

  function endpoints(from, to, area) {
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const ac = { x: (a.left - area.left + a.width / 2) / zoomScale, y: (a.top - area.top + a.height / 2) / zoomScale };
    const bc = { x: (b.left - area.left + b.width / 2) / zoomScale, y: (b.top - area.top + b.height / 2) / zoomScale };
    const dx = bc.x - ac.x;
    const dy = bc.y - ac.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { sx: (dx >= 0 ? a.right - area.left : a.left - area.left) / zoomScale, sy: ac.y, ex: (dx >= 0 ? b.left - area.left : b.right - area.left) / zoomScale, ey: bc.y, axis: 'x', sign: dx >= 0 ? 1 : -1 };
    }
    return { sx: ac.x, sy: (dy >= 0 ? a.bottom - area.top : a.top - area.top) / zoomScale, ex: bc.x, ey: (dy >= 0 ? b.top - area.top : b.bottom - area.top) / zoomScale, axis: 'y', sign: dy >= 0 ? 1 : -1 };
  }

  function drawEdges() {
    const area = connections.getBoundingClientRect();
    connections.setAttribute('viewBox', `0 0 ${stageSize.width} ${stageSize.height}`);
    edgeLayer.replaceChildren();
    visibleEdges.forEach((edge, index) => {
      const from = elementById(edge.from);
      const to = elementById(edge.to);
      if (!from || !to) return;
      const saved = layouts.views[currentView] || {};
      const isManual = saved[edge.from]?.pinned || saved[edge.to]?.pinned || from.classList.contains('dragging') || to.classList.contains('dragging');
      const route = dagreLayout?.routes[edge.id];
      const useDagreRoute = !isManual && route?.points?.length >= 2;
      let pathData;
      let labelPoint;
      if (useDagreRoute) {
        const [first, ...rest] = route.points;
        pathData = `M ${first.x + layoutOffsetX} ${first.y} ${rest.map(point => `L ${point.x + layoutOffsetX} ${point.y}`).join(' ')}`;
        labelPoint = Number.isFinite(route.x) && Number.isFinite(route.y)
          ? { x: route.x + layoutOffsetX, y: route.y }
          : { x: route.points[Math.floor(route.points.length / 2)].x + layoutOffsetX, y: route.points[Math.floor(route.points.length / 2)].y };
      } else {
        const point = endpoints(from, to, area);
        const distance = point.axis === 'x' ? Math.abs(point.ex - point.sx) : Math.abs(point.ey - point.sy);
        const bend = Math.max(38, distance * .46);
        pathData = point.axis === 'x'
          ? `M ${point.sx} ${point.sy} C ${point.sx + bend * point.sign} ${point.sy}, ${point.ex - bend * point.sign} ${point.ey}, ${point.ex} ${point.ey}`
          : `M ${point.sx} ${point.sy} C ${point.sx} ${point.sy + bend * point.sign}, ${point.ex} ${point.ey - bend * point.sign}, ${point.ex} ${point.ey}`;
        labelPoint = { x: (point.sx + point.ex) / 2, y: (point.sy + point.ey) / 2 };
      }
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      path.setAttribute('marker-end', 'url(#arrow)');
      path.setAttribute('class', `edge ${edge.origin === 'inferred' ? 'inferred' : ''} ${currentView === 'erd' ? 'data' : index === 0 ? 'accent' : ''}`);
      path.dataset.from = edge.from;
      path.dataset.to = edge.to;
      edgeLayer.append(path);
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', String(labelPoint.x));
      label.setAttribute('y', String(labelPoint.y - 8));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'edge-label');
      label.dataset.from = edge.from;
      label.dataset.to = edge.to;
      label.textContent = edge.label || edge.kind.replaceAll('_', ' ');
      edgeLayer.append(label);
    });
    refreshEdgeHighlights();
  }

  function refreshEdgeHighlights() {
    const activeNodeId = hoveredNodeId || focusedNodeId;
    edgeLayer.querySelectorAll('[data-from][data-to]').forEach(element => {
      const outgoing = activeNodeId && element.dataset.from === activeNodeId;
      const incoming = activeNodeId && element.dataset.to === activeNodeId;
      element.classList.toggle('edge-connected-outgoing', Boolean(outgoing));
      element.classList.toggle('edge-connected-incoming', Boolean(incoming && !outgoing));
      element.classList.toggle('edge-unrelated', Boolean(activeNodeId && !outgoing && !incoming));
    });
  }

  function renderScreenPreview(node) {
    const panel = document.getElementById('screen-preview-panel');
    panel.hidden = node.kind !== 'screen';
    if (node.kind !== 'screen') return;
    const choices = previewChoices(node);
    const select = document.getElementById('inspector-preview-state');
    select.replaceChildren();
    choices.forEach(choice => {
      const option = document.createElement('option');
      option.value = choice.key;
      option.textContent = choice.label;
      select.append(option);
    });
    const choice = selectedPreview(node);
    select.disabled = choices.length < 2;
    if (choice) {
      selectedPreviewByScreen.set(node.id, choice.key);
      select.value = choice.key;
    }
    const image = document.getElementById('inspector-preview-image');
    const imageLink = document.getElementById('inspector-preview-link');
    const empty = document.getElementById('inspector-preview-empty');
    const caption = document.getElementById('inspector-preview-caption');
    const storyLink = document.getElementById('inspector-storybook-link');
    image.hidden = !choice?.image;
    imageLink.hidden = !choice?.image;
    empty.hidden = Boolean(choice?.image);
    if (choice?.image) {
      image.src = imageUrl(choice.image);
      image.alt = `${node.label} · ${choice.label}`;
    } else {
      image.removeAttribute('src');
      image.alt = '';
    }
    if (choice?.captureSource === 'storybook') {
      const date = choice.timestamp ? new Date(choice.timestamp) : null;
      const timestamp = date && !Number.isNaN(date.valueOf()) ? date.toLocaleString() : choice.timestamp || 'time unavailable';
      caption.textContent = `Storybook · captured ${timestamp}. Point-in-time image.`;
    } else if (choice) {
      caption.textContent = 'Screen image · capture source not recorded.';
    } else {
      caption.textContent = '';
    }
    const safeStory = choice?.captureSource === 'storybook' ? safeStoryUrl(choice.storyUrl) : null;
    storyLink.hidden = !safeStory;
    if (!storyLink.hidden) storyLink.href = safeStory.href;
    const element = elementById(node.id);
    if (element) {
      element.innerHTML = nodeMarkup(node);
      bindScreenPreview(element, node);
    }
  }

  function screenOptions() {
    return graph.nodes.filter(node => node.kind === 'screen').sort((left, right) => {
      const leftRoute = left.route || left.label;
      const rightRoute = right.route || right.label;
      return leftRoute.localeCompare(rightRoute);
    });
  }

  function preferredScreen(screens) {
    const withPreview = screens.filter(node => previewChoices(node).some(choice => choice.image));
    return withPreview.find(node => /veto/i.test(`${node.label} ${node.route || ''}`)) || withPreview[0] || screens[0] || null;
  }

  function renderScreenWorkspace() {
    const screens = screenOptions();
    const screenSelect = document.getElementById('preview-screen-select');
    const stateSelect = document.getElementById('preview-state-select');
    const screenStage = document.getElementById('screen-stage');
    screenSelect.replaceChildren();
    screens.forEach(node => {
      const choices = previewChoices(node);
      const option = document.createElement('option');
      option.value = node.id;
      option.textContent = `${node.route || 'route unavailable'} · ${node.label} · ${choices.length ? `${choices.length} preview${choices.length === 1 ? '' : 's'}` : 'preview not registered'}`;
      screenSelect.append(option);
    });

    let node = screens.find(candidate => candidate.id === currentScreenId);
    if (!node) {
      const remembered = sessionStorage.getItem('design-map-screen');
      node = screens.find(candidate => candidate.id === remembered) || preferredScreen(screens);
      currentScreenId = node?.id || null;
    }
    screenSelect.disabled = !node;
    if (!node) {
      screenStage.hidden = true;
      document.getElementById('screen-preview-empty').textContent = 'No screen nodes are available in this map.';
      document.getElementById('screen-preview-empty').hidden = false;
      document.getElementById('dependency-panel').hidden = false;
      document.getElementById('dependency-screen-title').textContent = 'No screen selected';
      const tree = document.getElementById('dependency-tree');
      tree.replaceChildren();
      const empty = document.createElement('div');
      empty.className = 'dependency-empty';
      empty.textContent = 'No screen dependencies are available.';
      tree.append(empty);
      return;
    }

    screenStage.hidden = false;
    screenSelect.value = node.id;
    sessionStorage.setItem('design-map-screen', node.id);
    selectedId = node.id;
    const choices = previewChoices(node);
    stateSelect.replaceChildren();
    if (choices.length) {
      choices.forEach(choice => {
        const option = document.createElement('option');
        option.value = choice.key;
        option.textContent = choice.label;
        stateSelect.append(option);
      });
    } else {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'プレビュー未登録';
      stateSelect.append(option);
    }
    const choice = selectedPreview(node);
    stateSelect.disabled = choices.length < 2;
    if (choice) {
      selectedPreviewByScreen.set(node.id, choice.key);
      stateSelect.value = choice.key;
    }
    if (!choice?.storyUrl || choice.captureSource !== 'storybook') previewMode = 'screenshot';
    const image = document.getElementById('screen-image');
    const imageLink = document.getElementById('screen-image-link');
    const empty = document.getElementById('screen-preview-empty');
    const caption = document.getElementById('screen-preview-caption');
    image.hidden = !choice?.image;
    imageLink.hidden = !choice?.image;
    empty.hidden = Boolean(choice?.image);
    if (choice?.image) {
      image.src = imageUrl(choice.image);
      image.alt = `${node.label} · ${choice.label}`;
    } else {
      image.removeAttribute('src');
      image.alt = '';
      empty.textContent = 'この画面のプレビューは未登録';
    }
    if (choice?.captureSource === 'storybook') {
      const date = choice.timestamp ? new Date(choice.timestamp) : null;
      const timestamp = date && !Number.isNaN(date.valueOf()) ? date.toLocaleString() : choice.timestamp || 'time unavailable';
      caption.textContent = `Storybook · captured ${timestamp}. Point-in-time image.`;
    } else if (choice) {
      caption.textContent = 'Screen image · capture source not recorded.';
    } else {
      caption.textContent = '';
    }

    const hasStory = Boolean(choice?.captureSource === 'storybook' && safeStoryUrl(choice.storyUrl));
    const storyButton = document.querySelector('[data-preview-mode="storybook"]');
    storyButton.disabled = !hasStory;
    document.querySelectorAll('[data-preview-mode]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.previewMode === previewMode));
    });
    const screenshot = document.getElementById('screen-screenshot');
    const live = document.getElementById('screen-live');
    const frame = document.getElementById('screen-storybook-frame');
    const fallback = document.getElementById('screen-live-fallback');
    const storyLink = document.getElementById('screen-storybook-link');
    screenshot.hidden = previewMode !== 'screenshot';
    live.hidden = previewMode !== 'storybook';
    screenStage.classList.toggle('screenshot-mode', previewMode === 'screenshot');
    screenStage.classList.toggle('storybook-mode', previewMode === 'storybook');
    frame.hidden = true;
    fallback.hidden = true;
    storyLink.hidden = true;
    frame.removeAttribute('src');
    const safeStory = choice?.captureSource === 'storybook' ? safeStoryUrl(choice.storyUrl) : null;
    if (previewMode === 'storybook') {
      if (safeStory) {
        storyLink.href = safeStory.href;
        storyLink.hidden = false;
        const embedUrl = storybookEmbedUrl(choice);
        if (embedUrl) {
          frame.title = `${node.label} · ${choice.label} · Storybook screen preview`;
          frame.src = embedUrl;
          frame.hidden = false;
        } else {
          fallback.textContent = 'このStorybookは埋め込めません。別タブで開くか、スクショを表示してください。';
          fallback.hidden = false;
        }
      } else {
        fallback.textContent = 'この状態にStorybookのリンクはありません。スクショを表示してください。';
        fallback.hidden = false;
      }
    }
    document.getElementById('dependency-panel').hidden = false;
    document.getElementById('dependency-screen-title').textContent = `${node.route || 'route unavailable'} · ${node.label}`;
    renderDependencies(node);
  }

  function dependencyName(node) {
    if (!node) return 'Unknown target';
    return node.kind === 'file' ? (node.path || node.label) : node.label;
  }

  function appendDependencyRow(container, relation, detail, depth) {
    const row = document.createElement('div');
    row.className = 'dependency-row';
    row.style.paddingInlineStart = `${7 + depth * 13}px`;
    const label = document.createElement('strong');
    label.textContent = relation;
    row.append(label, document.createTextNode(` · ${detail}`));
    container.append(row);
  }

  function renderDependencies(node) {
    const panel = document.getElementById('dependency-panel');
    panel.hidden = node.kind !== 'screen';
    if (node.kind !== 'screen') return;
    document.getElementById('dependency-screen-title').textContent = `${node.route || 'route unavailable'} · ${node.label}`;
    document.getElementById('dependency-source-path').textContent = sourceLabel(node);
    const tree = document.getElementById('dependency-tree');
    tree.replaceChildren();
    const maxDepth = Number(document.getElementById('dependency-depth').value) || 2;
    const implementation = graph.edges.filter(edge => edge.from === node.id && edge.kind === 'implemented_by');
    const expanded = new Set();
    const localFiles = new Set();
    let frontier = [];
    implementation.forEach(edge => {
      const target = byId(edge.to);
      appendDependencyRow(tree, '実装元', dependencyName(target), 0);
      if (target?.kind === 'file') {
        expanded.add(target.id);
        localFiles.add(target.id);
        frontier.push(target.id);
      }
    });
    if (!implementation.length) {
      const empty = document.createElement('div');
      empty.className = 'dependency-empty';
      empty.textContent = '実装元の情報がありません。';
      tree.append(empty);
    }
    for (let depth = 1; depth <= maxDepth; depth += 1) {
      const next = [];
      frontier.forEach(fileId => {
        graph.edges.filter(edge => edge.from === fileId && edge.kind === 'imports').forEach(edge => {
          const target = byId(edge.to);
          const specifier = edge.metadata?.specifier;
          const detail = specifier ? `${specifier} → ${dependencyName(target)}` : dependencyName(target);
          appendDependencyRow(tree, 'import', depth > 1 ? `${dependencyName(byId(fileId))} → ${detail}` : detail, depth);
          if (target?.kind === 'file') {
            localFiles.add(target.id);
            if (!expanded.has(target.id)) {
              expanded.add(target.id);
              next.push(target.id);
            }
          }
        });
      });
      frontier = next;
    }
    if (document.getElementById('dependency-usages').checked && localFiles.size) {
      const reverseEdges = graph.edges.filter(edge => edge.kind === 'imports' && localFiles.has(edge.to) && !localFiles.has(edge.from));
      reverseEdges.forEach(edge => {
        const source = byId(edge.from);
        appendDependencyRow(tree, '使用元', `${dependencyName(source)} → ${dependencyName(byId(edge.to))}`, 0);
      });
      if (!reverseEdges.length) {
        const empty = document.createElement('div');
        empty.className = 'dependency-empty';
        empty.textContent = '使用元が見つかりません。';
        tree.append(empty);
      }
    }
    if (!tree.children.length) {
      const empty = document.createElement('div');
      empty.className = 'dependency-empty';
      empty.textContent = '依存関係が見つかりません。';
      tree.append(empty);
    }
  }

  function selectNode(id) {
    selectedId = id;
    Array.from(nodeLayer.children).forEach(element => element.classList.toggle('selected', element.dataset.nodeId === id));
    const node = byId(id);
    if (!node) return;
    document.getElementById('inspector-kind').textContent = node.kind;
    document.getElementById('inspector-title').textContent = node.label;
    document.getElementById('inspector-description').textContent = node.description || 'No description available.';
    document.getElementById('inspector-source').textContent = sourceLabel(node);
    document.getElementById('inspector-confidence').textContent = confidenceLabel(node);
    document.getElementById('inspector-layout').textContent = layouts.views[currentView]?.[id]?.pinned ? 'Manual · pinned across updates' : 'Automatic · drag to pin';
    const related = graph.edges.filter(edge => edge.from === id || edge.to === id).length;
    document.getElementById('inspector-relations').textContent = `${related} relationship${related === 1 ? '' : 's'}`;
    renderScreenPreview(node);
    renderDependencies(node);
  }

  function setPanelCollapsed(panel, collapsed, persist = true) {
    const shell = document.querySelector('.shell');
    const button = document.getElementById(`toggle-${panel}`);
    shell.classList.toggle(`${panel}-collapsed`, collapsed);
    button.setAttribute('aria-expanded', String(!collapsed));
    const label = `${panel === 'sidebar' ? 'メニュー' : '詳細'}を${collapsed ? '表示' : '隠す'}`;
    button.title = label;
    button.setAttribute('aria-label', label);
    if (persist) sessionStorage.setItem(`design-map-${panel}-collapsed`, String(collapsed));
    requestAnimationFrame(() => {
      if (graph && currentView !== 'preview') applyPositions();
    });
  }

  function renderView(view) {
    hoveredNodeId = null;
    focusedNodeId = null;
    refreshEdgeHighlights();
    if (view !== currentView) {
      zoomScale = 1;
      gestureActive = false;
      updateZoomControls();
      updateGraphDimensions();
    }
    currentView = view;
    const shell = document.querySelector('.shell');
    const toolbar = document.getElementById('graph-toolbar');
    const screenWorkspace = document.getElementById('screen-workspace');
    if (view === 'preview') {
      shell.classList.add('preview-active');
      toolbar.hidden = true;
      canvas.hidden = true;
      canvas.scrollLeft = 0;
      canvas.scrollTop = 0;
      screenWorkspace.hidden = false;
      renderScreenWorkspace();
      document.querySelectorAll('[data-view-target]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.viewTarget === view)));
      return;
    }
    shell.classList.remove('preview-active');
    toolbar.hidden = false;
    canvas.hidden = false;
    canvas.scrollLeft = 0;
    canvas.scrollTop = 0;
    screenWorkspace.hidden = true;
    const config = { ...viewConfig[view] };
    let candidates = graph.nodes.filter(node => config.kinds.includes(node.kind));
    if (view === 'concept' && candidates.length === 0) {
      candidates = graph.nodes.filter(node => node.kind === 'package');
      config.edgeKinds = new Set(['depends_on']);
    }
    if (view === 'concept' && candidates.length === 0) {
      candidates = graph.nodes.filter(node => node.kind === 'file').slice(0, 80);
      config.edgeKinds = new Set(['imports']);
    }
    const nodeSet = new Set(candidates.map(node => node.id));
    visibleNodes = graph.nodes.filter(node => nodeSet.has(node.id));
    visibleEdges = graph.edges.filter(edge => (!config.edgeKinds || config.edgeKinds.has(edge.kind)) && nodeSet.has(edge.from) && nodeSet.has(edge.to));
    document.querySelectorAll('[data-view-target]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.viewTarget === view)));
    document.getElementById('view-title').textContent = config.title;
    document.getElementById('view-meta').textContent = `${visibleNodes.length} nodes · ${visibleEdges.length} relationships`;
    nodeLayer.replaceChildren();
    visibleNodes.forEach(node => {
      const element = document.createElement('div');
      element.className = `map-node ${node.kind}`;
      element.dataset.nodeId = node.id;
      element.setAttribute('role', 'button');
      element.setAttribute('tabindex', '0');
      element.setAttribute('aria-label', node.label);
      element.innerHTML = nodeMarkup(node);
      element.addEventListener('pointerenter', () => {
        hoveredNodeId = node.id;
        refreshEdgeHighlights();
      });
      element.addEventListener('pointerleave', () => {
        if (hoveredNodeId === node.id) hoveredNodeId = null;
        refreshEdgeHighlights();
      });
      element.addEventListener('focusin', () => {
        focusedNodeId = node.id;
        refreshEdgeHighlights();
      });
      element.addEventListener('focusout', event => {
        if (event.relatedTarget && element.contains(event.relatedTarget)) return;
        if (focusedNodeId === node.id) focusedNodeId = null;
        refreshEdgeHighlights();
      });
      element.addEventListener('click', () => {
        if (element.dataset.dragged === 'true') { element.dataset.dragged = 'false'; return; }
        selectNode(node.id);
      });
      element.addEventListener('keydown', event => {
        if (event.target !== element || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        selectNode(node.id);
      });
      bindScreenPreview(element, node);
      bindDrag(element);
      nodeLayer.append(element);
    });
    emptyState.hidden = visibleNodes.length > 0;
    document.getElementById('evidence-status').hidden = visibleEdges.length === 0;
    applyPositions();
    if (visibleNodes.length) {
      const selectedStillVisible = visibleNodes.some(node => node.id === selectedId);
      const initialNode = view === 'flow' ? preferredScreen(visibleNodes) : visibleNodes[0];
      selectNode(selectedStillVisible ? selectedId : initialNode?.id || visibleNodes[0].id);
    } else {
      selectedId = null;
      document.getElementById('inspector-kind').textContent = '未選択';
      document.getElementById('inspector-title').textContent = '表示するノードがありません';
      document.getElementById('inspector-description').textContent = '';
      for (const key of ['source', 'confidence', 'layout', 'relations']) document.getElementById(`inspector-${key}`).textContent = '—';
      document.getElementById('screen-preview-panel').hidden = true;
      document.getElementById('dependency-panel').hidden = true;
    }
  }

  function bindDrag(element) {
    element.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      if (event.target.closest('[data-open-preview]')) return;
      const rect = element.getBoundingClientRect();
      element.setPointerCapture(event.pointerId);
      element.classList.add('dragging');
      selectNode(element.dataset.nodeId);
      drag = { element, pointerId: event.pointerId, offsetX: (event.clientX - rect.left) / zoomScale, offsetY: (event.clientY - rect.top) / zoomScale, moved: false };
    });
    element.addEventListener('pointermove', event => {
      if (!drag || drag.element !== element || drag.pointerId !== event.pointerId) return;
      const area = canvas.getBoundingClientRect();
      const maxLeft = Math.max(8, stageSize.width - element.offsetWidth - 8);
      const maxTop = Math.max(8, stageSize.height - element.offsetHeight - 8);
      const left = (event.clientX - area.left - canvas.clientLeft + canvas.scrollLeft - graphMarginX) / zoomScale - drag.offsetX;
      const top = (event.clientY - area.top - canvas.clientTop + canvas.scrollTop - graphMarginY) / zoomScale - drag.offsetY;
      element.style.left = `${clamp(left, 8, maxLeft)}px`;
      element.style.top = `${clamp(top, 8, maxTop)}px`;
      drag.moved = true;
      drawEdges();
    });
    const finish = event => {
      if (!drag || drag.element !== element || drag.pointerId !== event.pointerId) return;
      element.classList.remove('dragging');
      if (drag.moved) {
        const maxLeft = Math.max(8, stageSize.width - element.offsetWidth - 8);
        const maxTop = Math.max(8, stageSize.height - element.offsetHeight - 8);
        layouts.views[currentView][element.dataset.nodeId] = {
          x: clamp(parseFloat(element.style.left) / maxLeft, 0, 1),
          y: clamp(parseFloat(element.style.top) / maxTop, 0, 1),
          pinned: true
        };
        element.classList.add('pinned');
        element.dataset.dragged = 'true';
        document.getElementById('inspector-layout').textContent = 'Manual · pinned across updates';
        persistLayouts();
      }
      drag = null;
    };
    element.addEventListener('pointerup', finish);
    element.addEventListener('pointercancel', finish);
  }

  function persistLayouts() {
    const body = JSON.stringify(layouts);
    setStatus('配置を保存中…');
    saveQueue = saveQueue.then(async () => {
      try {
        const response = await fetch('/api/layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setStatus('配置を保存しました');
      } catch (error) {
        setStatus('配置を保存できませんでした。再読み込みすると変更が失われます。', true);
      }
    });
    return saveQueue;
  }

  function updateCounts() {
    const screenCount = graph.nodes.filter(node => node.kind === 'screen').length;
    document.querySelector('[data-count="preview"]').textContent = screenCount;
    for (const [name, config] of Object.entries(viewConfig)) {
      let count = graph.nodes.filter(node => config.kinds.includes(node.kind)).length;
      if (name === 'concept' && count === 0) count = graph.nodes.filter(node => node.kind === 'package').length || Math.min(80, graph.nodes.filter(node => node.kind === 'file').length);
      document.querySelector(`[data-count="${name}"]`).textContent = count;
    }
  }

  async function load() {
    try {
      const [graphResponse, layoutResponse] = await Promise.all([fetch('../generated/graph.json'), fetch('../generated/layouts.json')]);
      if (!graphResponse.ok || !layoutResponse.ok) throw new Error('Generated map data is missing.');
      graph = await graphResponse.json();
      layouts = await layoutResponse.json();
      layouts.views ||= {};
      for (const name of Object.keys(viewConfig)) layouts.views[name] ||= {};
      const rememberedMode = sessionStorage.getItem('design-map-preview-mode');
      previewMode = rememberedMode === 'storybook' ? 'storybook' : 'screenshot';
      document.getElementById('project-name').textContent = graph.project?.name || 'Project';
      document.title = `${graph.project?.name || 'Project'} · Design Map`;
      document.getElementById('sync-status').textContent = graph.generatedAt ? `Synced ${new Date(graph.generatedAt).toLocaleString()}` : 'Synced';
      updateCounts();
      renderView('flow');
    } catch (error) {
      app.innerHTML = `<div class="error"><strong>Design Map could not load</strong><span>${escapeHtml(error.message)}</span><p>Run <code>python3 ~/.codex/skills/design-map/scripts/design_map.py open .</code></p></div>`;
    }
  }

  document.querySelectorAll('[data-view-target]').forEach(button => button.addEventListener('click', () => renderView(button.dataset.viewTarget)));
  document.getElementById('toggle-sidebar').addEventListener('click', () => {
    setPanelCollapsed('sidebar', !document.querySelector('.shell').classList.contains('sidebar-collapsed'));
  });
  document.getElementById('toggle-inspector').addEventListener('click', () => {
    setPanelCollapsed('inspector', !document.querySelector('.shell').classList.contains('inspector-collapsed'));
  });
  setPanelCollapsed('sidebar', sessionStorage.getItem('design-map-sidebar-collapsed') === 'true', false);
  setPanelCollapsed('inspector', sessionStorage.getItem('design-map-inspector-collapsed') === 'true', false);
  document.getElementById('inspector-preview-link').addEventListener('click', event => {
    const image = document.getElementById('inspector-preview-image');
    if (!image.src) return;
    openPreview(image.currentSrc || image.src, image.alt, `${image.alt} · ${document.getElementById('inspector-preview-caption').textContent}`, event.currentTarget);
  });
  document.getElementById('screen-image-link').addEventListener('click', event => {
    const image = document.getElementById('screen-image');
    if (!image.src) return;
    openPreview(image.currentSrc || image.src, image.alt, `${image.alt} · ${document.getElementById('screen-preview-caption').textContent}`, event.currentTarget);
  });
  document.getElementById('preview-lightbox-close').addEventListener('click', () => document.getElementById('preview-lightbox').close());
  document.getElementById('preview-lightbox').addEventListener('click', event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close();
  });
  document.getElementById('preview-lightbox').addEventListener('close', () => {
    const opener = lightboxOpener;
    lightboxOpener = null;
    if (opener?.isConnected && !opener.disabled && opener.getClientRects().length) requestAnimationFrame(() => opener.focus({ preventScroll: true }));
  });
  document.getElementById('preview-screen-select').addEventListener('change', event => {
    currentScreenId = event.target.value;
    sessionStorage.setItem('design-map-screen', currentScreenId);
    renderScreenWorkspace();
  });
  document.getElementById('preview-state-select').addEventListener('change', event => {
    const node = byId(currentScreenId);
    if (!node || node.kind !== 'screen') return;
    selectedPreviewByScreen.set(node.id, event.target.value);
    sessionStorage.setItem(`design-map-state:${node.id}`, event.target.value);
    renderScreenWorkspace();
  });
  document.querySelectorAll('[data-preview-mode]').forEach(button => button.addEventListener('click', () => {
    if (button.disabled) return;
    previewMode = button.dataset.previewMode;
    sessionStorage.setItem('design-map-preview-mode', previewMode);
    renderScreenWorkspace();
  }));
  document.getElementById('inspector-preview-state').addEventListener('change', event => {
    const node = byId(selectedId);
    if (!node || node.kind !== 'screen') return;
    selectedPreviewByScreen.set(node.id, event.target.value);
    sessionStorage.setItem(`design-map-state:${node.id}`, event.target.value);
    renderScreenPreview(node);
  });
  document.getElementById('dependency-depth').addEventListener('change', () => {
    const node = byId(selectedId);
    if (node) renderDependencies(node);
  });
  document.getElementById('dependency-usages').addEventListener('change', () => {
    const node = byId(selectedId);
    if (node) renderDependencies(node);
  });
  document.getElementById('auto-arrange').addEventListener('click', () => {
    layouts.views[currentView] = {};
    applyPositions();
    if (selectedId) selectNode(selectedId);
    persistLayouts();
  });
  document.getElementById('zoom-out').addEventListener('click', () => zoomAtViewportCenter(zoomScale / 1.2));
  document.getElementById('zoom-reset').addEventListener('click', () => zoomAtViewportCenter(1));
  document.getElementById('zoom-in').addEventListener('click', () => zoomAtViewportCenter(zoomScale * 1.2));
  canvas.addEventListener('wheel', event => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    if (gestureActive) return;
    setZoomAt(window.DesignMapZoom.scaleForWheel(zoomScale, event.deltaY), event.clientX, event.clientY);
  }, { passive: false });
  canvas.addEventListener('gesturestart', event => {
    event.preventDefault();
    gestureActive = true;
    gestureStartScale = zoomScale;
  }, { passive: false });
  canvas.addEventListener('gesturechange', event => {
    if (!gestureActive || !Number.isFinite(event.scale) || event.scale <= 0) return;
    event.preventDefault();
    setZoomAt(gestureStartScale * event.scale, event.clientX, event.clientY);
  }, { passive: false });
  canvas.addEventListener('gestureend', event => {
    if (!gestureActive) return;
    event.preventDefault();
    gestureActive = false;
  }, { passive: false });
  updateZoomControls();
  document.getElementById('retry-save').addEventListener('click', persistLayouts);
  for (const [imageId, buttonId, emptyId] of [
    ['inspector-preview-image', 'inspector-preview-link', 'inspector-preview-empty'],
    ['screen-image', 'screen-image-link', 'screen-preview-empty']
  ]) {
    document.getElementById(imageId).addEventListener('error', () => {
      document.getElementById(buttonId).hidden = true;
      const empty = document.getElementById(emptyId);
      empty.textContent = '画像を読み込めません。登録したスクショを確認してください。';
      empty.hidden = false;
    });
  }
  let observedCanvasWidth = canvas.clientWidth;
  new ResizeObserver(entries => {
    const width = entries[0]?.contentRect.width ?? canvas.clientWidth;
    const widthChanged = Math.abs(width - observedCanvasWidth) > 0.5;
    observedCanvasWidth = width;
    if (widthChanged && layouts && !canvas.hidden && currentView !== 'preview') applyPositions();
  }).observe(canvas);
  window.addEventListener?.('resize', updateGraphDimensions);
  load();
})();
