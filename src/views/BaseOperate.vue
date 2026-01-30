<template>
  <div class="dashboard">
    <header class="glass-header">
      <div class="brand">
        <span class="logo-icon">🕹️</span>
        <div class="brand-text">
          <h2>SWITCH COMMANDER</h2>
          <span class="badge">PHASE 1: BASE OPS</span>
        </div>
      </div>

      <div :class="['conn-status', isConnected ? 'status-online' : 'status-offline']">
        <div class="indicator"></div>
        {{ isConnected ? '后端服务已连接' : '等待后端连接...' }}
      </div>
    </header>

    <div class="main-layout">
      <section class="command-center">
        <div class="toolbar">
          <span class="tag">可用基础指令集</span>
          <span class="count">{{ baseOperates.length }} KEYS DETECTED</span>
        </div>

        <div class="button-grid">
          <div v-for="btn in baseOperates" :key="btn.id" class="neon-card">
            <div class="card-top">
              <span class="key-id">ID: {{ btn.id }}</span>
              <span class="key-name">{{ btn.name }}</span>
            </div>

            <div class="card-meta">
              <code>{{ btn.ename }}</code>
              <div class="timing-chips">
                <span>E: {{ btn.minExecTime }}ms</span>
                <span>R: {{ btn.minResetTime }}ms</span>
              </div>
            </div>

            <div v-if="btn.paramNames && btn.paramNames.length > 0" class="param-box">
              <div v-for="(pName, pIdx) in btn.paramNames" :key="pIdx" class="input-row">
                <label>{{ pName }}</label>
                <input
                    v-model="btn.userInputParams[pIdx]"
                    placeholder="0"
                    type="text"
                />
              </div>
            </div>
            <div v-else class="param-placeholder">无参数</div>

            <div class="card-actions">
              <div v-if="isDisplayOnlyKey(btn.ename)" class="display-only-tag">
                <span class="dot"></span> 系统指令
              </div>

              <template v-else>
                <button
                    class="btn-op press"
                    @click="handleAction(btn, false)"
                    :disabled="btn.loading"
                >
                  {{ btn.loading ? '...' : 'PRESS' }}
                </button>

                <button
                    v-if="!isSingleActionKey(btn.ename)"
                    class="btn-op release"
                    @click="handleAction(btn, true)"
                    :disabled="btn.loading"
                >
                  RELEASE
                </button>

                <div v-else class="single-action-tag">
                  SINGLE ACTION
                </div>
              </template>
            </div>
          </div>
        </div>
      </section>

      <aside class="log-sidebar">
        <div class="log-header">
          <span>终端执行日志</span>
          <button @click="logs = []" class="clear-btn">清空</button>
        </div>
        <div class="log-body" ref="logContainer">
          <div v-for="(log, index) in logs" :key="index" :class="['log-entry', log.type]">
            <span class="t-stamp">[{{ log.time }}]</span>
            <span class="t-msg">{{ log.msg }}</span>
          </div>
          <div v-if="!logs.length" class="log-placeholder">等待指令输出...</div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const API_BASE = 'http://localhost:8080/api/base-operate';
const baseOperates = ref([]);
const isConnected = ref(false);
const logs = ref([]);

// 1. 仅展示，不可操作的按键
const isDisplayOnlyKey = (ename) => ['START_EMPTY', 'END_EMPTY','SLEEP'].includes(ename);

// 2. 只有 PRESS，没有 RELEASE 的按键
const isSingleActionKey = (ename) => ['RESET_ALL'].includes(ename);

// 获取按键列表
const fetchButtons = async () => {
  try {
    const res = await axios.get(`${API_BASE}/all-base-operates`);
    if (res.data.success) {
      baseOperates.value = res.data.data.map(item => {
        // 新增逻辑：初始化时自动填充后端给的 initParams
        let initialParams = [];
        if (item.paramNames && item.paramNames.length > 0) {
          initialParams = (item.initParams && item.initParams.length === item.paramNames.length)
              ? [...item.initParams]
              : new Array(item.paramNames.length).fill('');
        }

        return {
          ...item,
          loading: false,
          userInputParams: initialParams
        };
      });
      isConnected.value = true;
      addLog('成功获取基础按键列表', 'success');
    }
  } catch (err) {
    isConnected.value = false;
    addLog('后端服务连接异常', 'error');
  }
};

const handleAction = async (btn, reset) => {
  const actionText = reset ? 'RELEASE' : 'PRESS';
  const payload = {
    id: btn.id,
    reset: reset,
    params: btn.userInputParams
  };

  btn.loading = true;
  try {
    const res = await axios.post(`${API_BASE}/exec-base-operate`, payload);
    if (res.data.success) {
      addLog(`指令 [${btn.name}] ${actionText} 执行成功`, 'success');
    } else {
      addLog(`执行失败: ${res.data.message || '未知错误'}`, 'error');
    }
  } catch (err) {
    addLog(`网络请求异常: ${btn.ename}`, 'error');
  } finally {
    btn.loading = false;
  }
};

const addLog = (msg, type = 'info') => {
  const time = new Date().toLocaleTimeString().split(' ')[0];
  logs.value.unshift({ time, msg, type });
  if (logs.value.length > 100) logs.value.pop();
};

onMounted(fetchButtons);
</script>

