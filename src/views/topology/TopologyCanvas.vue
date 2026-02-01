<template>
  <main class="canvas-area" @click="closeGlobalDropdowns" @contextmenu="closeGlobalDropdowns">
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
          {{ selectedEdgeId ? '已选中连线：按Delete可删除' : '规则：左侧(In) 只进不出 • 右侧(Out) 只出不进' }}
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
              {{ currentNodeId ? '节点配置' : '连线属性配置' }}
              <span class="drag-hint">(按住拖动)</span>
            </h3>
            <button class="close-btn" @click.stop="closeDrawer">×</button>
          </div>

          <div class="drawer-content" @scroll="closeGlobalDropdowns">
            <div v-if="currentNodeId">

              <div v-if="isStartNode" class="special-node-info">
                <div class="icon-circle start-icon">🚀</div>
                <h4>流程开始 (START)</h4>
                <div class="info-row">
                  <span>ID: {{ currentNodeId }}</span>
                  <span class="tag">System</span>
                </div>
                <p class="desc-text">此节点为流程唯一入口<br>不支持配置参数或追加后续操作</p>
              </div>

              <div v-else class="form-container">
                <div class="section-block">
                  <div class="form-group">
                    <label>节点名称 (Node Name)</label>
                    <input type="text" v-model="currentNodeForm.nodeName" class="input-dark" placeholder="默认取首个操作名称" />
                  </div>
                  <div class="row-2-col">
                    <div class="form-group">
                      <label>循环次数 (Loop)</label>
                      <input type="number" v-model.number="currentNodeForm.loopCnt" class="input-dark" min="1" />
                    </div>
                    <div class="form-group">
                      <label>执行时间 (毫秒)</label>
                      <input type="number" v-model.number="currentNodeForm.execHoldTime" class="input-dark" min="0" placeholder="0" />
                    </div>
                  </div>
                </div>

                <div class="divider-line"></div>
                <label class="section-title">操作序列 (OPERATIONS)</label>

                <div class="ops-list">
                  <div
                      v-for="(opItem, index) in currentNodeForm.operationList"
                      :key="opItem._key"
                      class="op-card"
                  >
                    <div class="op-card-header">
                      <span class="op-index">Step {{ index + 1 }}</span>
                      <button class="btn-icon-del" @click="removeOperation(index)" v-if="currentNodeForm.operationList.length > 1" title="删除此步骤">×</button>
                    </div>

                    <div class="form-group">
                      <label>动作类型 (Type)</label>
                      <div class="custom-select-trigger" @click.stop="(e) => openOpTypeDropdown(e, opItem, index)">
                        <div class="select-content" :class="{ 'is-active': globalDropdown.currentTrigger === opItem._key }">
                          <span>{{ getOpName(opItem.baseOperateId) }}</span>
                          <span class="arrow">▼</span>
                        </div>
                      </div>
                    </div>

                    <div class="form-group row-center" style="margin-top: 8px;" v-if="getOpConfig(opItem.baseOperateId)?.needReset">
                      <label class="sub-label">重置操作 (reset)</label>
                      <div class="switch-box">
                        <input type="checkbox" :id="`reset-${opItem._key}`" v-model="opItem.isReset" />
                        <label :for="`reset-${opItem._key}`" class="toggle"></label>
                      </div>
                    </div>

                    <div class="form-group row-center" style="margin-top: 8px;" v-if="getOpConfig(opItem.baseOperateId)?.needReset">
                      <label class="sub-label">自动重置 (autoReset)</label>
                      <div class="switch-box">
                        <input type="checkbox" :id="`auto-reset-${opItem._key}`" v-model="opItem.isAutoReset" />
                        <label :for="`auto-reset-${opItem._key}`" class="toggle"></label>
                      </div>
                    </div>

                    <div v-if="getOpConfig(opItem.baseOperateId)?.paramSize > 0 && !opItem.isReset" class="params-area">
                      <div
                          v-for="(pName, pIdx) in getOpConfig(opItem.baseOperateId).paramNames"
                          :key="pIdx"
                          class="form-group small-gap"
                      >
                        <label class="sub-label">{{ pName }}</label>
                        <input
                            type="text"
                            v-model="opItem.params[pIdx]"
                            class="input-dark input-sm"
                            :placeholder="getOpConfig(opItem.baseOperateId).initParams?.[pIdx] || 'Value'"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <button class="btn-add-op" @click="addOperation">
                  <span>＋ 追加后续操作 (Add Step)</span>
                </button>
              </div>
            </div>

            <div v-else-if="selectedEdgeId" class="form-container">
              <div class="special-node-info" style="margin: 0 0 20px 0; padding: 15px;">
                <div class="icon-circle edge-icon">🔗</div>
                <div class="info-row">
                  <span>Edge ID: {{selectedEdgeId}}</span>
                </div>
              </div>
              <div class="form-group">
                <label>连线名称 (Edge Name)</label>
                <input type="text" v-model="currentEdgeForm.edgeName" class="input-dark" placeholder="输入连线名称" />
              </div>
              <div class="divider-line"></div>
              <div class="form-group">
                <label>起始节点 (From)</label>
                <div class="read-only-box">{{ getNodeName(currentEdgeForm.sourceNodeId) }}</div>
              </div>
              <div class="center-icon">⬇</div>

              <div class="form-group">
                <label>目标节点 (To)</label>
                <div class="custom-select-trigger" @click.stop="openEdgeTargetDropdown">
                  <div class="select-content" :class="{ 'is-active': globalDropdown.currentTrigger === 'edge-target' }">
                    <span>{{ getNodeName(currentEdgeForm.targetNodeId) }}</span>
                    <span class="arrow">▼</span>
                  </div>
                </div>
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

  <Teleport to="body">
    <transition name="dropdown-fade">
      <div
          v-if="globalDropdown.visible"
          class="global-floating-dropdown"
          :class="{ 'is-upward': globalDropdown.isUpward }"
          :style="{ top: globalDropdown.top + 'px', left: globalDropdown.left + 'px', width: globalDropdown.width + 'px' }"
          @click.stop
          @wheel.stop
      >
        <div class="dropdown-scroll-container">
          <div
              v-for="opt in globalDropdown.options"
              :key="opt.id"
              class="global-option-item"
              :class="{ selected: opt.id === globalDropdown.selectedId }"
              @click="globalDropdown.onSelect(opt.id)"
          >
            <span class="opt-id" v-if="globalDropdown.showId && opt.id">{{ opt.id }}</span>
            <span class="opt-name">{{ opt.name }}</span>
            <span v-if="opt.id === globalDropdown.selectedId" class="check-mark">✓</span>
          </div>
          <div v-if="globalDropdown.options.length === 0" class="empty-opt">无可用选项</div>
        </div>
      </div>
    </transition>
  </Teleport>
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

