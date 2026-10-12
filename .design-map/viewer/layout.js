((root) => {
  const dagre = root.dagre;

  function layoutGraph(nodes, edges) {
    if (!dagre?.graphlib?.Graph || typeof dagre.layout !== 'function') {
      throw new Error('Dagre automatic layout is unavailable; load dagre.min.js before layout.js.');
    }
    if (nodes.length === 0) return { width: 0, height: 0, positions: {}, routes: {} };

    const graph = new dagre.graphlib.Graph({ multigraph: true });
    graph.setGraph({
      rankdir: 'TB',
      nodesep: 32,
      ranksep: 64,
      edgesep: 18,
      marginx: 24,
      marginy: 24
    });
    graph.setDefaultEdgeLabel(() => ({ width: 0, height: 0 }));

    const nodeIds = new Set(nodes.map(node => node.id));
    nodes.forEach(node => {
      const width = Number(node.width);
      const height = Number(node.height);
      if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
        throw new Error(`Dagre needs measured positive dimensions for node ${node.id}.`);
      }
      graph.setNode(node.id, { width, height });
    });

    const namedEdges = edges.flatMap((edge, index) => {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) return [];
      return [{
        edge,
        name: String(edge.id || `${edge.from}:${edge.to}:${index}`),
        width: Number(edge.layoutLabelWidth) || 0,
        height: Number(edge.layoutLabelHeight) || 0
      }];
    });
    namedEdges.forEach(({ edge, name, width, height }) => {
      graph.setEdge(edge.from, edge.to, { width, height }, name);
    });

    dagre.layout(graph);
    const graphSize = graph.graph();
    if (!Number.isFinite(graphSize.width) || !Number.isFinite(graphSize.height)) {
      throw new Error('Dagre did not return finite graph dimensions.');
    }

    const positions = {};
    nodes.forEach(node => {
      const placed = graph.node(node.id);
      positions[node.id] = {
        left: placed.x - placed.width / 2,
        top: placed.y - placed.height / 2,
        width: placed.width,
        height: placed.height
      };
    });

    const routes = {};
    namedEdges.forEach(({ edge, name }) => {
      const route = graph.edge({ v: edge.from, w: edge.to, name });
      routes[edge.id || name] = {
        x: route.x,
        y: route.y,
        points: (route.points || []).map(point => ({ x: point.x, y: point.y }))
      };
    });

    return { width: graphSize.width, height: graphSize.height, positions, routes };
  }

  root.DesignMapLayout = { layoutGraph };
})(globalThis);
