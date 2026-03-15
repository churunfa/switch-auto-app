<template>
  <div class="dashboard">
    <header class="glass-header">
      <div class="brand">
        <span class="logo-icon">🤖</span>
        <div class="brand-text">
          <h2>AUTOMATION TASK</h2>
          <span class="badge">AI-POWERED EXECUTION</span>
        </div>
      </div>

      <div :class="['conn-status', isDeviceConnected ? 'status-online' : 'status-offline']">
        <div class="indicator"></div>
        {{ isDeviceConnected ? '设备已连接' : '等待设备连接...' }}
      </div>
    </header>

    <div class="main-layout">
      <!-- 第一步：设备选择 -->
      <section v-if="currentStep === 1" class="device-section">
        <div class="toolbar">
          <span class="tag">采集卡设备选择</span>
          <button class="btn-refresh" @click="loadDevices" :disabled="deviceList.length === 0">
            <span class="icon">🔄</span> 刷新设备
          </button>
        </div>

        <div class="device-list">
          <div
              v-for="device in deviceList"
              :key="device.deviceId"
              :class="['device-card', { selected: selectedDevice?.deviceId === device.deviceId }]"
              @click="selectDevice(device)"
          >
            <div class="card-header">
              <span class="device-name">{{ device.deviceName }}</span>
              <span v-if="selectedDevice?.deviceId === device.deviceId && isDeviceConnected" class="status-badge-connected">
                ✓ 已连接
              </span>
            </div>
            
            <div class="device-specs">
              <span class="spec-item">📺 {{ device.width }}×{{ device.height }}</span>
              <span class="spec-item">🎬 {{ device.framerate }} FPS</span>
            </div>

            <div class="card-actions">
              <button 
                  v-if="selectedDevice?.deviceId === device.deviceId && !isDeviceConnected"
                  class="btn-connect"
                  @click.stop="connectDevice"
              >
                🔌 连接设备
              </button>
            </div>
          </div>

          <div v-if="deviceList.length === 0" class="empty-state">
            <div class="empty-icon">📭</div>
            <p class="empty-text">未找到采集卡设备</p>
            <p class="empty-hint">请检查设备连接后点击刷新</p>
            <button class="btn-refresh-empty" @click="loadDevices">刷新设备列表</button>
          </div>
        </div>

        <div v-if="isDeviceConnected" class="next-step-action">
          <button class="btn-next" @click="goToNextStep">
            进入任务配置 →
          </button>
        </div>
      </section>

      <!-- 第二步：聊天界面 -->
      <section v-if="currentStep === 2" class="chat-section">
        <div class="chat-header">
          <div class="header-left">
            <button class="btn-back" @click="goBack">← 返回</button>
            <div class="device-status">
              <span class="status-dot online"></span>
              <span>{{ selectedDevice?.deviceName }}</span>
            </div>
          </div>
          
          <div class="header-right">
            <select v-model="selectedModelId" class="model-select">
              <option value="" disabled>选择模型</option>
              <option v-for="model in modelList" :key="model.id" :value="model.id">
                {{ model.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="chat-messages" ref="chatContainer">
          <div v-if="messages.length === 0" class="welcome-message">
            <div class="welcome-avatar">🤖</div>
            <div class="welcome-bubble">
              <h3>你好！我是自动化助手</h3>
              <p>请选择模型后输入消息开始对话</p>
            </div>
          </div>

          <div v-for="(msg, index) in messages" :key="index" :class="['message-item', msg.role]">
            <div class="message-avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
            <div class="message-content">
              <div class="message-bubble">

                <div v-if="msg.content" class="status-text">{{ msg.content }}</div>
                <div v-if="msg.loading" class="loading-indicator">
                  <span class="pulse-dot"></span>
                  <span class="loading-text">正在处理...</span>
                </div>
                
              </div>
              <div class="message-time">{{ msg.time }}</div>
            </div>
          </div>
        </div>

        <div class="chat-input-area">
          <input
              v-model="inputMessage"
              type="text"
              placeholder="输入任务指令..."
              class="chat-input"
              :disabled="isExecuting || !selectedModelId"
              @keyup.enter="sendMessage"
          />
          <button 
              class="btn-send"
              :disabled="!inputMessage.trim() || !selectedModelId || isExecuting"
              @click="sendMessage"
          >
            {{ isExecuting ? '发送中...' : '发送' }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '@/utils/api';

const currentStep = ref(1);
const deviceList = ref([]);
const modelList = ref([]);
const selectedDevice = ref(null);
const selectedModelId = ref(null);
const inputMessage = ref('');
const isDeviceConnected = ref(false);
const isExecuting = ref(false);
const messages = ref([]);
const chatContainer = ref(null);

const getCurrentTime = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

const loadDevices = async () => {
  try {
    const res = await api.get('/api/capture-card/devices');
    if (res.success) deviceList.value = res.data;
  } catch (error) { ElMessage.error('加载设备失败'); }
};

const selectDevice = (device) => {
  if (!isDeviceConnected.value) selectedDevice.value = device;
};

const connectDevice = async () => {
  if (!selectedDevice.value) return;
  try {
    const res = await api.post(`/api/capture-card/connect?deviceName=${encodeURIComponent(selectedDevice.value.deviceName)}`);
    if (res.success) {
      isDeviceConnected.value = true;
      ElMessage.success('设备连接成功');
    }
  } catch (error) { ElMessage.error('连接设备失败'); }
};

const loadModels = async () => {
  try {
    const res = await api.get('/api/model/list');
    if (res.success && res.data) {
      modelList.value = res.data.map(item => ({ id: item.id, name: item.modelName || item.name }));
      if (modelList.value.length > 0) selectedModelId.value = modelList.value[0].id;
    }
  } catch (error) { console.error(error); }
};

const goToNextStep = () => { currentStep.value = 2; loadModels(); };
const goBack = () => { currentStep.value = 1; };

const scrollToBottom = () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
};

const sendMessage = async () => {
  if (!inputMessage.value.trim() || !selectedModelId.value) {
    ElMessage.warning('请选择模型并输入消息');
    return;
  }

  const userContent = inputMessage.value;
  messages.value.push({
    role: 'user',
    content: userContent,
    time: getCurrentTime()
  });

  inputMessage.value = '';
  isExecuting.value = true;

  // --- 关键修改 1：使用 reactive 定义助手消息 ---
  const assistantMsg = reactive({
    role: 'assistant',
    content: '准备中...',
    time: getCurrentTime(),
    loading: true
  });
  messages.value.push(assistantMsg);

  try {
    const response = await fetch('http://localhost:8080/api/automation/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceName: selectedDevice.value.deviceName,
        modelConfigId: selectedModelId.value,
        taskDescription: userContent
      })
    });

    if (!response.body) throw new Error('ReadableStream not supported');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        try {
          const json = JSON.parse(trimmed.replace('data:', ''));
          
          // --- 关键修改 2：直接赋值，因为后端发的是状态更新 ---
          assistantMsg.content = json.message;
          
          // 根据进度关闭 loading
          if (json.progress >= 100) {
            assistantMsg.loading = false;
          }
        } catch (e) {
          // 忽略不完整的 JSON 行
        }
      }

      // --- 关键修改 3：给浏览器喘息的机会 ---
      await nextTick();
      const container = document.querySelector('.chat-messages');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  } catch (error) {
    assistantMsg.content = '发生错误：' + error.message;
    assistantMsg.loading = false;
  } finally {
    isExecuting.value = false;
    assistantMsg.loading = false;
  }
};

