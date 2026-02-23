<template>
  <header class="glass-header">
    <div class="brand">
      <span class="logo-icon">🕸️</span>
      <div class="brand-text">
        <h2>TOPOLOGY CONFIG</h2>
        <span class="version">V2.1 PRO</span>
      </div>
    </div>

    <div v-if="asyncExecInfo?.asyncRunning" class="status-bar">
      <div class="task-tag">RUNNING</div>
      <div class="task-info">
        <span class="label">PROJECT:</span>
        <span class="val">{{ asyncExecInfo.graph?.combination?.projectName }}</span>
        <span class="divider">|</span>
        <span class="label">TASK:</span>
        <span class="val">{{ asyncExecInfo.graph?.combination?.combinationName }}</span>
        <span class="divider">|</span>
        <span class="label">TIME:</span>
        <span class="val">{{ runningTime }}</span>
        <span class="divider">|</span>
        <span class="label">COUNT:</span>
        <span class="val">{{ asyncExecInfo.asyncExecCnt }}</span>
      </div>
      <button class="btn-stop" @click="stopTask">
        <span class="stop-icon">■</span> STOP
      </button>
    </div>

    <div class="project-area">
      <div class="selector-container">
        <label>PROJECT</label>
        <div class="custom-dropdown" v-click-outside="() => showProjectDrop = false">
          <div class="dropdown-trigger" @click="showProjectDrop = !showProjectDrop">
            <span class="selected-text">{{ modelValue || 'SELECT PROJECT' }}</span>
            <span class="select-arrow" :class="{ open: showProjectDrop }"></span>
          </div>

          <transition name="slide-up">
            <ul v-if="showProjectDrop" class="dropdown-menu">
              <li
                  v-for="p in projects"
                  :key="p"
                  :class="{ active: p === modelValue }"
                  @click="selectProject(p)"
              >
                {{ p }}
              </li>
            </ul>
          </transition>
        </div>

        <button class="btn-icon-refresh" @click="$emit('refresh')" :class="{ rotating: loading }">
          <span class="icon">🔄</span>
        </button>
      </div>
      <button class="btn-neon-create" @click="$emit('create')">
        <span class="plus">+</span> NEW GRAPH
      </button>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import axios from 'axios';
import {ElMessage, ElMessageBox} from "element-plus";
import { getApiEndpoint } from '../../utils/api';

const props = defineProps({
  projects: Array,
  modelValue: String, // 对应父组件的 currentProject
  loading: Boolean,
  asyncExecInfo: Object // 从父组件接收轮询的任务状态
});

const emit = defineEmits(['update:modelValue', 'refresh', 'create', 'change', 'refresh-status']);

const showProjectDrop = ref(false);
const now = ref(Date.now()); // 用于计算执行时间的实时响应式数据
let localTimer = null;

// 1. 本地计时器：每秒更新一次 now，让显示的时间秒数平滑跳动
const runningTime = computed(() => {
  if (!props.asyncExecInfo?.asyncStartTime) return '00:00:00';
  const diff = Math.floor((now.value - props.asyncExecInfo.asyncStartTime) / 1000);
  if (diff < 0) return '00:00:00';
  const h = Math.floor(diff / 3600).toString().padStart(2, '0');
  const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
  const s = (diff % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
});

// 2. 停止任务接口调用
const stopTask = async () => {
  try {
    // 使用 Element Plus 的确认框
    await ElMessageBox.confirm(
        '此操作将强制终止正在运行的任务队列，是否继续？',
        '终止异步执行',
        {
          confirmButtonText: '确定停止',
          cancelButtonText: '取消',
          type: 'warning',
          // 关键：添加自定义类名以便在下方 style 中定制样式
          customClass: 'custom-confirm-box',
          center: true,
        }
    );

    // 用户点击了确定
    const res = await axios.post(getApiEndpoint('COMBINATION_GRAPH_STOP_ASYNC'));
    if (res.data.success || res.status === 200) {
      ElMessage.success('任务已成功下发停止指令');
      emit('refresh-status');
    }
  } catch (error) {
    // 如果是用户点击取消，这里不做处理；如果是接口报错，打印日志
    if (error !== 'cancel') {
      console.error("Failed to stop task", error);
      ElMessage.error('停止任务失败，请检查网络');
    }
  }
};

const selectProject = (p) => {
  emit('update:modelValue', p);
  emit('change', p);
  showProjectDrop.value = false;
};

onMounted(() => {
  // 开启本地时间轮询
  localTimer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (localTimer) clearInterval(localTimer);
});

// 指令定义
const vClickOutside = {
  mounted(el, binding) {
    el.clickOutsideEvent = (event) => {
      if (!(el === event.target || el.contains(event.target))) binding.value();
    };
    document.addEventListener("click", el.clickOutsideEvent);
  },
  unmounted(el) {
    document.removeEventListener("click", el.clickOutsideEvent);
  }
};
</script>

<style scoped>
.glass-header { height: 70px; background: rgba(13, 15, 23, 0.85); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255, 255, 255, 0.03); display: flex; justify-content: space-between; align-items: center; padding: 0 30px; z-index: 100; }