const currentNodeId = ref(null);
let isProgrammaticUpdate = false;
const isExecuting = ref(false);

const globalDropdown = reactive({
  visible: false, top: 0, left: 0, width: 0, isUpward: false,
  options: [], selectedId: null, showId: false, currentTrigger: null, onSelect: null
});

const getDefaultFormState = () => ({
  nodeName: '',
  loopCnt: 1,
  execHoldTime: 0,
  operationList: []
});
const currentNodeForm = reactive(getDefaultFormState());

const currentEdgeForm = reactive({
  edgeName: '', sourceNodeId: '', targetNodeId: ''
});
const nodeOptions = ref([]);

// --- 拖拽逻辑 ---
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

const isStartNode = computed(() => {
  if (String(currentNodeId.value) === '1') return true;
  if (!currentNodeForm.operationList || currentNodeForm.operationList.length === 0) return false;
  const firstOpId = currentNodeForm.operationList[0].baseOperateId;
  const op = props.baseOperates.find(o => o.id === firstOpId);
  return op && ['START', '开始', 'BEGIN'].includes((op.name || '').toUpperCase());
});

const validTargetNodes = computed(() => {
  return nodeOptions.value.filter(n => {
    const isSource = String(n.id) === String(currentEdgeForm.sourceNodeId);
    const isStart = n.name.toUpperCase().includes('START') || n.name.includes('开始') || String(n.id) === '1';
    return !isStart && !isSource;
  });
});

const getOpConfig = (id) => props.baseOperates.find(op => op.id == id);
const getOpName = (id) => getOpConfig(id)?.name || '选择操作';
const getNodeName = (id) => {
  const node = nodeOptions.value.find(n => String(n.id) === String(id));
  return node ? `[${node.id}] ${node.name}` : id;
};

// --- 🌟 修复2：关闭抽屉逻辑 ---
const closeDrawer = () => {
  // 🔥 关键：在清空 ID 前强制保存数据
  if (currentNodeId.value) {
    syncFormToNode();
  }

  currentNodeId.value = null;
  selectedEdgeId.value = null;
  isProgrammaticUpdate = false;
  closeGlobalDropdowns();
};

const closeGlobalDropdowns = () => {
  globalDropdown.visible = false;
  globalDropdown.currentTrigger = null;
};

const openDropdownBase = (event, triggerKey, options, currentVal, showId, callback) => {
  event.stopPropagation();
  if (globalDropdown.currentTrigger === triggerKey && globalDropdown.visible) {
    closeGlobalDropdowns();
    return;
  }
  const trigger = event.currentTarget;
  const rect = trigger.getBoundingClientRect();
  globalDropdown.width = rect.width;
  globalDropdown.left = rect.left;
  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow < 250) {
    globalDropdown.top = rect.top - 4;
    globalDropdown.isUpward = true;
  } else {
    globalDropdown.top = rect.bottom + 4;
    globalDropdown.isUpward = false;
  }
  globalDropdown.options = options;
  globalDropdown.selectedId = currentVal;
  globalDropdown.showId = showId;
  globalDropdown.currentTrigger = triggerKey;
  globalDropdown.onSelect = (id) => {
    callback(id);
    closeGlobalDropdowns();
  };
  globalDropdown.visible = true;
};

