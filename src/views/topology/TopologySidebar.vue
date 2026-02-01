<template>
  <aside class="sidebar">
    <div class="sidebar-info">
      <div class="label-group">
        <span class="label">CONFIGURATIONS</span>
        <span class="count">{{ combinations.length }}</span>
      </div>
      <div class="search-box">
        <input
            v-model="searchQuery"
            placeholder="Filter by name..."
            class="mini-search"
            spellcheck="false"
        />
      </div>
    </div>

    <div class="list-wrapper">
      <div
          v-for="item in filteredList"
          :key="item.id"
          :class="['combo-card',
                   activeId === item.id ? 'active' : '',
                   item.asyncRunning ? 'running-status' : '']"
          @click="$emit('select', item.id)"
      >
        <div class="card-glow"></div>

        <div class="card-content">
          <div class="card-title">
            <span class="name">{{ item.combinationName }}</span>
            <button class="btn-delete-tiny" @click.stop="$emit('delete', item)" title="Delete Graph">×</button>
          </div>

          <p class="desc">{{ item.desc || 'No description provided.' }}</p>

          <div class="card-actions">
            <button
                class="btn-action exec"
                :disabled="isAnyTaskRunning && !item.asyncRunning"
                @click.stop="handleExec(item.id)"
                title="Run Once"
            >
              ▶ 执行
            </button>

            <button
                v-if="!item.asyncRunning"
                class="btn-action loop"
                :disabled="isAnyTaskRunning"
                @click.stop="handleAsyncExec(item.id)"
                title="Start Async Loop"
            >
              🔄 循环
            </button>
            <button
                v-else
                class="btn-action stop"
                @click.stop="handleStop"
                title="Stop Running Task"
            >
              ■ 停止
            </button>

            <button
                class="btn-action json-view"
                @click.stop="$emit('view-json', item)"
                title="View Source JSON"
            >
              📋 JSON
            </button>
          </div>

          <div class="card-footer">
            <span class="tag">{{ item.projectName }}</span>
            <span class="tag">耗时:{{ item.minTime }}ms</span>
            <span class="time">ID: {{ String(item.id).padStart(3, '0') }}</span>
          </div>
        </div>
      </div>

      <div v-if="!filteredList.length" class="empty-list">
        <div class="empty-icon">📂</div>
        <p>{{ hasProject ? 'No graph matches search' : 'Please select a project above' }}</p>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed } from 'vue';
import { ElMessage } from "element-plus";

const props = defineProps({
  combinations: {
    type: Array,
    default: () => []
  },
  activeId: [Number, String],
  hasProject: Boolean
});

// 定义事件，包含新增的 view-json
const emit = defineEmits(['select', 'delete', 'refresh-status', 'view-json']);

const searchQuery = ref('');

// 计算属性：判断全局是否有任务在跑（互斥逻辑）
const isAnyTaskRunning = computed(() => {
  return props.combinations.some(item => item.asyncRunning);
});

