<template>
  <div class="automation-task-container">
    <div class="page-header">
      <h2>自动化任务</h2>
    </div>

    <div v-if="currentStep === 1" class="step-container">
      <div class="step-header">
        <div class="step-title">
          <span class="step-number">1</span>
          <span>选择采集卡设备</span>
        </div>
        <el-button
            v-if="deviceList.length > 0"
            type="primary"
            :icon="Refresh"
            circle
            @click="loadDevices"
        />
      </div>

      <div class="device-list">
        <div
            v-for="device in deviceList"
            :key="device.deviceId"
            :class="['device-item', { selected: selectedDevice?.deviceId === device.deviceId }]"
            @click="selectDevice(device)"
        >
          <div class="device-info">
            <div class="device-name">{{ device.deviceName }}</div>
            <div class="device-specs">
              {{ device.width }}x{{ device.height }} @ {{ device.framerate }}fps
            </div>
          </div>
          <el-button
              v-if="selectedDevice?.deviceId === device.deviceId && !isDeviceConnected"
              type="primary"
              size="small"
              @click.stop="connectDevice"
          >
            连接
          </el-button>
          <el-tag v-else-if="isDeviceConnected && selectedDevice?.deviceId === device.deviceId" type="success">
            已连接
          </el-tag>
        </div>

        <div v-if="deviceList.length === 0" class="empty-state">
          <el-empty description="未找到采集卡设备，请检查设备连接" />
          <el-button type="primary" @click="loadDevices">刷新设备列表</el-button>
        </div>
      </div>

      <div v-if="isDeviceConnected" class="next-step">
        <el-button type="primary" size="large" @click="goToNextStep">
          进入任务配置 →
        </el-button>
      </div>
    </div>

    <div v-if="currentStep === 2" class="step-container step2">
      <div class="chat-header">
        <div class="header-left">
          <el-button icon="ArrowLeft" circle @click="goBack" />
          <div class="device-info">
            <el-tag type="success" size="small">已连接</el-tag>
            <span>{{ selectedDevice?.deviceName }}</span>
          </div>
        </div>
        <div class="header-right">
          <el-select
              v-model="selectedModelId"
              placeholder="选择模型"
              size="default"
              filterable
              style="width: 200px;"
          >
            <el-option
                v-for="model in modelList"
                :key="model.id"
                :label="model.name"
                :value="model.id"
            />
          </el-select>
        </div>
      </div>

      <div class="chat-messages">
        <div v-if="messages.length === 0" class="welcome-message">
          <div class="message-avatar">🤖</div>
          <div class="message-content">
            <div class="message-bubble">
              你好！我是自动化助手，请选择模型后输入消息开始对话
            </div>
          </div>
        </div>

        <div v-for="(msg, index) in messages" :key="index"
             :class="['message-item', msg.role]">
          <div class="message-avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
          <div class="message-content">
            <div :class="['message-bubble', { 'is-loading': msg.loading }]">
              <div v-if="msg.role === 'assistant' && msg.loading" class="status-indicator">
                <span class="pulse-dot"></span>
                <span class="status-text-mini">正在处理指令...</span>
              </div>

              <div v-if="msg.content" class="status-text">{{ msg.content }}</div>

              <div v-if="msg.loading" class="loading-bar-container">
                <div class="loading-bar-progress"></div>
              </div>
            </div>
            <div class="message-time">{{ msg.time }}</div>
          </div>
        </div>
      </div>

      <div class="chat-input-area">
        <el-input
            v-model="inputMessage"
            placeholder="输入消息..."
            size="large"
            :disabled="isExecuting"
            @keyup.enter="sendMessage"
        />
        <el-button
            type="primary"
            size="large"
            :loading="isExecuting"
            :disabled="!inputMessage || !selectedModelId"
            @click="sendMessage"
        >
          发送
        </el-button>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref, onMounted, nextTick, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '@/utils/api';
import { VideoCamera, Check, Close, ArrowLeft, ArrowRight, Refresh, Monitor, Document, VideoPlay } from '@element-plus/icons-vue';