const openOpTypeDropdown = (event, opItem, index) => {
  const options = availableOperates.value.map(op => ({ id: op.id, name: op.name }));
  openDropdownBase(event, opItem._key, options, opItem.baseOperateId, false, (newId) => {
    handleOpTypeChange(index, newId);
  });
};

const openEdgeTargetDropdown = (event) => {
  const options = validTargetNodes.value.map(n => ({ id: n.id, name: n.name }));
  openDropdownBase(event, 'edge-target', options, currentEdgeForm.targetNodeId, true, (newId) => {
    currentEdgeForm.targetNodeId = newId;
    updateEdgeConnection();
  });
};

// --- ID 核心生成逻辑 ---
const getMaxId = (items) => {
  if (!items || items.length === 0) return 0;
  const ids = items.map(i => i.id || i.edgeId || i.nodeId).filter(id => /^\d+$/.test(String(id))).map(id => parseInt(id));
  return ids.length > 0 ? Math.max(...ids) : 0;
};
const getNewIntegerId = (nodes, edges) => {
  const maxNode = getMaxId(nodes);
  const maxEdge = getMaxId(edges);
  return String(Math.max(maxNode, maxEdge) + 1);
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

// --- LogicFlow View/Model ---
const UI_CONFIG = {
  width: 180, height: 60, radius: 6,
  colors: {
    start: { main: '#00DC82', bg: 'rgba(0, 220, 130, 0.15)', border: '#00DC82' },
    end:   { main: '#FF5460', bg: 'rgba(255, 84, 96, 0.15)', border: '#FF5460' },
    node:  { main: '#4F64FF', bg: 'rgba(79, 100, 255, 0.10)', border: '#4F64FF' },
    mixed: { main: '#A55FEE', bg: 'rgba(165, 95, 238, 0.15)', border: '#A55FEE' }
  }
};

const getNodeTheme = (props) => {
  const firstOp = props.baseOperates?.[0] || props.baseOperate;
  const baseName = firstOp?.name || props.nodeName || '';
  const t = baseName.toUpperCase();
  if (['START', '开始', 'BEGIN'].includes(t)) return UI_CONFIG.colors.start;
  if (['END', '结束', 'STOP'].includes(t)) return UI_CONFIG.colors.end;
  const hasReset = props.resets ? props.resets.includes(true) : !!props.reset;
  return hasReset ? UI_CONFIG.colors.mixed : UI_CONFIG.colors.node;
};

class LinearNodeView extends RectNode {
  getLabelShape() { return h('g'); }
  getShape() {
    const { model } = this.props;
    const { x, y, width, height, isSelected, id } = model;
    const properties = model.getProperties();
    const firstOp = properties.baseOperates?.[0] || properties.baseOperate || { name: 'Unknown' };
    const baseName = firstOp.name;
    const textValue = model.text?.value || properties.nodeName || baseName;
    const theme = getNodeTheme(properties);
    const opCount = properties.baseOperates?.length || 1;

    const xPos = x - width / 2;
    const yPos = y - height / 2;
    const strokeColor = isSelected ? '#FFFFFF' : theme.border;

    let stackRects = [];
    if (opCount > 1) {
      stackRects.push(h('rect', { x: xPos + 4, y: yPos - 4, width: width - 8, height: height, rx: UI_CONFIG.radius, fill: theme.bg, stroke: theme.border, strokeOpacity: 0.3 }));
    }

    const bgRect = h('rect', { x: xPos, y: yPos, width, height, rx: UI_CONFIG.radius, fill: '#181B24', stroke: strokeColor, strokeWidth: isSelected ? 2 : 1, strokeOpacity: isSelected ? 1 : 0.6 });
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
    }, [textValue + (opCount > 1 ? ` (+${opCount - 1})` : '')]);

    return h('g', {}, [...stackRects, bgRect, glowRect, colorStrip, iconGroup, textLabel]);
  }
}

class LinearNodeModel extends RectNodeModel {
  setAttributes() { this.width = UI_CONFIG.width; this.height = UI_CONFIG.height; }
  getTextStyle() { return { fontSize: 0, fill: 'transparent', opacity: 0 }; }

  initNodeData(data) {
    super.initNodeData(data);
    if (!this.properties.baseOperates) {
      if (this.properties.baseOperate) {
        this.properties.baseOperates = [this.properties.baseOperate];
        this.properties.params = [this.properties.params || []];
        this.properties.resets = [!!this.properties.reset];
      } else {
        this.properties.baseOperates = [{ name: data.text?.value || 'Node', id: 0 }];
        this.properties.params = [[]];
        this.properties.resets = [false];
      }
    }
    if (!this.properties.nodeName) {
      this.properties.nodeName = this.properties.baseOperates[0]?.name || 'Node';
    }
    this.text = { value: this.properties.nodeName, x: data.x, y: data.y };
  }