onMounted(loadDevices);
</script>

<style scoped>
/* 全局容器样式 - 与其他页面一致 */
.dashboard {
  height: 100vh;
  width: 100%;
  background: radial-gradient(circle at 0% 0%, #161b2e 0%, #0a0b10 100%);
  color: #e0e0e0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'Inter', -apple-system, sans-serif;
}

/* 头部样式 */
.glass-header {
  padding: 12px 30px;
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 32px;
}

.brand-text h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 1px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.badge {
  display: inline-block;
  font-size: 10px;
  padding: 2px 8px;
  background: rgba(102, 126, 234, 0.2);
  border: 1px solid rgba(102, 126, 234, 0.5);
  border-radius: 4px;
  color: #667eea;
  margin-top: 4px;
}

/* 连接状态 */
.conn-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
}

.status-online {
  color: #67c23a;
}

.status-offline {
  color: #909399;
}

.indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 主布局 */
.main-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
  padding: 20px;
  gap: 20px;
}

/* 工具栏 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}

.tag {
  font-size: 12px;
  color: #909399;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-refresh {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(102, 126, 234, 0.2);
  border: 1px solid rgba(102, 126, 234, 0.5);
  border-radius: 6px;
  color: #667eea;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 12px;
}

.btn-refresh:hover:not(:disabled) {
  background: rgba(102, 126, 234, 0.3);
}

.btn-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon {
  font-size: 14px;
}

/* 设备列表 */
.device-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin-top: 20px;
}

