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
            <button class="btn-tool small-icon" @click="undo" title="Undo (Ctrl+Z)">↩ UNDO</button>
            <button class="btn-tool small-icon" @click="redo" title="Redo (Ctrl+Y)">↪ REDO</button>
            <div class="divider"></div>
            <button class="btn-tool" @click="handleManualLayout">⚡ AUTO LAYOUT</button>
            <button class="btn-tool" @click="addNode">＋ INSERT NODE</button>
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
            v-if="currentNodeId"
            class="config-drawer"
            ref="drawerRef"
            :style="drawerStyle"
            @mousedown.stop
            @click.stop
        >
          <div class="drawer-header" @mousedown="startDrag">
            <h3>节点参数配置 <span class="drag-hint">(按住拖动)</span></h3>
            <button class="close-btn" @click.stop="closeDrawer">×</button>
          </div>

          <div class="drawer-content">
            <div v-if="isSpecialNode" class="special-hint">
              <span class="icon">🔒</span>
              <p>系统控制节点<br><span class="sub-text">无需配置任何参数</span></p>
            </div>

            <div v-else class="form-container">
              <div class="form-group">
                <label>操作名称 (Operation)</label>
                <select
                    :value="currentNodeForm.baseOperate?.id"
                    @change="handleOperateChange($event.target.value)"
                    class="input-dark select-arrow"
                >
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
                <div
                    v-for="(pName, idx) in currentNodeForm.baseOperate.paramNames"
                    :key="idx"
                    class="form-group"
                >
                  <label>{{ pName }}</label>
                  <input
                      type="text"
                      v-model="currentNodeForm.params[idx]"
                      class="input-dark"
                      :placeholder="currentNodeForm.baseOperate.initParams?.[idx] || 'Value'"
                  />
                </div>
              </div>
              <div v-else class="empty-hint">此操作无额外动态参数</div>
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

// --- 🔧 表单状态管理 ---
const currentNodeId = ref(null);
let isProgrammaticUpdate = false;

const getDefaultFormState = () => ({
  baseOperate: {},
  params: [],
  execHoldTime: 0,
  resetHoldTime: 0,
  loopCnt: 1,
  exec: false,
  reset: false
});
const currentNodeForm = reactive(getDefaultFormState());

// --- 🌟 拖拽逻辑 ---
const drawerRef = ref(null);
const drawerPos = reactive({ x: null, y: null });
const isDragging = ref(false);
const dragOffset = { x: 0, y: 0 };

const drawerStyle = computed(() => {
  if (drawerPos.x === null || drawerPos.y === null) {
    return { top: '20px', right: '20px', left: 'auto' };
  }
  return { top: `${drawerPos.y}px`, left: `${drawerPos.x}px`, right: 'auto', transform: 'none' };
});

const startDrag = (e) => {
  if (!drawerRef.value || !flowPreviewRef.value) return;
  isDragging.value = true;
  const drawerRect = drawerRef.value.getBoundingClientRect();
  const parentRect = flowPreviewRef.value.getBoundingClientRect();

  if (drawerPos.x === null) {
    drawerPos.x = drawerRect.left - parentRect.left;
    drawerPos.y = drawerRect.top - parentRect.top;
  }
  dragOffset.x = e.clientX - drawerRect.left;
  dragOffset.y = e.clientY - drawerRect.top;

  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
};

const onDrag = (e) => {
  if (!isDragging.value || !flowPreviewRef.value) return;
  const parentRect = flowPreviewRef.value.getBoundingClientRect();
  let newX = e.clientX - parentRect.left - dragOffset.x;
  let newY = e.clientY - parentRect.top - dragOffset.y;
  if (newY < 0) newY = 0;
  if (newX < 0) newX = 0;
  const maxW = parentRect.width - 50;
  const maxH = parentRect.height - 50;
  if (newX > maxW) newX = maxW;
  if (newY > maxH) newY = maxH;
  drawerPos.x = newX;
  drawerPos.y = newY;
};

const stopDrag = () => {
  isDragging.value = false;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
};

// --- 计算属性 ---
const availableOperates = computed(() => {
  return props.baseOperates.filter(op => !['START', '开始', 'END', '结束'].includes((op.name || '').toUpperCase()));
});

const isSpecialNode = computed(() => {
  const name = (currentNodeForm.baseOperate?.name || '').toUpperCase();
  return ['START', '开始', 'END', '结束'].includes(name);
});

