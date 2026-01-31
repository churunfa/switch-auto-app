<template>
  <main class="canvas-area">
    <div v-if="graph" class="canvas-wrapper">
      <div class="canvas-header">
        <div class="header-main-info">
          <div class="active-info">
            <div class="status-dot pulsed"></div>
            <input v-model="graph.combination.combinationName" class="inline-edit-title" spellcheck="false" placeholder="Combination Name"/>
            <code class="proj-name">@{{ graph.combination.projectName }}</code>
          </div>
          <div class="description-edit-area">
            <label class="desc-label">DESCRIPTION</label>
            <textarea
                v-model="graph.combination.desc"
                class="inline-edit-desc"
                placeholder="Click to add some details..."
                rows="2"
                spellcheck="false"
            ></textarea>
          </div>
        </div>

        <div class="canvas-ops">
          <div class="edit-toolbar">
            <div class="divider"></div>
            <button class="btn-tool" @click="handleManualLayout">⚡ AUTO LAYOUT</button>
            <button class="btn-tool" @click="addNode">＋ INSERT NODE</button>
            <div class="divider"></div>
            <button
                class="btn-solid-orange"
                @click="handleExec"
                :disabled="isExecuting"
            >
              {{ isExecuting ? 'EXECUTING...' : '▶ RUN DEBUG' }}
            </button>
          </div>
          <div class="divider"></div>
          <button class="btn-ghost" @click="$emit('close')">CLOSE</button>
          <button class="btn-solid-green" @click="saveData">SAVE CHANGES</button>
        </div>
      </div>

      <div class="flow-preview" ref="flowPreviewRef" @contextmenu.prevent>
        <div ref="container" class="lf-container"></div>
        <div class="canvas-hint">
          {{ selectedEdgeId ? '已选中连线：按Delete可删除' : '提示：点击上方按钮插入独立节点 • 拖拽连线连接节点 • Ctrl+C/V 复制粘贴' }}
        </div>
        <div
            v-if="currentNodeId || selectedEdgeId"
            class="config-drawer"
            ref="drawerRef"
            :style="drawerStyle"
            @mousedown.stop
            @click.stop
        >
          <div class="drawer-header" @mousedown="startDrag">
            <h3>
              {{ currentNodeId ? '节点参数配置' : '连线属性配置' }}
              <span class="drag-hint">(按住拖动)</span>
            </h3>
            <button class="close-btn" @click.stop="closeDrawer">×</button>
          </div>

          <div class="drawer-content">
            <div v-if="currentNodeId">
              <div v-if="isSpecialNode" class="special-hint">
                <span class="icon">🔒</span>
                <p>系统控制节点<br><span class="sub-text">ID: {{currentNodeId}}</span></p>
              </div>

              <div v-else class="form-container">
                <div class="form-group">
                  <label>节点名称 (Node Name)</label>
                  <input type="text" v-model="currentNodeForm.nodeName" class="input-dark" placeholder="自定义节点展示名称" />
                </div>
                <div class="form-group">
                  <label>操作类型 (Operation)</label>
                  <select :value="currentNodeForm.baseOperate?.id" @change="handleOperateChange($event.target.value)" class="input-dark select-arrow">
                    <option v-for="op in availableOperates" :key="op.id" :value="op.id">
                      {{ op.name }}
                    </option>
                  </select>
                </div>
                <div class="divider-line"></div>
                <div class="form-group">
                  <div class="form-group">
                    <label>循环次数 (Loop Count)</label>
                    <input type="number" v-model.number="currentNodeForm.loopCnt" class="input-dark" placeholder="1" />
                  </div>
                </div>
                <div>
                  <div class="form-group row-center">
                    <label>执行 (exec-ms)</label>
                    <div class="switch-box">
                      <input type="checkbox" id="exec-switch" v-model="currentNodeForm.exec" />
                      <label for="exec-switch" class="toggle"></label>
                    </div>
                  </div>
                  <div v-if="currentNodeForm.exec" class="form-group slide-in">
                    <div class="input-wrapper">
                      <input type="number" v-model.number="currentNodeForm.execHoldTime" class="input-dark" />
                      <span class="suffix">Min: {{ currentNodeForm.baseOperate?.minExecTime || 0 }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="currentNodeForm.baseOperate?.needReset">
                  <div class="form-group row-center" v-if="currentNodeForm.baseOperate?.needReset">
                    <label>重置 (reset-ms)</label>
                    <div class="switch-box">
                      <input type="checkbox" id="reset-switch" v-model="currentNodeForm.reset" />
                      <label for="reset-switch" class="toggle"></label>
                    </div>
                  </div>
                  <div v-if="currentNodeForm.reset" class="form-group slide-in">
                    <div class="input-wrapper">
                      <input type="number" v-model.number="currentNodeForm.resetHoldTime" class="input-dark" />
                      <span class="suffix">Min: {{ currentNodeForm.baseOperate?.minResetTime || 0 }}</span>
                    </div>
                  </div>
                </div>
                <div class="divider-line"></div>
                <div v-if="currentNodeForm.baseOperate?.paramSize > 0">
                  <label class="section-title">动态参数 (PARAMS)</label>
                  <div v-for="(pName, idx) in currentNodeForm.baseOperate.paramNames" :key="idx" class="form-group">
                    <label>{{ pName }}</label>
                    <input type="text" v-model="currentNodeForm.params[idx]" class="input-dark" :placeholder="currentNodeForm.baseOperate.initParams?.[idx] || 'Value'" />
                  </div>
                </div>
                <div v-else class="empty-hint">此操作无额外动态参数</div>
              </div>
            </div>

            <div v-else-if="selectedEdgeId" class="form-container">
              <div class="special-hint" style="margin-top: 10px; margin-bottom: 20px;">
                <span class="icon" style="font-size: 2rem;">🔗</span>
                <p>连线配置<br><span class="sub-text">ID: {{selectedEdgeId}}</span></p>
              </div>
              <div class="form-group">
                <label>连线名称 (Edge Name)</label>
                <input type="text" v-model="currentEdgeForm.edgeName" class="input-dark" placeholder="输入连线名称" />
              </div>
              <div class="divider-line"></div>
              <div class="form-group">
                <label>起始节点 (From)</label>
                <select v-model="currentEdgeForm.sourceNodeId" @change="updateEdgeConnection" class="input-dark select-arrow">
                  <option v-for="node in nodeOptions" :key="node.id" :value="node.id">
                    {{ node.name }}
                  </option>
                </select>
              </div>
              <div class="center-icon">⬇</div>
              <div class="form-group">
                <label>目标节点 (To)</label>
                <select v-model="currentEdgeForm.targetNodeId" @change="updateEdgeConnection" class="input-dark select-arrow">
                  <option v-for="node in nodeOptions" :key="node.id" :value="node.id">
                    {{ node.name }}
                  </option>
                </select>
              </div>
              <div class="divider-line" style="margin-top: 20px;"></div>
              <button class="btn-delete-block" @click="deleteCurrentEdge">
                🗑️ 删除此连线
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="empty-canvas">
      <div class="scanner-circle"><span class="icon">🕸️</span></div>
      <p>NO GRAPH DATA LOADED</p>
    </div>
  </main>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount, toRaw } from 'vue';