// 搜索过滤
const filteredList = computed(() => {
  let list = props.combinations;
  if (searchQuery.value) {
    list = list.filter(item =>
        item.combinationName.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
  }
  return list;
});

// --- 接口调用逻辑 ---

const handleExec = async (id) => {
  try {
    // 假设后端地址
    await fetch(`http://localhost:8080/api/combination-graph/exec/${id}`, { method: 'POST' });
    ElMessage.success('执行指令已发送');
  } catch (e) {
    ElMessage.error('执行请求失败');
  }
};

const handleAsyncExec = async (id) => {
  try {
    await fetch(`http://localhost:8080/api/combination-graph/async-exec/${id}`, { method: 'POST' });
    // 触发父组件刷新状态，变为绿色运行态
    emit('refresh-status');
  } catch (e) {
    ElMessage.error('异步任务启动失败');
  }
};

const handleStop = async () => {
  try {
    await fetch(`http://localhost:8080/api/combination-graph/stop-async-exec`, { method: 'POST' });
    emit('refresh-status');
  } catch (e) {
    ElMessage.error('停止指令发送失败');
  }
};
</script>

<style scoped>
/* 侧边栏整体容器 */
.sidebar {
  background: #08090d;
  border-right: 1px solid rgba(255,255,255,0.03);
  display: flex;
  flex-direction: column;
  height: 100%;
  user-select: none;
  /* ✨ 修复点1：防止容器整体被撑大，强制内容限制在 100% 高度内 */
  overflow: hidden;
}

/* 顶部信息栏 */
.sidebar-info {
  padding: 15px 20px;
  border-bottom: 1px solid #111;
  /* ✨ 修复点2：防止头部被压缩 */
  flex-shrink: 0;
}
.label-group { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.sidebar-info .label { font-size: 0.75rem; color: #444; font-weight: bold; letter-spacing: 1px; }
.sidebar-info .count { background: #1a1a1a; color: #4f64ff; font-size: 0.7rem; padding: 2px 8px; border-radius: 10px; font-weight: bold; }

/* 搜索框 */
.mini-search { width: 100%; background: rgba(255,255,255,0.02); border: 1px solid #1a1a1a; border-radius: 4px; padding: 6px 10px; color: #ccc; font-size: 0.7rem; outline: none; transition: 0.3s; box-sizing: border-box; }
.mini-search:focus { border-color: #4f64ff; background: #000; }

/* 列表滚动区 */
.list-wrapper {
  flex: 1;
  /* ✨ 修复点3 (核心)：必须设置 min-height: 0，否则 Flex 子项不会收缩，导致 overflow-y 失效 */
  min-height: 0;
  overflow-y: auto;
  padding: 15px;
  scrollbar-width: thin;
  scrollbar-color: #222 transparent;
}
.list-wrapper::-webkit-scrollbar { width: 4px; }
.list-wrapper::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }

/* 卡片基础样式 */
.combo-card { position: relative; background: #0d0f17; border: 1px solid #1a1a1a; border-radius: 10px; margin-bottom: 15px; cursor: pointer; transition: all 0.2s ease; overflow: hidden; }
.combo-card:hover { border-color: #333; transform: translateY(-2px); }

/* 激活状态 (选中) */
.combo-card.active { border-color: #4f64ff; background: rgba(79, 100, 255, 0.05); }
.card-glow { position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: #4f64ff; opacity: 0; transition: 0.3s; }
.combo-card.active .card-glow { opacity: 1; }

/* 运行状态 (绿色荧光) */
.combo-card.running-status {
  border-color: rgba(0, 255, 136, 0.4);
  background: rgba(0, 255, 136, 0.05);
  box-shadow: 0 0 15px rgba(0, 255, 136, 0.1);
}
.combo-card.running-status .card-glow { opacity: 1; background: #00ff88; box-shadow: 0 0 10px #00ff88; }
.combo-card.running-status .name { color: #00ff88; text-shadow: 0 0 5px rgba(0, 255, 136, 0.3); }

/* 卡片内容布局 */
.card-content { padding: 15px; }
.card-title { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.name { font-weight: 800; color: #fff; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
.btn-delete-tiny { background: transparent; border: none; color: #333; font-size: 1.2rem; cursor: pointer; transition: 0.2s; padding: 0 5px; }
.btn-delete-tiny:hover { color: #ff5460; }

.desc { font-size: 0.75rem; color: #666; margin-bottom: 15px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 2.8em; }

/* 操作按钮区域 */
.card-actions { display: flex; gap: 8px; margin-bottom: 15px; }
.btn-action {
  flex: 1;
  padding: 6px 0;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}
.btn-action:disabled { opacity: 0.3; cursor: not-allowed; filter: grayscale(1); }

/* 按钮颜色变体 */
/* 执行 */
.exec { background: rgba(79, 100, 255, 0.1); color: #4f64ff; border-color: rgba(79, 100, 255, 0.3); }
.exec:hover:not(:disabled) { background: #4f64ff; color: #fff; }

/* 循环 */
.loop { background: rgba(0, 255, 136, 0.1); color: #00ff88; border-color: rgba(0, 255, 136, 0.3); }
.loop:hover:not(:disabled) { background: #00ff88; color: #000; }

/* 停止 (闪烁警告) */
.stop { background: rgba(255, 64, 129, 0.15); color: #ff4081; border-color: #ff4081; animation: blink 1.5s infinite; }

/* ✨ JSON (青色) */
.json-view {
  background: rgba(0, 229, 255, 0.1);
  color: #00e5ff;
  border-color: rgba(0, 229, 255, 0.3);
}
.json-view:hover:not(:disabled) { background: #00e5ff; color: #000; box-shadow: 0 0 10px rgba(0, 229, 255, 0.3); }

/* 底部标签 */
.card-footer { display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; }
.tag { color: #4f64ff; background: rgba(79, 100, 255, 0.1); padding: 2px 8px; border-radius: 4px; font-weight: bold; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.time { color: #444; font-family: 'Courier New', monospace; }

/* 空状态 */
.empty-list { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 50%; color: #444; margin-top: 40px; }
.empty-icon { font-size: 2rem; margin-bottom: 10px; opacity: 0.5; }

@keyframes blink { 50% { opacity: 0.6; } }
</style>