// --- 🛡️ 辅助函数 ---
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

// 🌟 辅助：获取新的自增整数 ID (字符串形式)
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
    node:  { main: '#4F64FF', bg: 'rgba(79, 100, 255, 0.10)', border: '#4F64FF' }
  }
};

const getNodeTheme = (text) => {
  const t = (text || '').toUpperCase();
  if (['START', '开始', 'BEGIN'].includes(t)) return UI_CONFIG.colors.start;
  if (['END', '结束', 'STOP'].includes(t)) return UI_CONFIG.colors.end;
  return UI_CONFIG.colors.node;
};

class LinearNodeView extends RectNode {
  getLabelShape() { return h('g'); }
  getShape() {
    const { model } = this.props;
    // 🌟 解构获取 id 用于显示
    const { x, y, width, height, isSelected, id } = model;
    const properties = model.getProperties();
    const baseName = properties.baseOperate?.name || 'Unknown';
    const textValue = model.text?.value || baseName;
    const theme = getNodeTheme(baseName);
    const xPos = x - width / 2;
    const yPos = y - height / 2;
    const strokeColor = isSelected ? '#FFFFFF' : theme.border;
    const strokeWidth = isSelected ? 2 : 1;

    const bgRect = h('rect', { x: xPos, y: yPos, width, height, rx: UI_CONFIG.radius, fill: '#181B24', stroke: strokeColor, strokeWidth, strokeOpacity: isSelected ? 1 : 0.6 });
    const colorStrip = h('rect', { x: xPos + 4, y: yPos + 4, width: 4, height: height - 8, rx: 2, fill: theme.main, pointerEvents: 'none' });
    const glowRect = h('rect', { x: xPos, y: yPos, width, height, rx: UI_CONFIG.radius, fill: theme.bg, stroke: 'none', pointerEvents: 'none' });

    // 🌟 核心修改：根据节点类型决定显示图标还是 ID
    let iconContent;
    const t = baseName.toUpperCase();
    const isSpecial = ['START', '开始', 'END', '结束'].includes(t);

    if (isSpecial) {
      // 特殊节点显示图标
      let iconPath = '';
      if (['START', '开始'].includes(t)) iconPath = 'M 6 4 L 14 10 L 6 16 Z';
      else iconPath = 'M 6 6 L 14 6 L 14 14 L 6 14 Z';
      iconContent = h('path', { d: iconPath, fill: theme.main });
    } else {
      // 🌟 业务节点：在图标位置居中显示 ID
      iconContent = h('text', {
        x: 10, y: 10, // 20x20 容器中心
        fill: theme.main,
        fontSize: 12,
        fontWeight: 'bold',
        textAnchor: 'middle',
        dominantBaseline: 'central',
        style: 'font-family: monospace; pointer-events: none;'
      }, [String(id)]);
    }

    const iconGroup = h('g', { transform: `translate(${xPos + 20}, ${yPos + height/2 - 10})`, pointerEvents: 'none' }, [
      h('rect', { width: 20, height: 20, fill: 'transparent' }),
      iconContent
    ]);

    const textLabel = h('text', {
      x: xPos + 48, y: yPos + height / 2,
      fontSize: 12,
      fill: '#ECECEC', fontWeight: 'bold', pointerEvents: 'none', dominantBaseline: 'middle',
      style: 'text-shadow: 0 1px 2px rgba(0,0,0,0.8); font-family: sans-serif;'
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
      this.properties.baseOperate = { name: data.text?.value || data.text || 'Node', id: 0 };
    }
    const props = this.properties;
    const baseName = props.baseOperate.name || 'Node';
    let suffix = '';
    if (props.exec && props.reset) suffix = '(EXEC/RESET)';
    else if (props.exec) suffix = '(EXEC)';
    else if (props.reset) suffix = '(RESET)';
    const fullName = `${baseName}${suffix ? ` ${suffix}` : ''}`;
    this.text = { value: fullName, x: data.x, y: data.y };
  }
  getDefaultAnchor() {
    const { x, y, width, id, properties } = this;
    const t = (properties.baseOperate?.name || '').toUpperCase();
    const anchors = [];
    if (!['START', '开始'].includes(t)) anchors.push({ x: x - width/2, y, id: `${id}_in`, type: 'left', edgeAddable: false });
    if (!['END', '结束'].includes(t)) anchors.push({ x: x + width/2, y, id: `${id}_out`, type: 'right', edgeAddable: true });
    return anchors;
  }
  getConnectedTargetRules() {
    const rules = super.getConnectedTargetRules();
    rules.push({ message: '非法连接：只能连接到节点的[左侧]锚点', validate: (s, t, sa, ta) => ta && ta.type === 'left' });
    rules.push({ message: '非法连接：检测到闭环，系统不支持循环依赖', validate: (s, t) => !checkPathExist(t.id, s.id, this.graphModel.modelToGraphData()) });
    return rules;
  }
}

// --- 初始化与事件 ---
const initLF = () => {
  if (!container.value || !container.value.clientWidth) return;
  if (lf) { try{ lf.destroy(); }catch(e){} lf = null; }

  const plugins = [Extension.SelectionSelect, Extension.Bezier, Extension.Snapshot].filter(Boolean);
  lf = new LogicFlow({
    container: container.value,
    config: {
      maxZoom: 1.1,
      minZoom: 0.5,
      // 🌟 核心配置：设置全局 ID 生成器，确保 API 添加或拖拽时使用数字 ID
      idGenerator: (type) => {
        if (!lf) return '1';
        const { nodes, edges } = lf.getGraphData();
        const collection = type === 'process-node' ? nodes : edges;
        return getNewIntegerId(collection);
      }
    },
    grid: { size: 20, visible: true, type: 'mesh', config: { color: '#1a1a1a', thickness: 1 } },
    background: { color: 'transparent' },
    edgeType: 'bezier',
    hoverOutline: false,
    adjustEdge: false,
    plugins: plugins,
    keyboard: {
      enabled: true,
      shortcuts: [
        {
          keys: ["delete", "backspace"],
          callback: () => {
            const activeTag = document.activeElement.tagName;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) return;
            const elements = lf.getSelectElements(true);
            lf.clearSelectElements();
            elements.edges.forEach(edge => lf.deleteEdge(edge.id));
            elements.nodes.forEach(node => lf.deleteNode(node.id));
            if (currentNodeId.value && elements.nodes.find(n => n.id === currentNodeId.value)) closeDrawer();
            selectedEdgeId.value = null;
          }
        },
        { keys: ["ctrl + z", "meta + z"], callback: () => lf.undo() },
        { keys: ["ctrl + y", "meta + y"], callback: () => lf.redo() },
        // 🌟 显式绑定复制粘贴，确保功能可用
        { keys: ["ctrl + c", "meta + c"], callback: () => { lf.copy(); return false; } },
        { keys: ["ctrl + v", "meta + v"], callback: () => { lf.paste(); return false; } }
      ]
    }
  });