import LogicFlow, { RectNode, RectNodeModel, h } from '@logicflow/core';
import * as Extension from '@logicflow/extension';
import dagre from 'dagre';
import { ElMessage } from 'element-plus';
import "element-plus/dist/index.css";
import "@logicflow/core/dist/index.css";
import "@logicflow/extension/lib/style/index.css";

const props = defineProps({
  graph: { type: Object, default: null },
  baseOperates: { type: Array, default: () => [] }
});

const emit = defineEmits(['save', 'close']);
const container = ref(null);
const flowPreviewRef = ref(null);
const selectedEdgeId = ref(null);
let lf = null;
let resizeObserver = null;

// --- 🔧 状态管理 ---
const currentNodeId = ref(null);
let isProgrammaticUpdate = false;
const isExecuting = ref(false);

const getDefaultFormState = () => ({
  nodeName: '',
  baseOperate: {},
  params: [],
  execHoldTime: 0,
  resetHoldTime: 0,
  loopCnt: 1,
  exec: false,
  reset: false
});
const currentNodeForm = reactive(getDefaultFormState());

const currentEdgeForm = reactive({
  edgeName: '',
  sourceNodeId: '',
  targetNodeId: ''
});
const nodeOptions = ref([]);

// --- 🌟 拖拽逻辑 ---
const drawerRef = ref(null);
const drawerPos = reactive({ x: null, y: null });
const isDragging = ref(false);
const dragOffset = { x: 0, y: 0 };
const drawerStyle = computed(() => {
  if (drawerPos.x === null || drawerPos.y === null) return { top: '20px', right: '20px', left: 'auto' };
  return { top: `${drawerPos.y}px`, left: `${drawerPos.x}px`, right: 'auto', transform: 'none' };
});
const startDrag = (e) => {
  if (!drawerRef.value || !flowPreviewRef.value) return;
  isDragging.value = true;
  const rect = drawerRef.value.getBoundingClientRect();
  dragOffset.x = e.clientX - rect.left;
  dragOffset.y = e.clientY - rect.top;
  if (drawerPos.x === null) {
    const pRect = flowPreviewRef.value.getBoundingClientRect();
    drawerPos.x = rect.left - pRect.left;
    drawerPos.y = rect.top - pRect.top;
  }
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
};
const onDrag = (e) => {
  if (!isDragging.value) return;
  const pRect = flowPreviewRef.value.getBoundingClientRect();
  let newX = e.clientX - pRect.left - dragOffset.x;
  let newY = e.clientY - pRect.top - dragOffset.y;
  if(newY<0) newY=0; if(newX<0) newX=0;
  drawerPos.x = newX; drawerPos.y = newY;
};
const stopDrag = () => { isDragging.value = false; document.removeEventListener('mousemove', onDrag); document.removeEventListener('mouseup', stopDrag); };

// --- 计算属性 & 辅助函数 ---
const availableOperates = computed(() => props.baseOperates.filter(op => !['START', '开始', 'END', '结束'].includes((op.name || '').toUpperCase())));
const isSpecialNode = computed(() => ['START', '开始', 'END', '结束'].includes((currentNodeForm.baseOperate?.name || '').toUpperCase()));

const closeDrawer = () => {
  currentNodeId.value = null;
  selectedEdgeId.value = null;
  isProgrammaticUpdate = false;
};

const validateGraphData = (nodes, edges) => {
  if (!nodes || nodes.length === 0) return '图数据为空，无法执行操作';
  return null;
};

const checkPathExist = (startId, endId, graphData) => {
  const adj = {};
  graphData.edges.forEach(e => {
    if(!adj[e.sourceNodeId]) adj[e.sourceNodeId] = [];
    adj[e.sourceNodeId].push(e.targetNodeId);
  });
  const visited = new Set();
  const stack = [startId];
  while(stack.length > 0) {
    const curr = stack.pop();
    if (curr === endId) return true;
    if (!visited.has(curr)) {
      visited.add(curr);
      if (adj[curr]) {
        adj[curr].forEach(neighbor => {
          if (!visited.has(neighbor)) stack.push(neighbor);
        });
      }
    }
  }
  return false;
};

