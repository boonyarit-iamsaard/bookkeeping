/*
 * Diagram kit: draws the edges of a `*.diagram.html` file after layout.
 *
 * Declare an edge inside the `.diagram` figure:
 *
 *   <a-edge from="cron" to="bucket">PutObject only</a-edge>
 *
 * Attributes:
 *   from, to          ids of the two elements to join
 *   from-side, to-side  top | right | bottom | left; chosen from the
 *                     elements' positions when left out
 *   variant           "dash" and/or "accent", space-separated
 *   reach             how far the curve leaves each side, in pixels
 *   at                where the label sits along the curve, 0 to 1 (0.5)
 *   dx, dy            label offset in pixels
 *
 * The label is the element's content; `<br>` splits lines. When every edge is
 * drawn, `data-diagram-ready` is set on the root element for the renderer.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const NORMALS = {
  top: [0, -1],
  right: [1, 0],
  bottom: [0, 1],
  left: [-1, 0],
};

function boxOf(element, origin) {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left - origin.left,
    top: rect.top - origin.top,
    right: rect.right - origin.left,
    bottom: rect.bottom - origin.top,
    centerX: rect.left - origin.left + rect.width / 2,
    centerY: rect.top - origin.top + rect.height / 2,
  };
}

function chooseSides(from, to) {
  const dx = to.centerX - from.centerX;
  const dy = to.centerY - from.centerY;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? ["right", "left"] : ["left", "right"];
  }
  return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
}

function anchor(box, side) {
  switch (side) {
    case "top":
      return [box.centerX, box.top];
    case "right":
      return [box.right, box.centerY];
    case "bottom":
      return [box.centerX, box.bottom];
    default:
      return [box.left, box.centerY];
  }
}

function pointOnCurve(points, t) {
  const [p0, p1, p2, p3] = points;
  const u = 1 - t;
  return [0, 1].map(
    (axis) =>
      u * u * u * p0[axis] +
      3 * u * u * t * p1[axis] +
      3 * u * t * t * p2[axis] +
      t * t * t * p3[axis],
  );
}

function drawEdge({ edge, layer, figure, origin }) {
  const fromElement = document.getElementById(edge.getAttribute("from"));
  const toElement = document.getElementById(edge.getAttribute("to"));
  if (!fromElement || !toElement) {
    throw new Error(
      `a-edge: missing element for from="${edge.getAttribute("from")}" to="${edge.getAttribute("to")}"`,
    );
  }
  const from = boxOf(fromElement, origin);
  const to = boxOf(toElement, origin);
  const [autoFrom, autoTo] = chooseSides(from, to);
  const fromSide = edge.getAttribute("from-side") ?? autoFrom;
  const toSide = edge.getAttribute("to-side") ?? autoTo;
  const variants = (edge.getAttribute("variant") ?? "").split(/\s+/);
  const accent = variants.includes("accent");
  const headLength = accent ? 12 : 9;
  const gap = 3;

  const start = anchor(from, fromSide);
  const tip = anchor(to, toSide);
  const [nx0, ny0] = NORMALS[fromSide];
  const [nx3, ny3] = NORMALS[toSide];
  const end = [
    tip[0] + nx3 * (headLength + gap),
    tip[1] + ny3 * (headLength + gap),
  ];
  const distance = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const reach = Number(
    edge.getAttribute("reach") ?? Math.min(Math.max(distance * 0.4, 24), 140),
  );
  const points = [
    start,
    [start[0] + nx0 * reach, start[1] + ny0 * reach],
    [end[0] + nx3 * reach, end[1] + ny3 * reach],
    end,
  ];

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute(
    "d",
    `M ${points[0]} C ${points[1]} ${points[2]} ${points[3]}`,
  );
  path.setAttribute("class", ["edge", ...variants].join(" ").trim());
  layer.append(path);

  // The head points along the side's inward normal, so it meets the border square.
  const [ix, iy] = [-nx3, -ny3];
  const [px, py] = [-iy, ix];
  const half = headLength * 0.45;
  const base = [
    tip[0] - ix * (headLength + gap),
    tip[1] - iy * (headLength + gap),
  ];
  const point = [tip[0] - ix * gap, tip[1] - iy * gap];
  const head = document.createElementNS(SVG_NS, "path");
  head.setAttribute(
    "d",
    `M ${point} L ${base[0] + px * half},${base[1] + py * half} L ${base[0] - px * half},${base[1] - py * half} Z`,
  );
  head.setAttribute("class", accent ? "head accent" : "head");
  layer.append(head);

  const text = edge.innerHTML.trim();
  if (text) {
    const at = Number(edge.getAttribute("at") ?? 0.5);
    const [x, y] = pointOnCurve(points, at);
    const label = document.createElement("div");
    label.className = accent ? "edge-label accent" : "edge-label";
    label.innerHTML = text;
    label.style.left = `${x + Number(edge.getAttribute("dx") ?? 0)}px`;
    label.style.top = `${y + Number(edge.getAttribute("dy") ?? 0)}px`;
    figure.append(label);
  }
}

function drawDiagram(figure) {
  for (const old of figure.querySelectorAll(".edge-layer, .edge-label")) {
    old.remove();
  }
  const origin = figure.getBoundingClientRect();
  const layer = document.createElementNS(SVG_NS, "svg");
  layer.setAttribute("class", "edge-layer");
  layer.setAttribute("aria-hidden", "true");
  // Edges sit beneath the cards, so they disappear behind the boxes they join.
  figure.prepend(layer);
  for (const edge of figure.querySelectorAll("a-edge")) {
    drawEdge({ edge, layer, figure, origin });
  }
}

async function drawAll() {
  await document.fonts.ready;
  const figures = document.querySelectorAll(".diagram");
  for (const figure of figures) {
    drawDiagram(figure);
  }
  document.documentElement.dataset.diagramReady = "true";
}

window.addEventListener("resize", () => {
  for (const figure of document.querySelectorAll(".diagram")) {
    drawDiagram(figure);
  }
});

drawAll();