export default defineComponent({
  name: 'AutomationTaskView',
  components: { VideoCamera, Check, Close, ArrowLeft, ArrowRight, Refresh, Monitor, Document, VideoPlay },

  setup() {
    const currentStep = ref(1);
    const deviceList = ref([]);
    const modelList = ref([]);
    const selectedDevice = ref(null);
    const selectedModelId = ref(null);
    const inputMessage = ref('');
    const isDeviceConnected = ref(false);
    const isExecuting = ref(false);
    const messages = ref([]);

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

    const sendMessage = async () => {
      if (!inputMessage.value.trim() || !selectedModelId.value) return;

      const userContent = inputMessage.value;
      messages.value.push({ role: 'user', content: userContent, time: getCurrentTime() });
      inputMessage.value = '';
      isExecuting.value = true;

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
            if (!line.trim().startsWith('data:')) continue;
            try {
              const json = JSON.parse(line.replace('data:', ''));
              assistantMsg.content = json.message;
              if (json.progress >= 100) assistantMsg.loading = false;

              await nextTick();
              const container = document.querySelector('.chat-messages');
              if (container) container.scrollTop = container.scrollHeight;
            } catch (e) {}
          }
        }
      } catch (error) {
        assistantMsg.content = '错误：' + error.message;
        assistantMsg.loading = false;
      } finally {
        isExecuting.value = false;
      }
    };

    onMounted(loadDevices);

    return {
      Refresh, currentStep, deviceList, modelList, selectedDevice, selectedModelId,
      inputMessage, isDeviceConnected, isExecuting, messages,
      loadDevices, selectDevice, connectDevice, goToNextStep, goBack, sendMessage
    };
  }
});
</script>

<style scoped>
/* 保持原有样式不变 */
.automation-task-container {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: calc(100vh - 40px);
  border-radius: 16px;
}
.page-header h2 { margin: 0 0 24px 0; font-size: 28px; color: #fff; font-weight: 600; }
.step-container { background: #fff; border-radius: 16px; padding: 32px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15); }
.step-container.step2 { padding: 0; overflow: hidden; display: flex; flex-direction: column; height: calc(100vh - 80px); }
.chat-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid #f0f2f5; background: #fff; }
.header-left { display: flex; align-items: center; gap: 12px; }
.chat-messages { flex: 1; overflow-y: auto; padding: 24px; background: #f5f7fa; display: flex; flex-direction: column; gap: 20px;}
.message-item { display: flex; gap: 12px; }
.message-item.user { flex-direction: row-reverse; }
.message-avatar { font-size: 32px; flex-shrink: 0; }
.message-content { display: flex; flex-direction: column; gap: 4px; }
.message-bubble { padding: 12px 16px; background: #fff; border-radius: 12px; max-width: 600px; font-size: 14px; color: #333; line-height: 1.6; position: relative; box-shadow: 0 2px 8px rgba(0,0,0,0.05);}
.message-item.user .message-bubble { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; }
.message-time { font-size: 12px; color: #909399; padding: 0 8px; }
.chat-input-area { display: flex; gap: 12px; padding: 16px 24px; background: #fff; border-top: 1px solid #f0f2f5; }
.chat-input-area .el-input { flex: 1; }

/* 核心改动：新状态 UI 样式 */
.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px dashed #e4e7ed;
}
.status-text-mini { font-size: 12px; color: #909399; font-weight: 500; }
.pulse-dot {
  width: 8px; height: 8px;
  background-color: #67c23a;
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(103, 194, 58, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(103, 194, 58, 0); }
  100% { box-shadow: 0 0 0 0 rgba(103, 194, 58, 0); }
}
.loading-bar-container {
  margin-top: 10px;
  height: 2px;
  background: #f0f2f5;
  border-radius: 2px;
  overflow: hidden;
}
.loading-bar-progress {
  height: 100%; width: 30%;
  background: #667eea;
  animation: loading-slide 1.5s infinite ease-in-out;
}
@keyframes loading-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}

/* 原始辅助样式 */
.device-list { display: flex; flex-direction: column; gap: 16px; }
.device-item { display: flex; justify-content: space-between; align-items: center; padding: 20px; border: 2px solid #e4e7ed; border-radius: 12px; cursor: pointer; background: #fff; transition: all 0.3s; }
.device-item.selected { border-color: #667eea; background: rgba(102, 126, 234, 0.05); }
.step-number { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: #667eea; color: #fff; border-radius: 50%; font-weight: bold; }
</style>