const getMaxId = (items) => {
  if (!items || items.length === 0) return 0;
  const ids = items.map(i => parseInt(i.id || i.edgeId || i.nodeId)).filter(n => !isNaN(n));
  return ids.length > 0 ? Math.max(...ids) : 0;
};

const getNewIntegerId = (items) => {
  const maxId = getMaxId(items);
  return String(maxId + 1);
};

// --- LogicFlow View/Model ---
const UI_CONFIG = {
  width: 180, height: 60, radius: 6,
  colors: {
    start: { main: '#00DC82', bg: 'rgba(0, 220, 130, 0.15)', border: '#00DC82' },
    end:   { main: '#FF5460', bg: 'rgba(255, 84, 96, 0.15)', border: '#FF5460' },
    node:  { main: '#4F64FF', bg: 'rgba(79, 100, 255, 0.10)', border: '#4F64FF' },
    exec:  { main: '#FF9F43', bg: 'rgba(255, 159, 67, 0.15)', border: '#FF9F43' },
    reset: { main: '#00E5FF', bg: 'rgba(0, 229, 255, 0.15)', border: '#00E5FF' },
    mixed: { main: '#A55FEE', bg: 'rgba(165, 95, 238, 0.15)', border: '#A55FEE' }
  }
};

const getNodeTheme = (props) => {
  const baseName = props.baseOperate?.name || props.nodeName || '';
  const t = baseName.toUpperCase();
  if (['START', '开始', 'BEGIN'].includes(t)) return UI_CONFIG.colors.start;
  if (['END', '结束', 'STOP'].includes(t)) return UI_CONFIG.colors.end;
  if (props.exec && props.reset) return UI_CONFIG.colors.mixed;
  if (props.exec) return UI_CONFIG.colors.exec;
  if (props.reset) return UI_CONFIG.colors.reset;
  return UI_CONFIG.colors.node;
};

class LinearNodeView extends RectNode {
  getLabelShape() { return h('g'); }
  getShape() {
    const { model } = this.props;
    const { x, y, width, height, isSelected, id } = model;
    const properties = model.getProperties();
    const baseName = properties.baseOperate?.name || 'Unknown';
    const textValue = model.text?.value || properties.nodeName || baseName;
    const theme = getNodeTheme(properties);

    const xPos = x - width / 2;
    const yPos = y - height / 2;
    const strokeColor = isSelected ? '#FFFFFF' : theme.border;
    const strokeWidth = isSelected ? 2 : 1;

    const bgRect = h('rect', { x: xPos, y: yPos, width, height, rx: UI_CONFIG.radius, fill: '#181B24', stroke: strokeColor, strokeWidth, strokeOpacity: isSelected ? 1 : 0.6 });
    const colorStrip = h('rect', { x: xPos + 4, y: yPos + 4, width: 4, height: height - 8, rx: 2, fill: theme.main, pointerEvents: 'none' });
    const glowRect = h('rect', { x: xPos, y: yPos, width, height, rx: UI_CONFIG.radius, fill: theme.bg, stroke: 'none', pointerEvents: 'none' });

    let iconContent;
    const t = baseName.toUpperCase();
    const isSpecial = ['START', '开始', 'END', '结束'].includes(t);

    if (isSpecial) {
      let iconPath = '';
      if (['START', '开始'].includes(t)) iconPath = 'M 6 4 L 14 10 L 6 16 Z';
      else iconPath = 'M 6 6 L 14 6 L 14 14 L 6 14 Z';
      iconContent = h('path', { d: iconPath, fill: theme.main });
    } else {
      iconContent = h('text', {
        x: 10, y: 10, fill: theme.main, fontSize: 12, fontWeight: 'bold', textAnchor: 'middle', dominantBaseline: 'central', style: 'font-family: monospace; pointer-events: none;'
      }, [String(id)]);
    }

    const iconGroup = h('g', { transform: `translate(${xPos + 20}, ${yPos + height/2 - 10})`, pointerEvents: 'none' }, [
      h('rect', { width: 20, height: 20, fill: 'transparent' }),
      iconContent
    ]);

    const textLabel = h('text', {
      x: xPos + 48, y: yPos + height / 2, fontSize: 12, fill: '#ECECEC', fontWeight: 'bold', pointerEvents: 'none', dominantBaseline: 'middle', style: 'text-shadow: 0 1px 2px rgba(0,0,0,0.8); font-family: sans-serif;'
    }, [textValue]);

    return h('g', {}, [bgRect, glowRect, colorStrip, iconGroup, textLabel]);
  }
}

class LinearNodeModel extends RectNodeModel {
  setAttributes() { this.width = UI_CONFIG.width; this.height = UI_CONFIG.height; }
  getTextStyle() { return { fontSize: 0, fill: 'transparent', opacity: 0 }; }

  initNodeData(data) {
    super.initNodeData(data);
    if (!this.properties.baseOperate) {
      this.properties.baseOperate = { name: data.text?.value || 'Node', id: 0 };
    }
    if (!this.properties.nodeName) {
      this.properties.nodeName = this.properties.baseOperate.name;
    }
    const displayName = this.properties.nodeName;
    this.text = { value: displayName, x: data.x, y: data.y };
  }