  // 🌟 核心修复1：定义锚点物理属性 (左侧只能进，右侧只能出)
  getDefaultAnchor() {
    const { x, y, width, id, properties } = this;
    const firstOp = properties.baseOperates?.[0] || {};
    const t = (firstOp.name || properties.nodeName || '').toUpperCase();
    const anchors = [];

    const isStart = ['START', '开始', 'BEGIN'].includes(t);
    const isEnd = ['END', '结束', 'STOP'].includes(t);

    // 左侧锚点 (In)：禁止拖出连线 (edgeAddable: false)
    if (!isStart) {
      anchors.push({ x: x - width/2, y, id: `${id}_in`, type: 'left', edgeAddable: false });
    }
    // 右侧锚点 (Out)：允许拖出连线 (edgeAddable: true)
    if (!isEnd) {
      anchors.push({ x: x + width/2, y, id: `${id}_out`, type: 'right', edgeAddable: true });
    }
    return anchors;
  }

  // 🌟 核心修复2：校验连线目标，强制必须是 Left(In)
  getConnectedTargetRules() {
    const rules = super.getConnectedTargetRules();
    rules.push({
      message: '开始节点不能作为连线目标',
      validate: (s, t) => {
        const props = t.getProperties();
        const firstOp = props.baseOperates?.[0] || {};
        const opName = (firstOp.name || '').toUpperCase();
        return !['START', '开始'].includes(opName);
      }
    });
    // 🔥 强制校验：目标锚点必须是 'left'
    rules.push({
      message: '只能连接到节点左侧锚点 (In)',
      validate: (s, t, sa, ta) => ta && ta.type === 'left'
    });
    rules.push({ message: '检测到闭环', validate: (s, t) => !checkPathExist(t.id, s.id, this.graphModel.modelToGraphData()) });
    return rules;
  }

  // 校验连线源头 (双重保险)
  getConnectedSourceRules() {
    const rules = super.getConnectedSourceRules();
    rules.push({
      message: '只能从节点右侧锚点 (Out) 引出',
      validate: (s, t, sa) => sa && sa.type === 'right'
    });
    return rules;
  }
}

