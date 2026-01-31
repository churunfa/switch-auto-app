<template>
  <div class="topology-container">
    <TopologyHeader
        v-model="currentProject"
        :projects="projects"
        :loading="loading"
        :async-exec-info="asyncExecStatus"
        @refresh="initData"
        @create="openCreateModal"
        @change="handleProjectChange"
        @refresh-status="syncAllStatus"
        @export="handleHeaderExport"
    />

    <div class="main-layout">
      <TopologySidebar
          :combinations="combinations"
          :active-id="activeComboId"
          :has-project="!!currentProject"
          @select="loadGraphDetail"
          @delete="handleDelete"
          @refresh-status="syncAllStatus"
          @view-json="handleSidebarViewJson"
      />

      <TopologyCanvas
          ref="canvasRef"
          :graph="activeGraph"
          :baseOperates="baseOperates"
          @close="activeGraph = null"
          @save="handleUpdate"
      />
    </div>

    <Transition name="fade">
      <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
        <div class="modal-card">
          <div class="modal-head">
            <h3>INITIALIZE NEW TOPOLOGY</h3>
            <button class="close-x" @click="showCreateModal = false">×</button>
          </div>

          <div class="mode-tabs">
            <button
                :class="['tab-btn', createMode === 'form' ? 'active' : '']"
                @click="createMode = 'form'"
            >
              WIZARD
            </button>
            <button
                :class="['tab-btn', createMode === 'json' ? 'active' : '']"
                @click="createMode = 'json'"
            >
              JSON IMPORT
            </button>
          </div>

          <div class="modal-body">
            <div v-if="createMode === 'form'">
              <div class="input-group">
                <label>PROJECT NAME</label>
                <div class="custom-dropdown" v-click-outside="() => showFormDrop = false">
                  <div class="dropdown-trigger combo-input">
                    <input
                        v-model="newForm.projectName"
                        placeholder="Select or type new..."
                        @focus="showFormDrop = true"
                        class="inner-input"
                    />
                    <span
                        class="select-arrow"
                        :class="{ open: showFormDrop }"
                        @click.stop="showFormDrop = !showFormDrop"
                    ></span>
                  </div>
                  <transition name="slide-up">
                    <ul v-if="showFormDrop && filteredProjects.length" class="dropdown-menu scrollable-menu">
                      <li v-for="p in filteredProjects" :key="p" @click="selectFormProject(p)">{{ p }}</li>
                    </ul>
                  </transition>
                </div>
              </div>
              <div class="input-group">
                <label>GRAPH NAME</label>
                <input v-model="newForm.name" placeholder="Enter graph name..." />
              </div>
              <div class="input-group">
                <label>DESCRIPTION</label>
                <textarea v-model="newForm.desc" rows="3" placeholder="Brief details..."></textarea>
              </div>
            </div>

            <div v-else class="json-import-area">
              <div class="input-group full-height">
                <label>PASTE JSON PAYLOAD</label>
                <textarea
                    v-model="newJsonStr"
                    class="code-input"
                    placeholder='Paste your full topology JSON here...'
                    spellcheck="false"
                ></textarea>
              </div>
            </div>
          </div>

          <div class="modal-foot">
            <button class="btn-modal-cancel" @click="showCreateModal = false">CANCEL</button>
            <button class="btn-modal-confirm" @click="submitCreate">
              {{ createMode === 'form' ? 'GENERATE GRAPH' : 'IMPORT JSON' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="showJsonModal" class="modal-overlay" @click.self="showJsonModal = false">
        <div class="json-modal-card">
          <div class="modal-head">
            <div class="head-left">
              <h3>JSON SOURCE VIEWER</h3>
              <span class="byte-tag">{{ jsonByteSize }} bytes</span>
            </div>
            <button class="close-x" @click="showJsonModal = false">×</button>
          </div>
          <div class="modal-body no-padding">
            <textarea
                readonly
                v-model="jsonContent"
                class="code-viewer"
                spellcheck="false"
            ></textarea>
          </div>
          <div class="modal-foot">
            <span class="hint-text">Compatible with Insert/Update API</span>
            <button class="btn-copy" @click="copyJson">
              <span class="icon">❐</span> {{ copyBtnText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import axios from 'axios';
import TopologyHeader from './TopologyHeader.vue';
import TopologySidebar from './TopologySidebar.vue';
import TopologyCanvas from './TopologyCanvas.vue';
import { ElMessage } from "element-plus";

// --- 自定义指令 ---
const vClickOutside = {
  mounted(el, binding) {
    el.clickOutsideEvent = (event) => {
      if (!(el === event.target || el.contains(event.target))) binding.value();
    };
    document.addEventListener("click", el.clickOutsideEvent);
  },
  unmounted(el) {
    document.removeEventListener("click", el.clickOutsideEvent);
  },
};

const API_BASE = 'http://localhost:8080/api/combination-graph';
const BASE_OP_API = 'http://localhost:8080/api/base-operate/all-base-operates';

// --- 数据状态 ---
const projects = ref([]);
const currentProject = ref('');
const combinations = ref([]);
const baseOperates = ref([]);
const activeGraph = ref(null);
const activeComboId = ref(null);
const loading = ref(false);

// 创建弹窗状态
const showCreateModal = ref(false);
const showFormDrop = ref(false);
const createMode = ref('form'); // 'form' | 'json'
const newForm = ref({ projectName: '', name: '', desc: '' });
const newJsonStr = ref('');

// 异步任务全局状态
const asyncExecStatus = ref(null);
let globalTimer = null;

// JSON 弹窗状态
const showJsonModal = ref(false);
const jsonContent = ref('');
const copyBtnText = ref('COPY JSON');
const canvasRef = ref(null);

// --- 计算属性 ---
const filteredProjects = computed(() => {
  if (!newForm.value.projectName) return projects.value;
  return projects.value.filter(p => p.toLowerCase().includes(newForm.value.projectName.toLowerCase()));
});

const jsonByteSize = computed(() => {
  return new Blob([jsonContent.value]).size;
});

// --- 核心同步方法 ---

// 1. 同步当前项目的列表和全局异步状态
const syncAllStatus = async () => {
  try {
    const requests = [
      axios.get(`${API_BASE}/async-exec-info`)
    ];

    // 只有当选中了项目时，才去查该项目的图列表
    if (currentProject.value) {
      requests.unshift(axios.get(`${API_BASE}/all-combination`, { params: { projectName: currentProject.value } }));
    }

    const responses = await Promise.all(requests);

    // 如果 requests 长度为 2，说明查了列表
    if (currentProject.value && responses.length === 2) {
      combinations.value = responses[0].data.data || [];
      asyncExecStatus.value = responses[1].data.data || null;
    } else {
      // 没查列表，只查了状态
      asyncExecStatus.value = responses[0].data.data || null;
      if (!currentProject.value) combinations.value = [];
    }
  } catch (err) {
    console.error("Sync Failed", err);
  }
};

// 2. 初始化数据：查询所有项目 + 基础操作
const initData = async () => {
  loading.value = true;
  try {
    // ✨ 这里的 all-project 逻辑是必须的，用于填充下拉框
    const [projRes, baseRes] = await Promise.all([
      axios.get(`${API_BASE}/all-project`),
      axios.get(BASE_OP_API)
    ]);

    projects.value = projRes.data.data || [];
    baseOperates.value = baseRes.data.data || [];

    // 如果当前没有选中项目，且项目列表不为空，默认选中第一个
    if (!currentProject.value && projects.value.length > 0) {
      currentProject.value = projects.value[0];
    }

    await syncAllStatus();
  } catch (err) {
    console.error("Init Data Error", err);
    ElMessage.error("Initialization Failed");
  } finally {
    loading.value = false;
  }
};

// --- 事件处理 ---

const handleProjectChange = () => {
  activeGraph.value = null;
  activeComboId.value = null;
  syncAllStatus();
};

const loadGraphDetail = async (id) => {
  if (activeComboId.value === id && activeGraph.value) return;
  activeComboId.value = id;
  try {
    const res = await axios.get(`${API_BASE}/graph/${id}`);
    activeGraph.value = res.data.data;
  } catch (err) {
    ElMessage.warning('Load Graph Failed');
  }
};

// --- 弹窗与 JSON 导出 ---

const handleSidebarViewJson = async (item) => {
  loading.value = true;
  try {
    const res = await axios.get(`${API_BASE}/graph/${item.id}`);
    if (res.data.success) {
      jsonContent.value = JSON.stringify(res.data.data, null, 2);
      showJsonModal.value = true;
      copyBtnText.value = 'COPY JSON';
    }
  } catch (e) {
    ElMessage.error('Get Details Failed');
  } finally {
    loading.value = false;
  }
};

const handleHeaderExport = () => {
  if (!canvasRef.value || !canvasRef.value.getFormattedGraphVO) {
    ElMessage.warning('Canvas component not ready');
    return;
  }
  const graphData = canvasRef.value.getFormattedGraphVO();
  if (graphData) {
    jsonContent.value = JSON.stringify(graphData, null, 2);
    showJsonModal.value = true;
    copyBtnText.value = 'COPY JSON';
  }
};

const copyJson = async () => {
  try {
    await navigator.clipboard.writeText(jsonContent.value);
    ElMessage.success('Copied to clipboard');
    copyBtnText.value = 'COPIED!';
    setTimeout(() => { copyBtnText.value = 'COPY JSON'; }, 2000);
  } catch (e) {
    ElMessage.error('Copy Failed');
  }
};

// --- 创建逻辑 (Form & JSON) ---

const openCreateModal = () => {
  showCreateModal.value = true;
  createMode.value = 'form';
  newForm.value = { projectName: currentProject.value || '', name: '', desc: '' };
  newJsonStr.value = '';
};

const selectFormProject = (p) => {
  newForm.value.projectName = p;
  showFormDrop.value = false;
};

const submitCreate = async () => {
  let payload = null;
  let targetProjectName = '';

  if (createMode.value === 'form') {
    // 1. 表单模式
    if (!newForm.value.name || !newForm.value.projectName) {
      ElMessage.warning('Project Name and Graph Name are required.');
      return;
    }
    const startOp = baseOperates.value.find(b => b.ename === 'START_EMPTY') || { id: -1, name: 'START' };
    payload = {
      combination: {
        projectName: newForm.value.projectName,
        combinationName: newForm.value.name,
        desc: newForm.value.desc,
        minTime: 0
      },
      combinationNodes: [
        { nodeId: 1, baseOperate: startOp, params: [], holdTime: 0, loopCnt: 1 },
      ],
      combinationEdges: []
    };
    targetProjectName = newForm.value.projectName;
  } else {
    // 2. JSON 模式
    if (!newJsonStr.value.trim()) {
      ElMessage.warning('Please enter JSON content.');
      return;
    }
    try {
      payload = JSON.parse(newJsonStr.value);
      if (!payload.combination || !payload.combination.projectName) {
        ElMessage.error('Invalid JSON: Missing "combination" or "projectName".');
        return;
      }
      targetProjectName = payload.combination.projectName;

      // 移除 id 以防冲突，让后端生成新的
      delete payload.combination.id;
      if (payload.combinationNodes) payload.combinationNodes.forEach(n => delete n.id);
      if (payload.combinationEdges) payload.combinationEdges.forEach(e => delete e.id);

    } catch (e) {
      ElMessage.error('JSON Syntax Error');
      return;
    }
  }

  // 3. 提交
  try {
    const res = await axios.post(`${API_BASE}/insert`, payload);
    if (res.data.success) {
      showCreateModal.value = false;
      ElMessage.success('Graph Created Successfully');

      // 切换到新项目并刷新所有数据
      currentProject.value = targetProjectName;
      await initData(); // 这里会重新调用 all-project，确保新项目出现在列表中
    } else {
      ElMessage.error(res.data.message || 'Create Failed');
    }
  } catch (err) {
    ElMessage.error("Create Request Failed");
  }
};

const handleUpdate = async (result) => {
  if (!result) return;
  loading.value = true;
  try {
    await axios.post(`${API_BASE}/update`, result);
    ElMessage.success('Saved');
    await syncAllStatus();
  } catch(e) {
    ElMessage.error('Save Failed');
  } finally {
    loading.value = false;
  }
};

const handleDelete = async (item) => {
  if (!confirm(`Delete "${item.combinationName}"?`)) return;
  try {
    await axios.delete(`${API_BASE}/graph/${item.id}`);
    if (activeComboId.value === item.id) activeGraph.value = null;
    await syncAllStatus();
    ElMessage.success('Deleted');
  } catch (err) {
    ElMessage.error('Delete Failed');
  }
};

// --- 生命周期 ---
onMounted(() => {
  initData();
  globalTimer = setInterval(syncAllStatus, 3000);
});

onUnmounted(() => {
  if (globalTimer) clearInterval(globalTimer);
});
</script>

<style scoped>
/* 基础布局 */
.topology-container { height: 100vh; background: #050608; color: #e0e0e0; display: flex; flex-direction: column; font-family: 'Inter', system-ui, sans-serif; overflow: hidden; }
.main-layout { flex: 1; display: grid; grid-template-columns: 320px 1fr; overflow: hidden; }

/* 模态框通用 */
.modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.2s ease; }
.modal-card { background: #0d0f17; border: 1px solid rgba(79, 100, 255, 0.4); border-radius: 12px; width: 480px; padding: 30px; box-shadow: 0 20px 80px rgba(0,0,0,1); display: flex; flex-direction: column; }

/* 模态框头部 */
.modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #222; padding-bottom: 15px; }
.modal-head h3 { margin: 0; font-size: 1rem; color: #fff; letter-spacing: 1px; }
.close-x { background: transparent; border: none; color: #555; font-size: 1.5rem; cursor: pointer; transition: 0.2s; }
.close-x:hover { color: #fff; }

/* Tab 切换器 */
.mode-tabs { display: flex; background: rgba(255,255,255,0.05); padding: 4px; border-radius: 8px; margin-bottom: 20px; }
.tab-btn { flex: 1; background: transparent; border: none; color: #666; padding: 8px; font-size: 0.75rem; font-weight: bold; cursor: pointer; border-radius: 6px; transition: 0.3s; }
.tab-btn.active { background: #4f64ff; color: #fff; box-shadow: 0 2px 10px rgba(79, 100, 255, 0.3); }

/* 表单输入 */
.input-group { margin-bottom: 20px; }
.input-group label { display: block; font-size: 0.65rem; color: #4f64ff; font-weight: bold; margin-bottom: 8px; }
.input-group input, .input-group textarea:not(.code-input) { width: 100%; background: #000; border: 1px solid #222; color: #fff; padding: 12px; border-radius: 6px; outline: none; box-sizing: border-box; }

/* JSON 输入区 */
.json-import-area { height: 260px; display: flex; flex-direction: column; }
.full-height { height: 100%; display: flex; flex-direction: column; }
.code-input { flex: 1; background: #000; border: 1px solid #222; color: #00e5ff; padding: 12px; border-radius: 6px; outline: none; font-family: 'Fira Code', monospace; font-size: 0.8rem; resize: none; line-height: 1.4; }
.code-input:focus { border-color: #4f64ff; }

/* 下拉菜单 */
.custom-dropdown { position: relative; min-width: 140px; }
.dropdown-trigger.combo-input { padding: 0 16px; display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.03); border: 1px solid #222; border-radius: 6px; }
.inner-input { background: transparent !important; border: none !important; color: #fff !important; padding: 12px 0 !important; width: 100%; outline: none; }
.select-arrow { width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #4f64ff; transition: 0.3s; }
.select-arrow.open { transform: rotate(180deg); }
.dropdown-menu { position: absolute; top: calc(100% + 5px); left: 0; width: 100%; background: #0d0f17; border: 1px solid #222; border-radius: 6px; padding: 5px; list-style: none; z-index: 1001; }
.dropdown-menu li { padding: 10px; color: #888; cursor: pointer; border-radius: 4px; }
.dropdown-menu li:hover { background: #1a1a1a; color: #4f64ff; }
.scrollable-menu { max-height: 150px; overflow-y: auto; }

/* 模态框底部 */
.modal-foot { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 10px; }
.btn-modal-cancel { background: transparent; border: 1px solid #333; color: #666; padding: 10px 25px; border-radius: 4px; cursor: pointer; font-weight: bold; }
.btn-modal-confirm { background: #4f64ff; color: #fff; border: none; padding: 12px 30px; border-radius: 4px; font-weight: 800; font-size: 0.8rem; cursor: pointer; }
.btn-modal-confirm:disabled { opacity: 0.3; cursor: not-allowed; }

/* JSON 查看器弹窗 */
.json-modal-card { width: 700px; max-width: 90vw; height: 80vh; background: #13151b; border: 1px solid rgba(0, 229, 255, 0.3); border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; animation: slideUp 0.3s ease; }
/* 特殊调整头部底部 */
.json-modal-card .modal-head { margin-bottom: 0; padding: 15px 20px; background: rgba(255,255,255,0.02); }
.json-modal-card .modal-foot { margin: 0; padding: 15px 20px; background: rgba(255,255,255,0.02); border-top: 1px solid #222; }
.head-left { display: flex; align-items: center; gap: 10px; }
.byte-tag { font-size: 0.65rem; color: #888; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace; }
.modal-body.no-padding { padding: 0; flex: 1; display: flex; }
.code-viewer { flex: 1; background: #0b0d12; border: none; color: #a6accd; font-family: 'Fira Code', monospace; padding: 20px; resize: none; outline: none; }
.hint-text { color: #444; font-size: 0.75rem; }
.btn-copy { background: #00e5ff; color: #000; border: none; padding: 8px 20px; border-radius: 6px; font-weight: bold; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; }
.btn-copy:hover { box-shadow: 0 0 15px rgba(0, 229, 255, 0.4); }

/* 动画 */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
</style>