  getDefaultAnchor() {
    const { x, y, width, id, properties } = this;
    const t = (properties.baseOperate?.name || '').toUpperCase();
    const anchors = [];
    if (!['START', '开始'].includes(t)) anchors.push({ x: x - width/2, y, id: `${id}_in`, type: 'left', edgeAddable: false });
    if (!['END', '结束'].includes(t)) anchors.push({ x: x + width/2, y, id: `${id}_out`, type: 'right', edgeAddable: true });
    return anchors;
  }

  // 🔥 修改2：目标锚点校验 (进)
  getConnectedTargetRules() {
    const rules = super.getConnectedTargetRules();
    rules.push({
      message: '操作禁止：只能连接到节点的[左侧]锚点',
      validate: (s, t, sa, ta) => ta && ta.type === 'left' // 必须连入左边
    });
    rules.push({ message: '非法连接：检测到闭环，系统不支持循环依赖', validate: (s, t) => !checkPathExist(t.id, s.id, this.graphModel.modelToGraphData()) });
    return rules;
  }

  // 🔥 修改2：起始锚点校验 (出)
  getConnectedSourceRules() {
    const rules = super.getConnectedSourceRules();
    rules.push({
      message: '操作禁止：仅允许从节点[右侧]锚点引出连线',
      validate: (source, target, sourceAnchor) => {
        return sourceAnchor && sourceAnchor.type === 'right'; // 必须从右边引出
      }
    });
    return rules;
  }
}

const calcSafeLayout = (nodes, edges) => {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', ranker: 'longest-path', nodesep: 40, ranksep: 90, marginx: 100, marginy: 100 });
  nodes.forEach(n => g.setNode(String(n.nodeId), { width: UI_CONFIG.width+20, height: UI_CONFIG.height+20 }));
  edges.forEach(e => g.setEdge(String(e.fromNodeId), String(e.nextNodeId)));
  try { dagre.layout(g); } catch(e) {}
  return {
    nodes: nodes.map((n, i) => {
      const pos = g.node(String(n.nodeId));
      const props = { ...n };
      if (!props.baseOperate) props.baseOperate = { name: 'Node', id: 0 };
      if(!props.nodeName) props.nodeName = props.baseOperate.name;
      let cleanName = props.nodeName || '';
      cleanName = cleanName.replace(/\s+\(EXEC\/RESET\)$/, '').replace(/\s+\(EXEC\)$/, '').replace(/\s+\(RESET\)$/, '');
      return {
        id: String(n.nodeId), type: 'process-node',
        x: pos ? pos.x : 150 + i*50, y: pos ? pos.y : 150 + i*50,
        text: cleanName,
        properties: { ...props, nodeName: cleanName }
      };
    }),
    edges: edges.map((e, i) => ({
      id: e.edgeId ? String(e.edgeId) : String(i + 1),
      type: 'bezier', sourceNodeId: String(e.fromNodeId), targetNodeId: String(e.nextNodeId),
      text: e.edgeName || '',
      properties: { edgeName: e.edgeName || '' }
    }))
  };
};

const renderGraph = () => {
  if (!lf) return;
  let nodes = props.graph?.combinationNodes || [];
  let edges = props.graph?.combinationEdges || [];

  // 🔥 修改1：如果图数据为空，初始化仅创建一个开始节点
  if (nodes.length === 0 && lf.getGraphData().nodes.length === 0) {
    nodes = [{
      nodeId: 1,
      nodeName: '开始',
      baseOperate: { name: 'START', id: -1 }, // 模拟系统START操作
      exec: false, reset: false, loopCnt: 1
    }];
    edges = []; // 确保没有连线，也没有结束节点
  } else if (nodes.length === 0 && lf.getGraphData().nodes.length > 0) {
    // 保持原有的 Snapshot 恢复逻辑
    const d = lf.getGraphData();
    nodes = d.nodes.map(n => ({...n.properties, nodeId: n.id}));
    edges = d.edges.map(e => ({fromNodeId: e.sourceNodeId, nextNodeId: e.targetNodeId, edgeId: e.id}));
  }

  const data = calcSafeLayout(nodes, edges);
  lf.render(data);
  nextTick(() => { if(data.nodes.length) { lf.translateCenter(); lf.zoom(0.9); } });
};