<style scoped>
.dashboard {
  height: 100vh;
  background: radial-gradient(circle at 0% 0%, #161b2e 0%, #0a0b10 100%);
  color: #e0e0e0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'Inter', -apple-system, sans-serif;
}

.glass-header {
  padding: 12px 30px;
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 10;
  flex-shrink: 0;
}

.brand { display: flex; align-items: center; gap: 12px; }
.logo-icon { font-size: 1.8rem; filter: drop-shadow(0 0 8px #4f64ff); }
.brand-text h2 { margin: 0; font-size: 1.1rem; letter-spacing: 2px; color: #4f64ff; font-weight: 800; }
.badge { font-size: 0.6rem; background: #4f64ff; color: white; padding: 1px 6px; border-radius: 4px; }

.conn-status { display: flex; align-items: center; gap: 10px; font-size: 0.75rem; padding: 6px 16px; border-radius: 20px; font-weight: bold; transition: 0.3s; }
.status-online { color: #00ff88; border: 1px solid rgba(0, 255, 136, 0.3); background: rgba(0, 255, 136, 0.05); }
.status-offline { color: #ff4444; border: 1px solid rgba(255, 68, 68, 0.3); background: rgba(255, 68, 68, 0.05); }
.indicator { width: 8px; height: 8px; border-radius: 50%; background: currentColor; box-shadow: 0 0 8px currentColor; }

/* 关键修复：min-height: 0 确保 Grid 内部滚动正常 */
.main-layout {
  display: grid;
  grid-template-columns: 1fr 360px;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* 关键修复：height: 100% */
.command-center {
  padding: 25px;
  overflow-y: auto;
  height: 100%;
}
.toolbar { margin-bottom: 20px; display: flex; justify-content: space-between; border-left: 3px solid #4f64ff; padding-left: 12px; }
.tag { font-weight: bold; color: #4f64ff; font-size: 0.85rem; letter-spacing: 1px; }
.count { color: #555; font-size: 0.75rem; }

.button-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 18px;
}
.neon-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.25s ease;
  display: flex;
  flex-direction: column;
}
.neon-card:hover {
  transform: translateY(-4px);
  background: rgba(255, 255, 255, 0.05);
  border-color: #4f64ff;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}

.card-top { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
.key-id { font-size: 0.65rem; color: #4f64ff; font-family: monospace; opacity: 0.8; }
.key-name { font-size: 1.4rem; font-weight: 900; color: #fff; }
.card-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.card-meta code { font-size: 0.7rem; color: #666; font-family: 'Consolas', monospace; }
.timing-chips { display: flex; gap: 6px; font-size: 0.65rem; color: #888; }

.param-box {
  background: #000;
  padding: 10px;
  border-radius: 6px;
  margin-bottom: 12px;
  border: 1px solid #1a1a1a;
}
.input-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.input-row label { font-size: 0.65rem; color: #4f64ff; font-weight: bold; }
.input-row input {
  background: transparent; border: none; border-bottom: 1px solid #333;
  color: #00ff88; width: 65px; text-align: right; outline: none; font-family: monospace;
}
.input-row input:focus { border-color: #00ff88; }
.param-placeholder { height: 40px; color: #333; font-size: 0.7rem; display: flex; align-items: center; }

.card-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.btn-op {
  border: none; padding: 8px; border-radius: 6px; font-weight: 800; cursor: pointer; font-size: 0.7rem; transition: 0.2s;
}
.press { background: #4f64ff; color: #fff; }
.release { background: rgba(255,255,255,0.05); color: #aaa; border: 1px solid #333; }
.btn-op:hover:not(:disabled) { filter: brightness(1.2); }
.btn-op:active:not(:disabled) { transform: scale(0.95); }
.btn-op:disabled { opacity: 0.3; cursor: not-allowed; }

/* 优化展示标签 */
.display-only-tag {
  grid-column: span 2;
  display: flex; align-items: center; justify-content: center;
  height: 34px; color: #555; border: 1px dashed #222; border-radius: 6px;
  font-size: 0.7rem; gap: 8px;
}
.display-only-tag .dot { width: 4px; height: 4px; background: #444; border-radius: 50%; }

.single-action-tag {
  display: flex; align-items: center; justify-content: center;
  font-size: 0.6rem; color: #333; border: 1px dashed #222; border-radius: 6px;
  text-transform: uppercase; font-weight: bold;
}

.log-sidebar {
  background: #08090d;
  border-left: 1px solid rgba(255,255,255,0.05);
  display: flex;
  flex-direction: column;
}
.log-header {
  padding: 18px;
  background: rgba(0,0,0,0.2);
  display: flex; justify-content: space-between; align-items: center;
  font-size: 0.8rem; font-weight: bold; color: #4f64ff;
}
.clear-btn { background: transparent; border: 1px solid #333; color: #555; font-size: 0.65rem; cursor: pointer; padding: 2px 10px; border-radius: 4px; }
.clear-btn:hover { color: #fff; border-color: #666; }

.log-body { flex: 1; padding: 15px; overflow-y: auto; font-family: 'Consolas', monospace; font-size: 0.75rem; }
.log-entry { margin-bottom: 8px; line-height: 1.4; border-left: 2px solid #1a1a1a; padding-left: 10px; }
.t-stamp { color: #333; margin-right: 8px; font-size: 0.7rem; }
.success { border-left-color: #00ff88; color: #00ff88; }
.error { border-left-color: #ff4444; color: #ff4444; }
.log-placeholder { text-align: center; margin-top: 50px; color: #1a1a1a; font-style: italic; }

::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: #4f64ff; }
</style>