.device-list {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  padding-right: 8px;
  padding-top: 16px;
}

.device-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s;
  height: fit-content;
  max-height: 200px;
}

.device-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(102, 126, 234, 0.3);
  transform: translateY(-2px);
}

.device-card.selected {
  background: rgba(102, 126, 234, 0.1);
  border-color: #667eea;
  box-shadow: 0 0 20px rgba(102, 126, 234, 0.2);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.device-name {
  font-size: 16px;
  font-weight: 600;
  color: #e0e0e0;
}

.status-badge-connected {
  font-size: 11px;
  padding: 2px 8px;
  background: rgba(103, 194, 58, 0.2);
  color: #67c23a;
  border-radius: 4px;
}

.device-specs {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.spec-item {
  font-size: 12px;
  color: #909399;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
}

.btn-connect {
  padding: 8px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-connect:hover {
  transform: scale(1.05);
  box-shadow: 0 0 15px rgba(102, 126, 234, 0.4);
}

.connected-tag {
  font-size: 12px;
  color: #67c23a;
}

/* 空状态 */
.empty-state {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
  color: #909399;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 12px;
  color: #606266;
  margin-bottom: 20px;
}

.btn-refresh-empty {
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-refresh-empty:hover {
  transform: scale(1.05);
  box-shadow: 0 0 15px rgba(102, 126, 234, 0.4);
}

/* 下一步按钮 */
.next-step-action {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.btn-next {
  padding: 12px 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-next:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 25px rgba(102, 126, 234, 0.5);
}

/* 聊天区域 */
.chat-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-back {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #e0e0e0;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 14px;
}

.btn-back:hover {
  background: rgba(255, 255, 255, 0.15);
}

.device-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #909399;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #909399;
}

.status-dot.online {
  background: #67c23a;
  box-shadow: 0 0 8px rgba(103, 194, 58, 0.5);
}

.header-right {
  display: flex;
  align-items: center;
}

.model-select {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 14px;
  outline: none;
  cursor: pointer;
}

.model-select:focus {
  border-color: #667eea;
}

/* 聊天消息区域 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.welcome-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.welcome-avatar {
  font-size: 64px;
  margin-bottom: 16px;
}

.welcome-bubble {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 24px;
  max-width: 400px;
}

.welcome-bubble h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: #e0e0e0;
}

.welcome-bubble p {
  margin: 0;
  font-size: 14px;
  color: #909399;
}

/* 消息项 */
.message-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.message-item.user {
  flex-direction: row-reverse;
}

.message-avatar {
  font-size: 32px;
  flex-shrink: 0;
}

.message-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 70%;
}

.message-item.user .message-content {
  align-items: flex-end;
}

.message-bubble {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  color: #e0e0e0;
}

.message-item.user .message-bubble {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.loading-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: #67c23a;
  border-radius: 50%;
  animation: pulse-dot 1.5s infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.loading-text {
  font-size: 12px;
  color: #909399;
}

.message-time {
  font-size: 11px;
  color: #606266;
  padding: 0 4px;
}

/* 输入区域 */
.chat-input-area {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.03);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.chat-input {
  flex: 1;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #e0e0e0;
  font-size: 14px;
  outline: none;
  transition: all 0.3s;
}

.chat-input:focus {
  border-color: #667eea;
  background: rgba(255, 255, 255, 0.08);
}

.chat-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-send {
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;
}

.btn-send:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 0 15px rgba(102, 126, 234, 0.4);
}

.btn-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: rgba(102, 126, 234, 0.5);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(102, 126, 234, 0.7);
}
</style>