// --- 初始化与事件 (保持不变) ---
const initLF = () => {
  if (!container.value || !container.value.clientWidth) return;
  if (lf) { try{ lf.destroy(); }catch(e){} lf = null; }

  const plugins = [Extension.SelectionSelect, Extension.Bezier, Extension.Snapshot].filter(Boolean);
  lf = new LogicFlow({
    container: container.value,
    config: {
      maxZoom: 1.1, minZoom: 0.5, adjustEdge: true, adjustEdgeStartAndEnd: true,
      idGenerator: (type) => {
        if (!lf) return '1';
        const { nodes, edges } = lf.getGraphData();
        const collection = type === 'process-node' ? nodes : edges;
        return getNewIntegerId(collection);
      }
    },
    grid: { size: 20, visible: true, type: 'mesh', config: { color: '#1a1a1a', thickness: 1 } },
    background: { color: 'transparent' }, edgeType: 'bezier', hoverOutline: false, adjustEdge: false, plugins: plugins,
    keyboard: {
      enabled: true,
      shortcuts: [
        { keys: ["delete", "backspace"], callback: () => {
            const activeTag = document.activeElement.tagName;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) return;
            const elements = lf.getSelectElements(true);
            lf.clearSelectElements();
            elements.edges.forEach(edge => lf.deleteEdge(edge.id));
            elements.nodes.forEach(node => lf.deleteNode(node.id));
            if (currentNodeId.value && elements.nodes.find(n => n.id === currentNodeId.value)) closeDrawer();
            if (selectedEdgeId.value && elements.edges.find(e => e.id === selectedEdgeId.value)) closeDrawer();
            selectedEdgeId.value = null;
          }},
        { keys: ["ctrl + z", "meta + z"], callback: () => lf.undo() },
        { keys: ["ctrl + y", "meta + y"], callback: () => lf.redo() },
        { keys: ["ctrl + c", "meta + c"], callback: () => { lf.copy(); return false; } },
        { keys: ["ctrl + v", "meta + v"], callback: () => { lf.paste(); return false; } }
      ]
    }
  });

  lf.register({ type: 'process-node', view: LinearNodeView, model: LinearNodeModel });
  // 设置主题和事件监听 (保持不变)...
  lf.setTheme({
    bezier: { stroke: '#5c6b8f', strokeWidth: 2, adjustLineColor: '#00ff88' },
    'edge:hover': { stroke: '#fff', strokeWidth: 3 },
    'edge:selected': { stroke: '#00ff88', strokeWidth: 3 },
    anchor: { r: 4, fill: '#050608', stroke: '#4f64ff', hover: { fill: '#00ff88', stroke: '#fff', r: 6 } },
    edgeAdjust: { r: 4, fill: '#fff', stroke: '#00ff88', strokeWidth: 2 }
  });

  lf.on('connection:not-allowed', (data) => ElMessage.warning(data.msg));
  lf.on('edge:add', ({ data }) => {
    if (!/^\d+$/.test(data.id)) {
      const { edges } = lf.getGraphData();
      const validEdges = edges.filter(e => e.id !== data.id && /^\d+$/.test(e.id));
      const newId = getNewIntegerId(validEdges);
      const edgeName = data.text?.value || '';
      lf.deleteEdge(data.id);
      lf.addEdge({ id: newId, sourceNodeId: data.sourceNodeId, targetNodeId: data.targetNodeId, type: data.type, text: edgeName, properties: { edgeName } });
    }
  });

  lf.on('node:add', ({ data }) => {
    if (!/^\d+$/.test(data.id)) {
      setTimeout(() => {
        const node = lf.graphModel.getNodeModelById(data.id);
        if (node && !/^\d+$/.test(node.id)) {
          const { nodes } = lf.getGraphData();
          const validNodes = nodes.filter(n => n.id !== data.id && /^\d+$/.test(n.id));
          const newId = getNewIntegerId(validNodes);
          lf.changeNodeId(data.id, newId);
          const newNodeModel = lf.graphModel.getNodeModelById(newId);
          if (newNodeModel) newNodeModel.setProperties({ _refreshTs: Date.now() });
        }
      }, 50);
    }
  });

  lf.on('node:click', ({ data }) => {
    if (currentNodeId.value === data.id) return;
    if (currentNodeId.value) syncFormToNode();
    selectedEdgeId.value = null;
    isProgrammaticUpdate = true;
    currentNodeId.value = data.id;
    const nodeModel = lf.graphModel.getNodeModelById(String(data.id));
    const liveProps = nodeModel ? nodeModel.getProperties() : data.properties;
    const storedProps = JSON.parse(JSON.stringify(liveProps || {}));
    const newForm = getDefaultFormState();
    if (storedProps.baseOperate && storedProps.baseOperate.id) {
      const fullOp = props.baseOperates.find(op => op.id == storedProps.baseOperate.id);
      if (fullOp) storedProps.baseOperate = { ...fullOp, ...storedProps.baseOperate };
    }
    newForm.baseOperate = storedProps.baseOperate || {};
    let rawName = storedProps.nodeName || newForm.baseOperate.name || 'Node';
    rawName = rawName.replace(/\s+\(EXEC\/RESET\)$/, '').replace(/\s+\(EXEC\)$/, '').replace(/\s+\(RESET\)$/, '');
    newForm.nodeName = rawName;
    if (storedProps.exec !== undefined) newForm.exec = !!storedProps.exec;
    if (storedProps.reset !== undefined) newForm.reset = !!storedProps.reset;
    if (storedProps.loopCnt !== undefined) newForm.loopCnt = storedProps.loopCnt;
    if (storedProps.execHoldTime !== undefined) newForm.execHoldTime = storedProps.execHoldTime;
    if (storedProps.resetHoldTime !== undefined) newForm.resetHoldTime = storedProps.resetHoldTime;
    newForm.params = Array.isArray(storedProps.params) ? [...storedProps.params] : [];
    const size = newForm.baseOperate?.paramSize || 0;
    while (newForm.params.length < size) newForm.params.push('');
    Object.assign(currentNodeForm, newForm);
    nextTick(() => {
      lf.graphModel.selectElementById(data.id);
      setTimeout(() => { isProgrammaticUpdate = false; }, 20);
    });
  });

  lf.on('edge:click', ({ data }) => {
    if (currentNodeId.value) syncFormToNode();
    currentNodeId.value = null;
    selectedEdgeId.value = data.id;
    isProgrammaticUpdate = true;
    const { nodes } = lf.getGraphData();
    nodeOptions.value = nodes.map(n => ({
      id: n.id,
      name: `${n.properties?.nodeName || n.text?.value || 'Node'} (ID:${n.id})`
    }));
    currentEdgeForm.edgeName = data.properties?.edgeName || data.text?.value || '';
    currentEdgeForm.sourceNodeId = data.sourceNodeId;
    currentEdgeForm.targetNodeId = data.targetNodeId;
    nextTick(() => { setTimeout(() => { isProgrammaticUpdate = false; }, 20); });
  });

  lf.on('blank:click', () => {
    if (isDragging.value) return;
    selectedEdgeId.value = null;
    closeDrawer();
  });

  renderGraph();
};

