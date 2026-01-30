<template>
  <div class="topology-container">
    <TopologyHeader
        v-model="currentProject"
        :projects="projects"
        :loading="loading"
        @refresh="initData"
        @create="showCreateModal = true"
        @change="handleProjectChange"
    />

    <div class="main-layout">
      <TopologySidebar
          :combinations="combinations"
          :active-id="activeComboId"
          :has-project="!!currentProject"
          @select="loadGraphDetail"
          @delete="handleDelete"
      />

      <TopologyCanvas
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
          <div class="modal-body">
            <div class="input-group">
              <label>PROJECT NAME</label>
              <div class="custom-dropdown" v-click-outside="() => showFormDrop = false">
                <div class="dropdown-trigger combo-input">
                  <input v-model="newForm.projectName" placeholder="Select or type new..." @focus="showFormDrop = true" class="inner-input" />
                  <span class="select-arrow" :class="{ open: showFormDrop }" @click.stop="showFormDrop = !showFormDrop"></span>
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
          <div class="modal-foot">
            <button class="btn-modal-cancel" @click="showCreateModal = false">CANCEL</button>
            <button class="btn-modal-confirm" @click="submitCreate" :disabled="!newForm.name || !newForm.projectName">GENERATE GRAPH</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import {ref, onMounted, computed, nextTick} from 'vue';
import axios from 'axios';
import TopologyHeader from './TopologyHeader.vue';
import TopologySidebar from './TopologySidebar.vue';
import TopologyCanvas from './TopologyCanvas.vue'; // 引入最后一块拼图

// 点击外部指令 (用于弹窗下拉菜单)
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

const projects = ref([]);
const currentProject = ref('');
const combinations = ref([]);
const baseOperates = ref([]);
const activeGraph = ref(null);
const activeComboId = ref(null);
const loading = ref(false);
const showCreateModal = ref(false);
const showFormDrop = ref(false);
const newForm = ref({ projectName: '', name: '', desc: '' });

const filteredProjects = computed(() => {
  if (!newForm.value.projectName) return projects.value;
  return projects.value.filter(p => p.toLowerCase().includes(newForm.value.projectName.toLowerCase()));
});

const initData = async () => {
  loading.value = true;
  try {
    const [projRes, baseRes] = await Promise.all([
      axios.get(`${API_BASE}/all-project`),
      axios.get(BASE_OP_API)
    ]);
    projects.value = projRes.data.data || [];
    baseOperates.value = baseRes.data.data || [];
    if (!currentProject.value && projects.value.length > 0) currentProject.value = projects.value[0];
    await fetchCombinations();
  } catch (err) { console.error(err); } finally { loading.value = false; }
};

const fetchCombinations = async () => {
  if (!currentProject.value) return;
  try {
    const res = await axios.get(`${API_BASE}/all-combination`, { params: { projectName: currentProject.value } });
    combinations.value = res.data.data || [];
  } catch (err) { console.error(err); }
};

const handleProjectChange = () => {
  activeGraph.value = null;
  activeComboId.value = null;
  fetchCombinations();
};

const loadGraphDetail = async (id) => {
  activeComboId.value = id;
  try {
    const res = await axios.get(`${API_BASE}/graph/${id}`);
    activeGraph.value = res.data.data;
  } catch (err) { alert('Load Failed'); }
};

const selectFormProject = (p) => {
  newForm.value.projectName = p;
  showFormDrop.value = false;
};

const submitCreate = async () => {
  const startOp = baseOperates.value.find(b => b.ename === 'START_EMPTY');
  const endOp = baseOperates.value.find(b => b.ename === 'END_EMPTY');
  const payload = {
    combination: { projectName: newForm.value.projectName, combinationName: newForm.value.name, desc: newForm.value.desc, minTime: 0 },
    combinationNodes: [
      { nodeId: 1, baseOperate: startOp, params: [], holdTime: 0, loopCnt: 1 },
      { nodeId: 2, baseOperate: endOp, params: [], holdTime: 0, loopCnt: 1 }
    ],
    combinationEdges: [ { edgeId: 1, fromNodeId: 1, nextNodeId: 2 } ]
  };
  try {
    const res = await axios.post(`${API_BASE}/insert`, payload);
    if (res.data.success) {
      showCreateModal.value = false;
      currentProject.value = newForm.value.projectName;
      newForm.value = { projectName: '', name: '', desc: '' };
      await initData();
    }
  } catch (err) { alert('Insert Failed'); }
};

const handleUpdate = async (result) => {
  if (!result) return;
  loading.value = true;
  try {
    await axios.post(`${API_BASE}/update`, result);
    alert('Successfully Updated');
    await fetchCombinations();
  } finally { loading.value = false; }
};

const handleDelete = async (item) => {
  if (!confirm(`Permanently delete ${item.combinationName}?`)) return;
  try {
    await axios.delete(`${API_BASE}/graph/${item.id}`);
    if (activeComboId.value === item.id) activeGraph.value = null;
    await initData();
  } catch (err) { alert('Delete Failed'); }
};

onMounted(initData);
</script>

<style scoped>
.topology-container { height: 100vh; background: #050608; color: #e0e0e0; display: flex; flex-direction: column; font-family: 'Inter', system-ui, sans-serif; overflow: hidden; }
.main-layout { flex: 1; display: grid; grid-template-columns: 320px 1fr; overflow: hidden; }

/* 仅保留 Modal 相关的样式 */
.modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-card { background: #0d0f17; border: 1px solid rgba(79, 100, 255, 0.4); border-radius: 12px; width: 480px; padding: 30px; box-shadow: 0 20px 80px rgba(0,0,0,1); }
.modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 1px solid #222; padding-bottom: 15px; }
.modal-head h3 { margin: 0; font-size: 1rem; color: #fff; letter-spacing: 1px; }
.close-x { background: transparent; border: none; color: #555; font-size: 1.5rem; cursor: pointer; }
.input-group { margin-bottom: 20px; }
.input-group label { display: block; font-size: 0.65rem; color: #4f64ff; font-weight: bold; margin-bottom: 8px; }
.input-group input, .input-group textarea { width: 100%; background: #000; border: 1px solid #222; color: #fff; padding: 12px; border-radius: 6px; outline: none; box-sizing: border-box; }
.modal-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 35px; }
.btn-modal-cancel { background: transparent; border: 1px solid #333; color: #666; padding: 10px 25px; border-radius: 4px; cursor: pointer; font-weight: bold; }
.btn-modal-confirm { background: #4f64ff; color: #fff; border: none; padding: 12px 30px; border-radius: 4px; font-weight: 800; font-size: 0.8rem; cursor: pointer; }
.btn-modal-confirm:disabled { opacity: 0.3; cursor: not-allowed; }

.custom-dropdown { position: relative; min-width: 140px; }
.dropdown-trigger.combo-input { padding: 0 16px; display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.03); border: 1px solid #222; border-radius: 6px; }
.inner-input { background: transparent !important; border: none !important; color: #fff !important; padding: 12px 0 !important; width: 100%; outline: none; }
.select-arrow { width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #4f64ff; transition: 0.3s; }
.select-arrow.open { transform: rotate(180deg); }
.dropdown-menu { position: absolute; top: calc(100% + 5px); left: 0; width: 100%; background: #0d0f17; border: 1px solid #222; border-radius: 6px; padding: 5px; list-style: none; z-index: 1001; }
.dropdown-menu li { padding: 10px; color: #888; cursor: pointer; border-radius: 4px; }
.dropdown-menu li:hover { background: #1a1a1a; color: #4f64ff; }
.scrollable-menu { max-height: 150px; overflow-y: auto; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>