const renderGraph = () => {
  if (!lf) return;
  let nodes = props.graph?.combinationNodes || [];
  let edges = props.graph?.combinationEdges || [];

  if (nodes.length === 0 && lf.getGraphData().nodes.length === 0) {
    nodes = [{
      nodeId: 1, nodeName: '开始',
      baseOperates: [{ name: 'START', id: -1 }],
      params: [[]], resets: [false], autoResets: [false], loopCnt: 1, execHoldTime: 0
    }];
    edges = [];
  } else {
    const hasNonNumeric = nodes.some(n => isNaN(parseInt(n.nodeId))) || edges.some(e => isNaN(parseInt(e.edgeId || e.id)));
    if (hasNonNumeric) {
      const idMap = {};
      let counter = 1;
      const startNode = nodes.find(n => ['START', '开始'].includes((n.baseOperates?.[0]?.name || '').toUpperCase()));
      if (startNode) {
        idMap[startNode.nodeId] = '1';
        startNode.nodeId = 1;
      }
      nodes.forEach(n => {
        if (idMap[n.nodeId]) return;
        while (Object.values(idMap).includes(String(counter))) counter++;
        idMap[n.nodeId] = String(counter);
        n.nodeId = parseInt(counter);
      });
      edges.forEach((e, idx) => {
        e.edgeId = idx + 1;
        if (idMap[e.fromNodeId]) e.fromNodeId = parseInt(idMap[e.fromNodeId]);
        if (idMap[e.nextNodeId]) e.nextNodeId = parseInt(idMap[e.nextNodeId]);
      });
    }
  }

  const data = calcSafeLayout(nodes, edges);
  lf.render(data);
  nextTick(() => { if(data.nodes.length) { lf.translateCenter(); lf.zoom(0.9); } });
};

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
        return getNewIntegerId(nodes, edges);
      }
    },
    grid: { size: 20, visible: true, type: 'mesh', config: { color: '#1a1a1a', thickness: 1 } },
    background: { color: 'transparent' }, edgeType: 'bezier', hoverOutline: false, adjustEdge: false, plugins: plugins,
    keyboard: { enabled: true, shortcuts: [
        { keys: ["delete", "backspace"], callback: () => {
            const activeTag = document.activeElement.tagName;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) return;
            const elements = lf.getSelectElements(true);
            lf.clearSelectElements();
            elements.edges.forEach(edge => lf.deleteEdge(edge.id));
            elements.nodes.forEach(node => {
              const props = node.properties;
              const isStart = props.nodeName === '开始' || (props.baseOperates?.[0]?.name === 'START');
              if(!isStart) lf.deleteNode(node.id);
              else ElMessage.warning("开始节点不可删除");
            });
            if (currentNodeId.value) closeDrawer();
            selectedEdgeId.value = null;
          }},
        { keys: ["ctrl + c", "meta + c"], callback: () => { lf.copy(); return false; } },
        { keys: ["ctrl + v", "meta + v"], callback: () => { lf.paste(); return false; } }
      ]}
  });

  lf.register({ type: 'process-node', view: LinearNodeView, model: LinearNodeModel });
  lf.setTheme({
    bezier: { stroke: '#5c6b8f', strokeWidth: 2, adjustLineColor: '#00ff88' },
    'edge:hover': { stroke: '#fff', strokeWidth: 3 },
    'edge:selected': { stroke: '#00ff88', strokeWidth: 3 },
    anchor: { r: 4, fill: '#050608', stroke: '#4f64ff', hover: { fill: '#00ff88', stroke: '#fff', r: 6 } },
  });

  // 🌟 核心修复1：edge:add 事件中保留原始锚点信息 (防止 UUID 修正时连线乱跑)
  lf.on('edge:add', ({ data }) => {
    if (isNaN(Number(data.id))) {
      setTimeout(() => {
        const { nodes, edges } = lf.getGraphData();
        const currentEdge = edges.find(e => e.id === data.id);
        if (!currentEdge) return;

        const nextId = getNewIntegerId(nodes, edges);

        lf.deleteEdge(data.id);
        lf.addEdge({
          id: nextId,
          sourceNodeId: currentEdge.sourceNodeId,
          targetNodeId: currentEdge.targetNodeId,
          // 🔥 关键修复：保留原始拖拽连接的锚点ID
          sourceAnchorId: currentEdge.sourceAnchorId,
          targetAnchorId: currentEdge.targetAnchorId,
          type: currentEdge.type,
          text: currentEdge.text?.value || '',
          properties: { ...currentEdge.properties }
        });
      }, 0);
    }
  });

  lf.on('node:add', ({ data }) => {
    if (isNaN(Number(data.id))) {
      setTimeout(() => {
        const { nodes, edges } = lf.getGraphData();
        const validNodes = nodes.filter(n => n.id !== data.id && /^\d+$/.test(n.id));
        const nextId = getNewIntegerId(validNodes, edges);
        lf.changeNodeId(data.id, nextId);
        lf.graphModel.selectElementById(nextId);
      }, 0);
    }
  });

  lf.on('node:click', ({ data }) => {
    if (currentNodeId.value === data.id) return;
    if (currentNodeId.value) syncFormToNode();
    selectedEdgeId.value = null;
    isProgrammaticUpdate = true;
    currentNodeId.value = data.id;
    closeGlobalDropdowns();

    const nodeModel = lf.graphModel.getNodeModelById(String(data.id));
    const props = nodeModel ? nodeModel.getProperties() : data.properties;

    const newForm = getDefaultFormState();
    newForm.nodeName = props.nodeName || '';
    newForm.loopCnt = props.loopCnt !== undefined ? props.loopCnt : 1;
    newForm.execHoldTime = props.execHoldTime || 0;

    const ops = props.baseOperates || (props.baseOperate ? [props.baseOperate] : []);
    const paramsList = props.params || [];
    const resets = props.resets || (props.reset !== undefined ? [props.reset] : []);
    const auto_resets = props.autoResets || (props.autoResets !== undefined ? [props.autoResets] : []);

    newForm.operationList = ops.map((op, idx) => {
      const p = Array.isArray(paramsList[idx]) ? [...paramsList[idx]] : [];
      const fullOp = getOpConfig(op.id);
      if(fullOp) {
        const size = fullOp.paramSize || 0;
        while(p.length < size) p.push('');
      }
      return {
        _key: Date.now() + Math.random() + idx,
        baseOperateId: op.id,
        params: p,
        isReset: !!resets[idx],
        isAutoReset: !!auto_resets[idx]
      };
    });

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
    closeGlobalDropdowns();

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
  if (isStartNode.value) return;

  const formRaw = toRaw(currentNodeForm);
  const baseOperates = [];
  const params = [];
  const resets = [];
  const autoResets = [];

  formRaw.operationList.forEach(item => {
    const opConfig = getOpConfig(item.baseOperateId);
    if(opConfig) {
      baseOperates.push({ ...opConfig });
      params.push([...item.params]);
      resets.push(item.isReset);
      autoResets.push(item.isAutoReset);
    }
  });

  let finalNodeName = formRaw.nodeName;
  if (!finalNodeName && baseOperates.length > 0) finalNodeName = baseOperates[0].name;

  const model = lf.graphModel.getNodeModelById(currentNodeId.value);
  if (model) {
    model.setProperties({
      nodeName: finalNodeName,
      loopCnt: formRaw.loopCnt,
      execHoldTime: formRaw.execHoldTime,
      baseOperates, params, resets,autoResets
    });
    model.updateText(finalNodeName);
  }
};

const addOperation = () => {
  if (isStartNode.value) return;
  const defaultOp = availableOperates.value[0];
  if (!defaultOp) return;
  currentNodeForm.operationList.push({
    _key: Date.now() + Math.random(),
    baseOperateId: defaultOp.id,
    params: defaultOp.initParams ? [...defaultOp.initParams] : new Array(defaultOp.paramSize || 0).fill(''),
    isReset: false,
    isAutoReset: false
  });
};

const removeOperation = (index) => {
  currentNodeForm.operationList.splice(index, 1);
};

const handleOpTypeChange = (index, newId) => {
  const opConfig = getOpConfig(newId);
  if (!opConfig) return;
  const item = currentNodeForm.operationList[index];
  item.baseOperateId = newId;
  item.params = opConfig.initParams ? [...opConfig.initParams] : new Array(opConfig.paramSize || 0).fill('');
  if (!opConfig.needReset) {
    item.isReset = false;
    item.isAutoReset = false;
  }
  if (index === 0 && (!currentNodeForm.nodeName || currentNodeForm.nodeName.trim() === '')) {
    currentNodeForm.nodeName = opConfig.name;
  }
};

const deleteCurrentEdge = () => {
  if (!lf || !selectedEdgeId.value) return;
  lf.deleteEdge(selectedEdgeId.value);
  selectedEdgeId.value = null;
  closeDrawer();
  ElMessage.success("连线已删除");
};

// 🌟 核心修复3：updateEdgeConnection 强制指定锚点 (Right -> Left)
const updateEdgeConnection = () => {
  if (!lf || !selectedEdgeId.value) return;
  const oldEdgeId = selectedEdgeId.value;
  const { sourceNodeId, targetNodeId, edgeName } = currentEdgeForm;
  if (sourceNodeId === targetNodeId) return ElMessage.warning("不能连接自身");

  lf.deleteEdge(oldEdgeId);
  try {
    const { nodes, edges } = lf.getGraphData();
    const nextId = /^\d+$/.test(oldEdgeId) ? oldEdgeId : getNewIntegerId(nodes, edges);

    const newEdge = lf.addEdge({
      id: nextId,
      sourceNodeId,
      targetNodeId,
      // 🔥 强制指定源锚点为右侧(_out)，目标锚点为左侧(_in)
      sourceAnchorId: `${sourceNodeId}_out`,
      targetAnchorId: `${targetNodeId}_in`,
      text: edgeName,
      properties: { edgeName },
      type: 'bezier'
    });
    if(newEdge) {
      selectedEdgeId.value = newEdge.id;
      nextTick(() => lf.graphModel.selectElementById(newEdge.id));
    }
  } catch(e) { ElMessage.error("连接失败"); }
};

const getFormattedGraphVO = () => {
  if (!lf) return null;
  if (currentNodeId.value) syncFormToNode();
  const raw = lf.getGraphData();
  const result = JSON.parse(JSON.stringify(props.graph));
  result.combinationNodes = raw.nodes.map(n => {
    const p = n.properties || {};
    return {
      nodeId: parseInt(n.id),
      nodeName: p.nodeName || '',
      baseOperates: p.baseOperates || [],
      params: p.params || [],
      resets: p.resets || [],
      autoResets: p.autoResets || [],
      execHoldTime: p.execHoldTime || 0,
      loopCnt: p.loopCnt || 1
    };
  });
  result.combinationEdges = raw.edges.map(e => ({
    edgeId: /^\d+$/.test(e.id) ? parseInt(e.id) : 0,
    fromNodeId: parseInt(e.sourceNodeId),
    nextNodeId: parseInt(e.targetNodeId),
    edgeName: e.properties?.edgeName || e.text?.value || ''
  }));
  return result;
};

const saveData = () => { const result = getFormattedGraphVO(); if (result) { emit('save', result); } };
const handleExec = async () => {
  const graphVO = getFormattedGraphVO(); if (!graphVO) return;
  isExecuting.value = true;
  try {
    const response = await fetch('http://localhost:8080/api/combination-graph/exec', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(graphVO) });
    if (response.ok) { ElMessage.success('指令下发成功'); } else { ElMessage.error('调试请求失败'); }
  } catch (error) { ElMessage.error('网络请求异常'); } finally { isExecuting.value = false; }
};