const syncFormToNode = () => {
  if (!lf || !currentNodeId.value) return;
  const plainData = JSON.parse(JSON.stringify(toRaw(currentNodeForm)));
  const cleanName = plainData.nodeName || plainData.baseOperate?.name || 'Node';
  const model = lf.graphModel.getNodeModelById(currentNodeId.value);
  if (model) {
    model.setProperties({ ...plainData, nodeName: cleanName });
    model.updateText(cleanName);
  }
};

watch(currentEdgeForm, (val) => {
  if (isProgrammaticUpdate || !selectedEdgeId.value || !lf) return;
  const model = lf.graphModel.getEdgeModelById(selectedEdgeId.value);
  if (model) {
    model.setProperties({ edgeName: val.edgeName });
    model.updateText(val.edgeName);
  }
}, { deep: true });

watch(currentNodeForm, () => {
  if (isProgrammaticUpdate) return;
  syncFormToNode();
}, { deep: true });

const undo = () => lf && lf.undo();
const redo = () => lf && lf.redo();

const handleOperateChange = (newOpId) => {
  const selectedOp = props.baseOperates.find(op => op.id == newOpId);
  if (!selectedOp) return;
  const oldOpName = currentNodeForm.baseOperate?.name;
  const currentUserNodeName = currentNodeForm.nodeName;
  currentNodeForm.baseOperate = { ...selectedOp };
  if (!currentUserNodeName || currentUserNodeName === oldOpName) {
    currentNodeForm.nodeName = selectedOp.name;
  }
  currentNodeForm.execHoldTime = selectedOp.minExecTime || 0;
  currentNodeForm.resetHoldTime = selectedOp.minResetTime || 0;
  const size = selectedOp.paramSize || 0;
  if (selectedOp.initParams && selectedOp.initParams.length > 0) currentNodeForm.params = [...selectedOp.initParams];
  else currentNodeForm.params = new Array(size).fill('');
  if (currentNodeForm.baseOperate.needReset === false) currentNodeForm.reset = false;
};

const deleteCurrentEdge = () => {
  if (!lf || !selectedEdgeId.value) return;
  lf.deleteEdge(selectedEdgeId.value);
  selectedEdgeId.value = null;
  closeDrawer();
  ElMessage.success("连线已删除");
};

const updateEdgeConnection = () => {
  if (!lf || !selectedEdgeId.value) return;
  const oldEdgeId = selectedEdgeId.value;
  const { sourceNodeId, targetNodeId, edgeName } = currentEdgeForm;
  if (sourceNodeId === targetNodeId) return ElMessage.warning("不能连接自身");

  const { edges } = lf.getGraphData();
  const isOldIdInteger = !isNaN(parseInt(oldEdgeId));
  let newId = oldEdgeId;
  if (!isOldIdInteger) {
    const otherEdges = edges.filter(e => e.id !== oldEdgeId);
    newId = String(getNewIntegerId(otherEdges));
  }
  lf.deleteEdge(oldEdgeId);
  try {
    const newEdge = lf.addEdge({ id: newId, sourceNodeId, targetNodeId, text: edgeName, properties: { edgeName }, type: 'bezier' });
    if (newEdge) {
      selectedEdgeId.value = newEdge.id;
      nextTick(() => lf.graphModel.selectElementById(newEdge.id));
      ElMessage.success("连接关系已更新");
    }
  } catch (e) {
    ElMessage.error("连接失败，可能违反连接规则");
  }
};

const getFormattedGraphVO = () => {
  if (!lf) return null;
  if (currentNodeId.value) syncFormToNode();
  const raw = lf.getGraphData();
  const errorMsg = validateGraphData(raw.nodes, raw.edges);
  if (errorMsg) { ElMessage.error(errorMsg); return null; }
  const usedIds = new Set();
  const validEdges = [];
  const invalidEdges = [];
  raw.edges.forEach(e => {
    if (/^\d+$/.test(e.id)) {
      const idNum = parseInt(e.id);
      if (!usedIds.has(idNum)) { usedIds.add(idNum); validEdges.push({ ...e, id: String(idNum) }); return; }
    }
    invalidEdges.push(e);
  });
  let nextId = 1;
  const getNextId = () => { while(usedIds.has(nextId)) nextId++; usedIds.add(nextId); return nextId; };
  const resultEdges = [];
  validEdges.forEach(e => resultEdges.push({ edgeId: parseInt(e.id), fromNodeId: parseInt(e.sourceNodeId), nextNodeId: parseInt(e.targetNodeId), edgeName: e.properties?.edgeName || e.text?.value || '' }));
  invalidEdges.forEach(e => { const newId = getNextId(); resultEdges.push({ edgeId: newId, fromNodeId: parseInt(e.sourceNodeId), nextNodeId: parseInt(e.targetNodeId), edgeName: e.properties?.edgeName || e.text?.value || '' }); });
  const result = JSON.parse(JSON.stringify(props.graph));
  result.combinationNodes = raw.nodes.map(n => {
    const p = n.properties || {};
    return {
      nodeId: parseInt(n.id), nodeName: p.nodeName || '', baseOperate: p.baseOperate, params: p.params || [],
      execHoldTime: p.execHoldTime, resetHoldTime: p.reset ? p.resetHoldTime : 0, loopCnt: p.loopCnt, reset: !!p.reset, exec: !!p.exec,
    };
  });
  result.combinationEdges = resultEdges;
  return result;
};

