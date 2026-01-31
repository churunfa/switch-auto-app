<template>
  <aside class="sidebar">
    <div class="sidebar-info">
      <div class="label-group">
        <span class="label">CONFIGURATIONS</span>
        <span class="count">{{ combinations.length }}</span>
      </div>
      <div class="search-box">
        <input v-model="searchQuery" placeholder="Filter..." class="mini-search" />
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
            <button class="btn-delete-tiny" @click.stop="$emit('delete', item)">×</button>
          </div>
          <p class="desc">{{ item.desc || 'No description provided.' }}</p>

          <div class="card-actions">
            <button
                class="btn-action exec"
                :disabled="isAnyTaskRunning && !item.asyncRunning"
                @click.stop="handleExec(item.id)"
            >
              ▶ 执行
            </button>

            <button
                v-if="!item.asyncRunning"
                class="btn-action loop"
                :disabled="isAnyTaskRunning"
                @click.stop="handleAsyncExec(item.id)"
            >
              🔄 循环
            </button>
            <button
                v-else
                class="btn-action stop"
                @click.stop="handleStop"
            >
              ■ 停止
            </button>
          </div>

          <div class="card-footer">
            <span class="tag">{{ item.projectName }}</span>
            <span class="time">#{{ String(item.id).padStart(3, '0') }}</span>
          </div>
        </div>
      </div>

      <div v-if="!filteredList.length" class="empty-list">
        <div class="empty-icon">📂</div>
        <p>{{ hasProject ? 'No graph matches' : 'Select a project' }}</p>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed } from 'vue';
import {ElMessage} from "element-plus";

const props = defineProps({
  combinations: {
    type: Array,
    default: () => []
  },
  activeId: [Number, String],
  hasProject: Boolean
});

const emit = defineEmits(['select', 'delete', 'refresh-status']);

const searchQuery = ref('');

// 判断全局是否有任务在执行
const isAnyTaskRunning = computed(() => {
  return props.combinations.some(item => item.asyncRunning);
});

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
    await fetch(`http://localhost:8080/api/combination-graph/exec/${id}`, { method: 'POST' });
    ElMessage.success('执行指令已发送');
  } catch (e) { console.error(e); }
};

const handleAsyncExec = async (id) => {
  try {
    await fetch(`http://localhost:8080/api/combination-graph/async-exec/${id}`, { method: 'POST' });
    emit('refresh-status');
  } catch (e) { console.error(e); }
};

const handleStop = async () => {
  try {
    await fetch(`http://localhost:8080/api/combination-graph/stop-async-exec`, { method: 'POST' });
    emit('refresh-status');
  } catch (e) { console.error(e); }
};
</script>

<style scoped>
.sidebar { background: #08090d; border-right: 1px solid rgba(255,255,255,0.03); display: flex; flex-direction: column; height: 100%; }

/* --- 修改：异步执行中的任务样式 改为荧光绿 --- */
.combo-card.running-status {
  border-color: rgba(0, 255, 136, 0.4);
  background: rgba(0, 255, 136, 0.05);
  box-shadow: 0 0 15px rgba(0, 255, 136, 0.15);
}
.combo-card.running-status .card-glow {
  opacity: 1;
  background: #00ff88;
  box-shadow: 0 0 15px #00ff88;
}
.combo-card.running-status .name {
  color: #00ff88;
  text-shadow: 0 0 5px rgba(0, 255, 136, 0.3);
}

/* 操作按钮区域样式 */
.card-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.btn-action {
  flex: 1;
  padding: 6px 0;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.btn-action:disabled {
  opacity: 0.2; /* 降低非执行项透明度，使其更明显地处于禁用态 */
  cursor: not-allowed;
  filter: grayscale(1);
}

.exec { background: rgba(79, 100, 255, 0.1); color: #4f64ff; border-color: rgba(79, 100, 255, 0.3); }
.exec:hover:not(:disabled) { background: #4f64ff; color: #fff; }

.loop { background: rgba(0, 255, 136, 0.1); color: #00ff88; border-color: rgba(0, 255, 136, 0.3); }
.loop:hover:not(:disabled) { background: #00ff88; color: #000; }

/* 停止按钮：虽然卡片是绿色，但停止按钮保持醒目红色以警示 */
.stop {
  background: rgba(255, 64, 129, 0.15);
  color: #ff4081;
  border-color: #ff4081;
  animation: blink 1.5s infinite;
}

@keyframes blink {
  50% { opacity: 0.6; }
}

/* 原有基础样式保持不变... */
.sidebar-info { padding: 15px 20px; border-bottom: 1px solid #111; }
.label-group { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.sidebar-info .label { font-size: 0.75rem; color: #444; font-weight: bold; letter-spacing: 1px; }
.sidebar-info .count { background: #1a1a1a; color: #4f64ff; font-size: 0.7rem; padding: 2px 8px; border-radius: 10px; font-weight: bold; }
.mini-search { width: 100%; background: rgba(255,255,255,0.02); border: 1px solid #1a1a1a; border-radius: 4px; padding: 6px 10px; color: #ccc; font-size: 0.7rem; outline: none; transition: 0.3s; }
.mini-search:focus { border-color: #4f64ff; background: #000; }
.list-wrapper { flex: 1; overflow-y: auto; padding: 15px; scrollbar-width: thin; scrollbar-color: #222 transparent; }
.combo-card { position: relative; background: #0d0f17; border: 1px solid #1a1a1a; border-radius: 10px; margin-bottom: 15px; cursor: pointer; transition: 0.3s; overflow: hidden; }
.combo-card.active { border-color: #4f64ff; background: rgba(79, 100, 255, 0.05); }
.card-glow { position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: #4f64ff; opacity: 0; transition: 0.3s; }
.card-content { padding: 15px; }
.card-title { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.name { font-weight: 800; color: #fff; font-size: 0.9rem; }
.btn-delete-tiny { background: transparent; border: none; color: #333; font-size: 1.2rem; cursor: pointer; }
.desc { font-size: 0.75rem; color: #666; margin-bottom: 12px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card-footer { display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem; }
.tag { color: #4f64ff; background: rgba(79, 100, 255, 0.1); padding: 2px 8px; border-radius: 4px; font-weight: bold; }
.time { color: #333; font-family: monospace; }
</style>