/* 任务状态栏样式 - 绿色风格以匹配运行状态 */
.status-bar {
  display: flex;
  align-items: center;
  gap: 15px;
  background: rgba(0, 255, 136, 0.05);
  padding: 8px 15px;
  border-radius: 12px;
  border: 1px solid rgba(0, 255, 136, 0.2);
  animation: glow 2s infinite alternate;
}

@keyframes glow {
  from { box-shadow: 0 0 5px rgba(0, 255, 136, 0.1); }
  to { box-shadow: 0 0 15px rgba(0, 255, 136, 0.2); }
}

.task-tag {
  background: #00ff88;
  color: #000;
  font-size: 0.6rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
  letter-spacing: 1px;
}

.task-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  color: #ccc;
}

.task-info .label { color: #666; font-weight: bold; }
.task-info .val { color: #00ff88; font-family: 'Courier New', Courier, monospace; font-weight: bold; }
.task-info .divider { color: #333; }

.btn-stop {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #ff4081;
  color: #ff4081;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: all 0.3s;
}

.btn-stop:hover {
  background: #ff4081;
  color: #fff;
}

.stop-icon { font-size: 0.8rem; }

/* 原有基础样式... */
.brand { display: flex; align-items: center; gap: 15px; }
.logo-icon { font-size: 2rem; filter: drop-shadow(0 0 10px #4f64ff); }
.brand-text h2 { margin: 0; font-size: 1.1rem; letter-spacing: 2px; color: #4f64ff; font-weight: 900; }
.version { font-size: 0.6rem; color: #444; font-weight: bold; }
.project-area { display: flex; align-items: center; gap: 15px; }
.selector-container { display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.6); padding: 5px 12px; border-radius: 8px; border: 1px solid #1a1a1a; }
.selector-container label { font-size: 0.65rem; color: #555; font-weight: bold; }
.custom-dropdown { position: relative; min-width: 140px; user-select: none; }
.dropdown-trigger { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(0, 255, 136, 0.2); color: #00ff88; padding: 8px 16px; border-radius: 20px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 0.8rem; transition: all 0.3s ease; }
.select-arrow { width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #00ff88; transition: 0.3s; }
.select-arrow.open { transform: rotate(180deg); }
.dropdown-menu { position: absolute; top: calc(100% + 10px); left: 0; width: 100%; background: rgba(15, 18, 26, 0.98); backdrop-filter: blur(25px); border: 1px solid rgba(0, 255, 136, 0.3); border-radius: 12px; z-index: 1000; margin: 0; padding: 6px; list-style: none;}
.dropdown-menu li { padding: 10px 16px; color: #a0a0a0; font-size: 0.8rem; cursor: pointer; border-radius: 8px; }
.dropdown-menu li:hover { background: rgba(255, 255, 255, 0.05); color: #00ff88; }
.dropdown-menu li.active { background: rgba(0, 255, 136, 0.12); color: #00ff88; font-weight: bold; }
.btn-icon-refresh { background: transparent; border: none; color: #444; cursor: pointer; }
.btn-neon-create { background: #4f64ff; color: #fff; border: none; padding: 10px 20px; border-radius: 20px; font-weight: 800; font-size: 0.75rem; cursor: pointer; }
.rotating { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.25s ease-out; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(-8px) scale(0.98); }
</style>