const saveData = () => { const result = getFormattedGraphVO(); if (result) { emit('save', result); ElMessage.success('保存成功'); } };
const handleExec = async () => {
  const graphVO = getFormattedGraphVO(); if (!graphVO) return;
  isExecuting.value = true;
  try {
    const response = await fetch('http://localhost:8080/api/combination-graph/exec', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(graphVO) });
    if (response.ok) { const res = await response.json(); if (res.success === true) ElMessage.success(res.msg || '指令下发成功'); else ElMessage.error(res.msg || '调试请求失败'); } else { ElMessage.error('网络请求错误: ' + response.status); }
  } catch (error) { ElMessage.error('网络请求异常'); } finally { isExecuting.value = false; }
};

const handleManualLayout = () => {
  if (!lf) return;
  const { nodes: rawNodes, edges: rawEdges } = lf.getGraphData();
  if (rawNodes.length === 0) return;
  const currentNodes = rawNodes.map(n => ({ ...n.properties, nodeId: n.id }));
  const currentEdges = rawEdges.map(e => ({ edgeId: e.id, fromNodeId: e.sourceNodeId, nextNodeId: e.targetNodeId, edgeName: e.properties?.edgeName || e.text?.value }));
  const layoutData = calcSafeLayout(currentNodes, currentEdges);
  lf.render(layoutData);
  nextTick(() => { lf.translateCenter(); lf.zoom(0.9); });
  ElMessage.success('自动布局已更新');
};

const addNode = () => {
  if (!lf || !container.value) return;
  const defaultOp = availableOperates.value[0] || { name: 'ACTION', id: 999, minExecTime: 100, minResetTime: 0, paramSize: 0 };
  const newNodeVO = getDefaultFormState();
  Object.assign(newNodeVO, { baseOperate: defaultOp, nodeName: defaultOp.name, params: defaultOp.initParams ? [...defaultOp.initParams] : new Array(defaultOp.paramSize || 0).fill(''), execHoldTime: defaultOp.minExecTime || 100 });
  const { transformModel } = lf.graphModel;
  const width = container.value.clientWidth;
  const height = container.value.clientHeight;
  const startX = (-transformModel.TRANSLATE_X + width / 2) / transformModel.SCALE_X;
  const startY = (-transformModel.TRANSLATE_Y + height / 2) / transformModel.SCALE_Y;
  lf.addNode({ type: 'process-node', x: startX, y: startY, text: newNodeVO.nodeName, properties: newNodeVO });
  selectedEdgeId.value = null;
};

onMounted(() => { if (container.value) { resizeObserver = new ResizeObserver((entries) => { if (entries[0].contentRect.width > 0 && !lf && props.graph) initLF(); }); resizeObserver.observe(container.value); } });
watch(() => props.graph?.combination?.id, (v) => { if (v) nextTick(initLF); }, { immediate: true });
onBeforeUnmount(() => { if (lf) lf.destroy(); resizeObserver?.disconnect(); document.removeEventListener('mousemove', onDrag); document.removeEventListener('mouseup', stopDrag); });
</script>