  lf.register({ type: 'process-node', view: LinearNodeView, model: LinearNodeModel });
  lf.setTheme({
    bezier: { stroke: '#5c6b8f', strokeWidth: 2, adjustLineColor: '#00ff88' },
    'edge:hover': { stroke: '#fff', strokeWidth: 3 },
    'edge:selected': { stroke: '#00ff88', strokeWidth: 3 },
    anchor: { r: 4, fill: '#050608', stroke: '#4f64ff', hover: { fill: '#00ff88', stroke: '#fff', r: 6 } }
  });

  lf.on('connection:not-allowed', (data) => ElMessage.warning(data.msg));

  // --- 🌟 核心监听1：边创建拦截（防UUID） ---
  lf.on('edge:add', ({ data }) => {
    if (!/^\d+$/.test(data.id)) {
      const { edges } = lf.getGraphData();
      // 排除自身，计算合法最大ID
      const validEdges = edges.filter(e => e.id !== data.id && /^\d+$/.test(e.id));
      const newId = getNewIntegerId(validEdges);

      lf.deleteEdge(data.id);
      lf.addEdge({
        id: newId,
        sourceNodeId: data.sourceNodeId,
        targetNodeId: data.targetNodeId,
        type: data.type,
        text: data.text?.value || ''
      });
    }
  });