const handleManualLayout = () => {
  if (!lf) return;
  const { nodes, edges } = lf.getGraphData();
  const layoutNodes = nodes.map(n => ({...n.properties, nodeId: n.id}));
  const layoutEdges = edges.map(e => ({fromNodeId: e.sourceNodeId, nextNodeId: e.targetNodeId}));
  const layoutData = calcSafeLayout(layoutNodes, layoutEdges);
  lf.render(layoutData);
  nextTick(() => { lf.translateCenter(); lf.zoom(0.9); });
};

const addNode = () => {
  if (!lf || !container.value) return;
  const { nodes, edges } = lf.getGraphData();
  const nextId = getNewIntegerId(nodes, edges);
  const defaultOp = availableOperates.value[0] || { name: 'ACTION', id: 999 };
  const newNodeProps = {
    nodeName: defaultOp.name,
    loopCnt: 1,
    execHoldTime: 100,
    baseOperates: [{ ...defaultOp }],
    params: [defaultOp.initParams ? [...defaultOp.initParams] : new Array(defaultOp.paramSize || 0).fill('')],
    resets: [false]
  };
  const { transformModel } = lf.graphModel;
  const width = container.value.clientWidth;
  const height = container.value.clientHeight;
  const startX = (-transformModel.TRANSLATE_X + width / 2) / transformModel.SCALE_X;
  const startY = (-transformModel.TRANSLATE_Y + height / 2) / transformModel.SCALE_Y;

  lf.addNode({
    id: nextId,
    type: 'process-node',
    x: startX,
    y: startY,
    text: newNodeProps.nodeName,
    properties: newNodeProps
  });

  selectedEdgeId.value = null;
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
      let props = { ...n };
      if (!props.baseOperates && props.baseOperate) {
        props.baseOperates = [props.baseOperate];
        props.params = [props.params || []];
        props.resets = [!!props.reset];
      }
      if (!props.nodeName && props.baseOperates?.[0]) props.nodeName = props.baseOperates[0].name;

      return {
        id: String(n.nodeId), type: 'process-node',
        x: pos ? pos.x : 150 + i*50, y: pos ? pos.y : 150 + i*50,
        text: props.nodeName,
        properties: props
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

onMounted(() => {
  if (container.value) {
    resizeObserver = new ResizeObserver((entries) => { if (entries[0].contentRect.width > 0 && !lf && props.graph) initLF(); });
    resizeObserver.observe(container.value);
  }
  window.addEventListener('resize', closeGlobalDropdowns);
});
watch(() => props.graph?.combination?.id, (v) => { if (v) nextTick(initLF); }, { immediate: true });
onBeforeUnmount(() => {
  if (lf) lf.destroy();
  resizeObserver?.disconnect();
  window.removeEventListener('resize', closeGlobalDropdowns);
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
});
</script>

<style scoped>
/* 全局悬浮下拉框样式 (Teleport) */
.global-floating-dropdown {
  position: fixed;
  z-index: 9999;
  background: rgba(24, 27, 36, 0.98);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(79, 100, 255, 0.3);
  border-radius: 6px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.8);
  padding: 4px;
  box-sizing: border-box;
  transform-origin: top center;
}
.global-floating-dropdown.is-upward {
  transform: translateY(-100%);
  transform-origin: bottom center;
}
.dropdown-scroll-container {
  max-height: 250px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #444 transparent;
}
.dropdown-scroll-container::-webkit-scrollbar { width: 4px; }
.dropdown-scroll-container::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }
.global-option-item {
  padding: 8px 12px;
  font-size: 0.85rem;
  color: #ccc;
  border-radius: 4px;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: 0.1s;
  margin-bottom: 1px;
}
.global-option-item:hover {
  background: rgba(79, 100, 255, 0.2);
  color: #fff;
}
.global-option-item.selected {
  background: rgba(79, 100, 255, 0.15);
  color: #4f64ff;
  font-weight: bold;
}
.opt-id {
  font-family: monospace;
  opacity: 0.5;
  font-size: 0.75rem;
  margin-right: 8px;
  min-width: 20px;
}
.opt-name { flex: 1; }
.check-mark { font-size: 0.8rem; margin-left: 8px; }
.empty-opt { padding: 10px; color: #666; font-size: 0.8rem; text-align: center; font-style: italic; }

.custom-select-trigger { position: relative; width: 100%; cursor: pointer; user-select: none; }
.select-content {
  background: #0a0c10;
  border: 1px solid #333;
  color: #eee;
  padding: 9px 10px;
  border-radius: 4px;
  font-size: 0.85rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s;
}
.custom-select-trigger:hover .select-content { border-color: #555; background: #0f1218; }
.select-content.is-active { border-color: #4f64ff; background: #151820; }
.arrow { font-size: 0.7rem; color: #666; transition: transform 0.2s; }
.select-content.is-active .arrow { transform: rotate(180deg); color: #4f64ff; }

.dropdown-fade-enter-active, .dropdown-fade-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.dropdown-fade-enter-from, .dropdown-fade-leave-to { opacity: 0; transform: translateY(-5px) scale(0.98); }
.is-upward.dropdown-fade-enter-from, .is-upward.dropdown-fade-leave-to { transform: translateY(calc(-100% + 5px)) scale(0.98); }

.special-node-info {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 40px 20px; background: rgba(255, 255, 255, 0.02);
  border-radius: 8px; border: 1px dashed rgba(255, 255, 255, 0.1);
}
.icon-circle {
  width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 1.8rem; margin-bottom: 12px;
}
.start-icon { background: rgba(0, 220, 130, 0.15); color: #00DC82; box-shadow: 0 0 15px rgba(0, 220, 130, 0.1); }
.edge-icon { background: rgba(79, 100, 255, 0.1); color: #4f64ff; font-size: 1.5rem; width: 40px; height: 40px; }
.special-node-info h4 { margin: 0 0 8px 0; color: #fff; font-size: 0.9rem; font-weight: 600; letter-spacing: 0.5px; }
.info-row { display: flex; gap: 8px; align-items: center; margin-bottom: 15px; }
.info-row span { font-family: monospace; font-size: 0.75rem; color: #aaa; }
.tag { background: #333; padding: 2px 6px; border-radius: 3px; font-size: 0.6rem; color: #888; border: 1px solid #444; }
.desc-text { text-align: center; font-size: 0.7rem; color: #666; line-height: 1.6; margin: 0; }
.read-only-box { background: rgba(255,255,255,0.05); border: 1px solid transparent; color: #777; padding: 9px 10px; border-radius: 4px; font-size: 0.8rem; font-family: monospace; }

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
.btn-solid-orange { background: #ff9f43; color: #000; border: none; padding: 8px 18px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; transition: 0.3s; white-space: nowrap; }
.btn-solid-orange:hover:not(:disabled) { filter: brightness(1.1); }
.btn-solid-orange:disabled { opacity: 0.6; cursor: not-allowed; }
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
.config-drawer { position: absolute; width: 340px; max-height: 70vh; background: rgba(20, 23, 31, 0.98); backdrop-filter: blur(12px); border: 1px solid rgba(79, 100, 255, 0.2); border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.8); z-index: 100; display: flex; flex-direction: column; overflow: hidden; }
.drawer-header { flex-shrink: 0; padding: 16px 20px; background: rgba(79, 100, 255, 0.08); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; cursor: move; }
.drawer-content { padding: 20px; flex: 1; overflow-y: auto; }
.form-container { display: flex; flex-direction: column; gap: 12px; }
.section-block { background: rgba(255,255,255,0.02); padding: 10px; border-radius: 6px; }
.row-2-col { display: flex; gap: 10px; margin-top: 10px; }
.row-2-col .form-group { flex: 1; }
.section-title { font-size: 0.7rem; color: #4f64ff; font-weight: bold; margin-bottom: 5px; display: block; letter-spacing: 1px; }
.ops-list { display: flex; flex-direction: column; gap: 10px; max-height: 350px; overflow-y: auto; padding-right: 5px; }
.op-card { background: #0f1116; border: 1px solid #333; border-radius: 6px; padding: 10px; position: relative; transition: 0.2s; }
.op-card:hover { border-color: #555; }
.op-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.op-index { font-size: 0.7rem; color: #666; font-family: monospace; }
.btn-icon-del { background: none; border: none; color: #666; cursor: pointer; font-size: 1.1rem; line-height: 1; }
.btn-icon-del:hover { color: #ff5460; }
.params-area { margin-top: 8px; padding-left: 8px; border-left: 2px solid #333; display: flex; flex-direction: column; gap: 6px; }
.small-gap { gap: 2px; }
.sub-label { font-size: 0.65rem; color: #777; }
.input-sm { padding: 6px 8px; font-size: 0.8rem; }
.btn-add-op { width: 100%; padding: 10px; margin-top: 10px; background: rgba(79, 100, 255, 0.1); border: 1px dashed rgba(79, 100, 255, 0.4); color: #4f64ff; font-size: 0.75rem; border-radius: 6px; cursor: pointer; transition: 0.2s; }
.btn-add-op:hover { background: rgba(79, 100, 255, 0.2); }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 0.7rem; color: #888; font-weight: bold; }
.input-dark { width: 100%; background: #0a0c10; border: 1px solid #333; color: #eee; padding: 9px 10px; border-radius: 4px; outline: none; box-sizing: border-box; }
.input-dark:focus { border-color: #4f64ff; background: #000; }
.switch-box { position: relative; width: 36px; height: 18px; }
.switch-box input { opacity: 0; width: 0; height: 0; }
.toggle { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .4s; border-radius: 20px; }
.toggle:before { position: absolute; content: ""; height: 14px; width: 14px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; }
input:checked + .toggle { background-color: #4f64ff; }
input:checked + .toggle:before { transform: translateX(18px); }
.divider-line { height: 1px; background: rgba(255,255,255,0.05); margin: 5px 0; }
.center-icon { text-align: center; color: #4f64ff; margin: -5px 0; font-weight: bold; }
.btn-delete-block { width: 100%; background: rgba(255, 84, 96, 0.1); border: 1px solid rgba(255, 84, 96, 0.3); color: #ff5460; padding: 10px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; }
.btn-delete-block:hover { background: rgba(255, 84, 96, 0.2); border-color: #ff5460; }
.close-btn { background: none; border: none; color: #666; font-size: 1.2rem; cursor: pointer; }
</style>