<style scoped>
/* 样式保持不变 */
.canvas-area { background: #050608 radial-gradient(rgba(79, 100, 255, 0.05) 1px, transparent 1px); background-size: 30px 30px; display: flex; flex-direction: column; flex: 1; overflow: hidden; height: 100vh; position: relative; }
.canvas-wrapper { height: 100%; display: flex; flex-direction: column; }
.canvas-header { padding: 20px 30px; background: rgba(13, 15, 23, 0.9); border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; justify-content: space-between; align-items: flex-start; z-index: 10; overflow-x: auto; }
.header-main-info { display: flex; flex-direction: column; gap: 12px; flex: 1; min-width: 0; }
.active-info { display: flex; align-items: center; gap: 12px; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: #00ff88; }
.pulsed { box-shadow: 0 0 10px #00ff88; animation: pulse 2s infinite; }
.inline-edit-title { background: transparent; border: none; border-bottom: 1px solid transparent; color: #fff; font-size: 1.1rem; font-weight: bold; outline: none; width: 250px; }
.inline-edit-title:focus { border-bottom-color: #4f64ff; }
.proj-name { font-size: 0.75rem; color: #4f64ff; font-weight: bold; margin-left: 10px; }
.description-edit-area { width: auto; flex: 1; max-width: 600px; min-width: 200px; }
.desc-label { font-size: 0.6rem; color: #444; font-weight: bold; letter-spacing: 1px; margin-bottom: 6px; display: block; }
.inline-edit-desc { width: 100%; background: rgba(255, 255, 255, 0.02); border: 1px solid transparent; border-radius: 8px; color: #888; font-size: 0.85rem; padding: 10px; resize: none; outline: none; transition: 0.3s; line-height: 1.5; font-family: inherit; }
.inline-edit-desc:focus { background: #000; border-color: rgba(79, 100, 255, 0.4); color: #ccc; }
.canvas-ops { display: flex; align-items: center; gap: 12px; margin-top: 5px; flex-shrink: 0; }
.edit-toolbar { display: flex; gap: 10px; align-items: center; }
.btn-tool { background: rgba(79, 100, 255, 0.1); border: 1px solid rgba(79, 100, 255, 0.3); color: #4f64ff; padding: 6px 14px; border-radius: 6px; font-size: 0.7rem; font-weight: bold; cursor: pointer; transition: 0.3s; white-space: nowrap; }
.btn-tool:hover { background: #4f64ff; color: #fff; }
.btn-solid-orange {
  background: #ff9f43;
  color: #000;
  border: none;
  padding: 8px 18px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 800;
  cursor: pointer;
  transition: 0.3s;
  white-space: nowrap;
}
.btn-solid-orange:hover:not(:disabled) { filter: brightness(1.1); }
.btn-solid-orange:disabled { opacity: 0.6; cursor: not-allowed; }
.small-icon { padding: 6px 10px; font-size: 1rem; min-width: 34px; }
.btn-delete-block {
  width: 100%;
  background: rgba(255, 84, 96, 0.1);
  border: 1px solid rgba(255, 84, 96, 0.3);
  color: #ff5460;
  padding: 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
}
.btn-delete-block:hover {
  background: rgba(255, 84, 96, 0.2);
  border-color: #ff5460;
}
.center-icon {
  text-align: center;
  color: #4f64ff;
  font-size: 1.2rem;
  font-weight: bold;
  margin: -5px 0;
  opacity: 0.8;
}
.btn-disabled { opacity: 0.3; cursor: not-allowed; background: rgba(255, 255, 255, 0.05); color: #555; border-color: #333; }
.divider { width: 1px; height: 24px; background: #222; margin: 0 5px; }
.btn-ghost { background: transparent; border: 1px solid #222; color: #888; padding: 8px 18px; border-radius: 6px; font-size: 0.75rem; cursor: pointer; }
.btn-solid-green { background: #00ff88; color: #000; border: none; padding: 8px 18px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; }
.flow-preview { flex: 1; position: relative; background: #050608; }
.lf-container { width: 100%; height: 100%; outline: none; }
.canvas-hint { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); font-size: 0.65rem; color: #444; letter-spacing: 1px; pointer-events: none; }
.empty-canvas { margin: auto; text-align: center; }
.scanner-circle { width: 100px; height: 100px; border: 2px solid #111; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; position: relative; }
.scanner-circle::after { content: ''; position: absolute; top: -2px; left: -2px; width: 102px; height: 102px; border: 2px solid #4f64ff; border-radius: 50%; border-top-color: transparent; animation: spin 2s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
:deep(.lf-anchor) { visibility: visible !important; opacity: 0.6; transition: all 0.2s; cursor: crosshair; }
:deep(.lf-node-container:hover .lf-anchor), :deep(.lf-anchor:hover) { opacity: 1; fill: #00ff88 !important; stroke: #fff !important; stroke-width: 2px !important; r: 6px !important; }

/* 配置抽屉样式 */
.config-drawer {
  position: absolute; width: 320px; max-height: 500px;
  background: rgba(20, 23, 31, 0.98); backdrop-filter: blur(12px); border: 1px solid rgba(79, 100, 255, 0.2); border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.8);
  z-index: 100; display: flex; flex-direction: column; overflow: hidden;
}
.drawer-header { flex-shrink: 0; padding: 16px 20px; background: rgba(79, 100, 255, 0.08); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; cursor: move; user-select: none; }
.drawer-header:active { cursor: grabbing; background: rgba(79, 100, 255, 0.15); }
.drawer-header h3 { margin: 0; color: #fff; font-size: 0.9rem; font-weight: 600; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px;}
.drag-hint { font-size: 0.6rem; color: #666; font-weight: normal; }
.close-btn { background: none; border: none; color: #666; font-size: 1.2rem; cursor: pointer; transition: 0.2s; padding: 0 4px; }
.close-btn:hover { color: #fff; }
.drawer-content { padding: 20px; flex: 1; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #333 transparent; }
.drawer-content::-webkit-scrollbar { width: 6px; }
.drawer-content::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
.special-hint { text-align: center; color: #555; margin-top: 40px; }
.special-hint .icon { font-size: 2.5rem; display: block; margin-bottom: 10px; opacity: 0.5; }
.special-hint .sub-text { font-size: 0.7rem; }
.form-container { display: flex; flex-direction: column; gap: 16px; padding-bottom: 10px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 0.7rem; color: #888; font-weight: bold; letter-spacing: 0.5px; }
.input-wrapper { position: relative; display: flex; align-items: center; }
.suffix { position: absolute; right: 10px; font-size: 0.65rem; color: #444; pointer-events: none; }
.input-dark { width: 100%; background: #0a0c10; border: 1px solid #333; color: #eee; padding: 9px 10px; border-radius: 4px; font-size: 0.85rem; outline: none; transition: 0.2s; box-sizing: border-box; }
select.input-dark { appearance: none; cursor: pointer; }
.select-arrow { background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e"); background-repeat: no-repeat; background-position: right 10px center; background-size: 16px; padding-right: 30px; }
.input-dark:focus { border-color: #4f64ff; background: #000; }
.divider-line { height: 1px; background: rgba(255,255,255,0.05); margin: 5px 0; }
.empty-hint { font-size: 0.75rem; color: #444; font-style: italic; text-align: center; padding: 10px; }
.row-center { flex-direction: row; justify-content: space-between; align-items: center; }
.switch-box { position: relative; width: 36px; height: 18px; }
.switch-box input { opacity: 0; width: 0; height: 0; }
.toggle { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .4s; border-radius: 20px; }
.toggle:before { position: absolute; content: ""; height: 14px; width: 14px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; }
input:checked + .toggle { background-color: #4f64ff; }
input:checked + .toggle:before { transform: translateX(18px); }
.slide-in { animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
</style>