  // --- 🌟 核心监听2：节点创建拦截（兼容复制粘贴生成的UUID） ---
  lf.on('node:add', ({ data }) => {
    // 如果是粘贴产生的非数字 ID
    if (!/^\d+$/.test(data.id)) {
      // 延迟执行，等待关联的边也被粘贴进来
      setTimeout(() => {
        const node = lf.graphModel.getNodeModelById(data.id);
        // 二次确认ID仍然非法
        if (node && !/^\d+$/.test(node.id)) {
          const { nodes } = lf.getGraphData();
          const validNodes = nodes.filter(n => n.id !== data.id && /^\d+$/.test(n.id));
          const newId = getNewIntegerId(validNodes);

          // changeNodeId 会自动更新关联边的 source/target
          lf.changeNodeId(data.id, newId);
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

  lf.on('edge:click', ({ data }) => { selectedEdgeId.value = data.id; closeDrawer(); });
  lf.on('blank:click', () => {
    if (isDragging.value) return;
    selectedEdgeId.value = null;
    closeDrawer();
  });

  renderGraph();
};

const closeDrawer = () => {
  if(currentNodeId.value) syncFormToNode();
  currentNodeId.value = null;
  if(lf) lf.graphModel.selectElementById(null);
};

const syncFormToNode = () => {
  if (!lf || !currentNodeId.value) return;
  const plainData = JSON.parse(JSON.stringify(toRaw(currentNodeForm)));
  let suffix = '';
  if (plainData.exec && plainData.reset) suffix = '(EXEC/RESET)';
  else if (plainData.exec) suffix = '(EXEC)';
  else if (plainData.reset) suffix = '(RESET)';
  const baseName = plainData.baseOperate?.name || 'Node';
  const fullName = `${baseName}${suffix ? ` ${suffix}` : ''}`;

  const model = lf.graphModel.getNodeModelById(currentNodeId.value);
  if (model) {
    model.setProperties(plainData);
    model.updateText(fullName);
  }
};

watch(currentNodeForm, () => {
  if (isProgrammaticUpdate) return;
  syncFormToNode();
}, { deep: true });

const undo = () => lf && lf.undo();
const redo = () => lf && lf.redo();

const handleOperateChange = (newOpId) => {
  const selectedOp = props.baseOperates.find(op => op.id == newOpId);
  if (!selectedOp) return;
  currentNodeForm.baseOperate = { ...selectedOp };
  currentNodeForm.execHoldTime = selectedOp.minExecTime || 0;
  currentNodeForm.resetHoldTime = selectedOp.minResetTime || 0;
  const size = selectedOp.paramSize || 0;
  if (selectedOp.initParams && selectedOp.initParams.length > 0) currentNodeForm.params = [...selectedOp.initParams];
  else currentNodeForm.params = new Array(size).fill('');
  if (currentNodeForm.baseOperate.needReset === false) currentNodeForm.reset = false;
};

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
      let suffix = '';
      if (props.exec && props.reset) suffix = '(EXEC/RESET)';
      else if (props.exec) suffix = '(EXEC)';
      else if (props.reset) suffix = '(RESET)';
      const displayText = `${props.baseOperate.name}${suffix ? ` ${suffix}` : ''}`;
      return {
        id: String(n.nodeId), type: 'process-node',
        x: pos ? pos.x : 150 + i*50, y: pos ? pos.y : 150 + i*50,
        text: displayText,
        properties: props
      };
    }),
    edges: edges.map((e, i) => ({
      id: e.edgeId ? String(e.edgeId) : String(i + 1),
      type: 'bezier', sourceNodeId: String(e.fromNodeId), targetNodeId: String(e.nextNodeId),
      text: e.text || ''
    }))
  };
};

const renderGraph = () => {
  if (!lf) return;
  let nodes = props.graph?.combinationNodes || [];
  let edges = props.graph?.combinationEdges || [];
  if (nodes.length === 0 && lf.getGraphData().nodes.length > 0) {
    const d = lf.getGraphData();
    nodes = d.nodes.map(n => ({...n.properties, nodeId: n.id}));
    edges = d.edges.map(e => ({fromNodeId: e.sourceNodeId, nextNodeId: e.targetNodeId, edgeId: e.id}));
  }
  const data = calcSafeLayout(nodes, edges);
  lf.render(data);
  nextTick(() => { if(data.nodes.length) { lf.translateCenter(); lf.zoom(0.9); } });
};

const addNode = () => {
  if (!lf) return;
  const { nodes } = lf.getGraphData();
  const defaultOp = availableOperates.value[0] || { name: 'ACTION', id: 999, minExecTime: 100, minResetTime: 0, paramSize: 0 };

  const newNodeVO = getDefaultFormState();
  Object.assign(newNodeVO, {
    baseOperate: defaultOp,
    params: defaultOp.initParams ? [...defaultOp.initParams] : new Array(defaultOp.paramSize || 0).fill(''),
    execHoldTime: defaultOp.minExecTime || 100
  });

  let startX = 200;
  let startY = 200;
  if (nodes.length > 0) {
    const rightMostNode = nodes.reduce((prev, curr) => (curr.x > prev.x ? curr : prev), nodes[0]);
    startX = rightMostNode.x + 220;
    startY = rightMostNode.y;
  }

  // 🌟 使用全局配置的 idGenerator 自动生成数字 ID
  const newNode = lf.addNode({
    type: 'process-node',
    x: startX,
    y: startY,
    text: defaultOp.name,
    properties: newNodeVO
  });

  selectedEdgeId.value = null;
  nextTick(() => {
    isProgrammaticUpdate = true;
    lf.graphModel.selectElementById(newNode.id);
    lf.focusOnNode(newNode.id);
    currentNodeId.value = newNode.id;
    Object.assign(currentNodeForm, getDefaultFormState());
    Object.assign(currentNodeForm, newNodeVO);
    setTimeout(() => { isProgrammaticUpdate = false; }, 20);
  });
};

const validateGraphData = (nodes, edges) => {
  const edgeMap = { in: {}, out: {} };
  nodes.forEach(n => { edgeMap.in[n.id] = 0; edgeMap.out[n.id] = 0; });
  edges.forEach(e => {
    if (edgeMap.out[e.sourceNodeId] !== undefined) edgeMap.out[e.sourceNodeId]++;
    if (edgeMap.in[e.targetNodeId] !== undefined) edgeMap.in[e.targetNodeId]++;
  });

  for (const node of nodes) {
    const props = node.properties || {};
    const name = (props.baseOperate?.name || node.text?.value || '').toUpperCase();
    const isStart = ['START', '开始'].includes(name);
    const isEnd = ['END', '结束'].includes(name);
    const inCount = edgeMap.in[node.id];
    const outCount = edgeMap.out[node.id];

    if (isStart) {
      if (inCount > 0) return `Start节点(${name}) 不允许有入边`;
      if (outCount === 0) return `Start节点(${name}) 必须有出边`;
    } else if (isEnd) {
      if (outCount > 0) return `End节点(${name}) 不允许有出边`;
      if (inCount === 0) return `End节点(${name}) 必须有入边`;
    } else {
      if (inCount === 0) return `中间节点(${name}) 必须有入边`;
      if (outCount === 0) return `中间节点(${name}) 必须有出边`;
      if (!props.exec && !props.reset) {
        return `配置错误：中间节点 [${name}] 必须开启 '执行(exec)' 或 '重置(reset)' 至少一项`;
      }
    }
  }
  return null;
};

const saveData = () => {
  if (!lf) return;
  if (currentNodeId.value) syncFormToNode();
  const raw = lf.getGraphData();
  const errorMsg = validateGraphData(raw.nodes, raw.edges);
  if (errorMsg) {
    ElMessage.error(errorMsg);
    return;
  }

  // --- 🌟 核心4：保存时双重清洗 Edge ID (非空/唯一/数字) ---
  const usedIds = new Set();
  const validEdges = [];
  const invalidEdges = [];

  // 1. 优先保留合法数字 ID
  raw.edges.forEach(e => {
    if (/^\d+$/.test(e.id)) {
      const idNum = parseInt(e.id);
      if (!usedIds.has(idNum)) {
        usedIds.add(idNum);
        validEdges.push({ ...e, id: String(idNum) });
        return;
      }
    }
    invalidEdges.push(e); // 收集非法或重复 ID
  });

  // 2. 为非法/重复 ID 分配新值
  let nextId = 1;
  const getNextId = () => {
    while(usedIds.has(nextId)) nextId++;
    usedIds.add(nextId);
    return nextId;
  };

  const resultEdges = [];
  validEdges.forEach(e => resultEdges.push({
    edgeId: parseInt(e.id),
    fromNodeId: parseInt(e.sourceNodeId),
    nextNodeId: parseInt(e.targetNodeId),
    text: e.text?.value || ''
  }));

  // 修复无效边
  invalidEdges.forEach(e => {
    const newId = getNextId();
    resultEdges.push({
      edgeId: newId,
      fromNodeId: parseInt(e.sourceNodeId),
      nextNodeId: parseInt(e.targetNodeId),
      text: e.text?.value || ''
    });
  });

  const result = JSON.parse(JSON.stringify(props.graph));
  result.combinationNodes = raw.nodes.map(n => {
    const p = n.properties || {};
    return {
      nodeId: parseInt(n.id),
      baseOperate: p.baseOperate,
      params: p.params || [],
      execHoldTime: p.execHoldTime,
      resetHoldTime: p.reset ? p.resetHoldTime : null,
      loopCnt: p.loopCnt,
      reset: !!p.reset,
      exec: !!p.exec,
    };
  });
  result.combinationEdges = resultEdges;
  emit('save', result);
  ElMessage.success('保存成功');
};

const handleManualLayout = () => {
  if (!lf) return;
  const { nodes: rawNodes, edges: rawEdges } = lf.getGraphData();
  if (rawNodes.length === 0) return;
  const currentNodes = rawNodes.map(n => ({ ...n.properties, nodeId: n.id }));
  const currentEdges = rawEdges.map(e => ({ edgeId: e.id, fromNodeId: e.sourceNodeId, nextNodeId: e.targetNodeId }));
  const layoutData = calcSafeLayout(currentNodes, currentEdges);
  lf.render(layoutData);
  nextTick(() => { lf.translateCenter(); lf.zoom(0.9); });
  ElMessage.success('自动布局已更新');
};

onMounted(() => {
  if (container.value) {
    resizeObserver = new ResizeObserver((entries) => {
      if (entries[0].contentRect.width > 0 && !lf && props.graph) initLF();
    });
    resizeObserver.observe(container.value);
  }
});
watch(() => props.graph?.combination?.id, (v) => { if (v) nextTick(initLF); }, { immediate: true });
onBeforeUnmount(() => { if (lf) lf.destroy(); resizeObserver?.disconnect(); document.removeEventListener('mousemove', onDrag); document.removeEventListener('mouseup', stopDrag); });
</script>

<style scoped>
/* 样式保持不变 */
.canvas-area { background: #050608 radial-gradient(rgba(79, 100, 255, 0.05) 1px, transparent 1px); background-size: 30px 30px; display: flex; flex-direction: column; flex: 1; overflow: hidden; height: 100vh; position: relative; }
.canvas-wrapper { height: 100%; display: flex; flex-direction: column; }
.canvas-header { padding: 20px 30px; background: rgba(13, 15, 23, 0.9); border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; justify-content: space-between; align-items: flex-start; z-index: 10; }
.header-main-info { display: flex; flex-direction: column; gap: 12px; }
.active-info { display: flex; align-items: center; gap: 12px; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: #00ff88; }
.pulsed { box-shadow: 0 0 10px #00ff88; animation: pulse 2s infinite; }
.inline-edit-title { background: transparent; border: none; border-bottom: 1px solid transparent; color: #fff; font-size: 1.1rem; font-weight: bold; outline: none; width: 250px; }
.inline-edit-title:focus { border-bottom-color: #4f64ff; }
.proj-name { font-size: 0.75rem; color: #4f64ff; font-weight: bold; margin-left: 10px; }
.description-edit-area { width: 450px; }
.desc-label { font-size: 0.6rem; color: #444; font-weight: bold; letter-spacing: 1px; margin-bottom: 6px; display: block; }
.inline-edit-desc { width: 100%; background: rgba(255, 255, 255, 0.02); border: 1px solid transparent; border-radius: 8px; color: #888; font-size: 0.85rem; padding: 10px; resize: none; outline: none; transition: 0.3s; line-height: 1.5; font-family: inherit; }
.inline-edit-desc:focus { background: #000; border-color: rgba(79, 100, 255, 0.4); color: #ccc; }
.canvas-ops { display: flex; align-items: center; gap: 12px; margin-top: 5px; }
.edit-toolbar { display: flex; gap: 10px; align-items: center; }
.btn-tool { background: rgba(79, 100, 255, 0.1); border: 1px solid rgba(79, 100, 255, 0.3); color: #4f64ff; padding: 6px 14px; border-radius: 6px; font-size: 0.7rem; font-weight: bold; cursor: pointer; transition: 0.3s; white-space: nowrap; }
.btn-tool:hover { background: #4f64ff; color: #fff; }
.small-icon { padding: 6px 10px; font-size: 1rem; min-width: 34px; }
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