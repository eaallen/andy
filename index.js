var width = window.innerWidth;
var height = window.innerHeight;

var stage = new Konva.Stage({
  container: 'container',
  width: width,
  height: height,
});

var layer = new Konva.Layer();
stage.add(layer);

var container = document.getElementById('container');

var controls = document.createElement('div');
controls.style.cssText =
  'margin-bottom: 8px; display: flex; gap: 8px; align-items: center; font: 13px Arial, sans-serif; position: absolute; top: 8px; left: 8px; z-index: 10;';

var addBtn = document.createElement('button');
addBtn.textContent = '+ Add Node';
addBtn.style.cssText =
  'padding: 6px 14px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600;';
addBtn.onclick = function () {
  var x = 100 + Math.random() * (width - 200);
  var y = 80 + Math.random() * (height - 160);
  var node = makeNode('New Node', '#2196F3', x, y);
  node.moveToTop();
  layer.draw();
};
controls.appendChild(addBtn);

var hint = document.createElement('span');
hint.textContent = 'Drag nodes to reposition. Arrows follow automatically.';
hint.style.cssText = 'color: #888; font-size: 12px;';
controls.appendChild(hint);

container.parentNode.insertBefore(controls, container);

var nodeList = [];
var arrowList = [];

/**
 * Creates a draggable flowchart node with a colored rect and label.
 * @param {string} label - Text shown on the node.
 * @param {string} color - Fill color for the node rect.
 * @param {number} x - Initial x position of the node center.
 * @param {number} y - Initial y position of the node center.
 */
function makeNode(label, color, x, y) {
  var group = new Konva.Group({ x: x, y: y, draggable: true });

  var rect = new Konva.Rect({
    width: 120,
    height: 50,
    fill: color,
    cornerRadius: 8,
    shadowColor: 'rgba(0,0,0,0.15)',
    shadowBlur: 6,
    shadowOffsetY: 2,
    offsetX: 60,
    offsetY: 25,
  });

  var text = new Konva.Text({
    text: label,
    fontSize: 14,
    fontFamily: 'Arial',
    fill: '#fff',
    width: 120,
    height: 50,
    align: 'center',
    verticalAlign: 'middle',
    offsetX: 60,
    offsetY: 25,
  });

  group.add(rect);
  group.add(text);
  layer.add(group);

  var entry = { group: group };
  nodeList.push(entry);

  group.on('dragmove', updateArrows);

  return group;
}

/**
 * Draws an arrow between two node groups and tracks it for updates.
 * @param {Konva.Group} from - Source node group.
 * @param {Konva.Group} to - Target node group.
 */
function connect(from, to) {
  var arrow = new Konva.Arrow({
    points: [from.x(), from.y(), to.x(), to.y()],
    pointerLength: 10,
    pointerWidth: 8,
    fill: '#555',
    stroke: '#555',
    strokeWidth: 2,
    listening: false,
  });
  layer.add(arrow);
  arrow.moveToBottom();
  arrowList.push({ shape: arrow, from: from, to: to });
}

/**
 * Recomputes arrow endpoints from current node positions.
 */
function updateArrows() {
  for (var i = 0; i < arrowList.length; i++) {
    var a = arrowList[i];
    a.shape.points([a.from.x(), a.from.y(), a.to.x(), a.to.y()]);
  }
  layer.batchDraw();
}

var start = makeNode('Start', '#4CAF50', 100, 120);
var procA = makeNode('Process A', '#2196F3', 300, 80);
var decide = makeNode('Decision', '#FF9800', 500, 120);
var procB = makeNode('Process B', '#2196F3', 300, 260);
var end = makeNode('End', '#f44336', 500, 260);

connect(start, procA);
connect(procA, decide);
connect(decide, procB);
connect(decide, end);
connect(procB, end);

layer.draw();
