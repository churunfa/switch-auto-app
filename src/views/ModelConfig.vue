<template>
  <div class="dashboard">
    <header class="glass-header">
      <div class="brand">
        <span class="logo-icon">🤖</span>
        <div class="brand-text">
          <h2>AI MODEL CONFIG</h2>
          <span class="badge">MODEL MANAGEMENT</span>
        </div>
      </div>

      <div :class="['conn-status', isConnected ? 'status-online' : 'status-offline']">
        <div class="indicator"></div>
        {{ isConnected ? '后端服务已连接' : '等待后端连接...' }}
      </div>
    </header>

    <div class="main-layout">
      <section class="model-config">
        <div class="toolbar">
          <span class="tag">AI 模型配置管理</span>
          <button class="btn-add" @click="openAddDialog">
            <span class="icon">+</span> 添加模型
          </button>
        </div>

        <div class="model-table">
          <table>
            <thead>
              <tr>
                <th>模型 ID</th>
                <th>模型名称</th>
                <th>模型类型</th>
                <th>Base URL</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="model in modelList" :key="model.id">
                <td>{{ model.modelId }}</td>
                <td>{{ model.modelName }}</td>
                <td>{{ model.modelType || '-' }}</td>
                <td class="url-cell">{{ model.baseUrl }}</td>
                <td>
                  <span :class="['status-badge', model.status === 1 ? 'status-active' : 'status-inactive']">
                    {{ model.status === 1 ? '已激活' : '未激活' }}
                  </span>
                </td>
                <td>{{ formatTimestamp(model.createTime) }}</td>
                <td class="actions">
                  <button class="btn-action btn-edit" @click="openEditDialog(model)">
                    编辑
                  </button>
                  <button class="btn-action btn-delete" @click="deleteModel(model)">
                    删除
                  </button>
                </td>
              </tr>
              <tr v-if="modelList.length === 0">
                <td colspan="7" class="empty-message">暂无模型配置，请点击上方"添加模型"按钮</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- 添加/编辑模型对话框 -->
    <div v-if="showDialog" class="dialog-overlay" @click="closeDialog">
      <div class="dialog" @click.stop>
        <div class="dialog-header">
          <h3>{{ isEditMode ? '编辑模型配置' : '添加模型配置' }}</h3>
          <button class="btn-close" @click="closeDialog">×</button>
        </div>

        <div class="dialog-body">
          <div class="form-group">
            <label>模型 ID <span class="required">*</span></label>
            <input
              v-model="formData.modelId"
              type="text"
              placeholder="例如：gpt-3.5-turbo"
              :class="{ error: errors.modelId }"
            />
            <span v-if="errors.modelId" class="error-msg">{{ errors.modelId }}</span>
          </div>

          <div class="form-group">
            <label>模型名称 <span class="required">*</span></label>
            <input
              v-model="formData.modelName"
              type="text"
              placeholder="例如：GPT-3.5 Turbo"
              :class="{ error: errors.modelName }"
            />
            <span v-if="errors.modelName" class="error-msg">{{ errors.modelName }}</span>
          </div>

          <div class="form-group">
            <label>API Key <span class="required">*</span></label>
            <input
              v-model="formData.apiKey"
              type="password"
              placeholder="sk-..."
              :class="{ error: errors.apiKey }"
            />
            <span v-if="errors.apiKey" class="error-msg">{{ errors.apiKey }}</span>
          </div>

          <div class="form-group">
            <label>Base URL <span class="required">*</span></label>
            <input
              v-model="formData.baseUrl"
              type="text"
              placeholder="例如：https://api.openai.com"
              :class="{ error: errors.baseUrl }"
            />
            <span v-if="errors.baseUrl" class="error-msg">{{ errors.baseUrl }}</span>
          </div>

          <div class="form-group">
            <label>模型类型</label>
            <input
              v-model="formData.modelType"
              type="text"
              placeholder="例如：OpenAI、Azure、LocalAI"
            />
          </div>
        </div>

        <div class="dialog-footer">
          <button class="btn-cancel" @click="closeDialog">取消</button>
          <button class="btn-submit" @click="submitForm" :disabled="submitting">
            {{ submitting ? '提交中...' : (isEditMode ? '保存修改' : '添加模型') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { getApiEndpoint } from '../utils/api';

const ADD_MODEL = getApiEndpoint('ADD_MODEL');
const LIST_MODELS = getApiEndpoint('LIST_MODELS');
const DELETE_MODEL = getApiEndpoint('DELETE_MODEL');
const UPDATE_MODEL = getApiEndpoint('UPDATE_MODEL');

const isConnected = ref(false);
const modelList = ref([]);
const showDialog = ref(false);
const isEditMode = ref(false);
const submitting = ref(false);

const formData = ref({
  id: null,
  modelId: '',
  modelName: '',
  apiKey: '',
  baseUrl: '',
  modelType: ''
});

const errors = ref({});

// 获取模型列表
const fetchModels = async () => {
  try {
    const res = await axios.get(LIST_MODELS);
    if (res.data.success) {
      modelList.value = res.data.data;
      isConnected.value = true;
    } else {
      isConnected.value = false;
    }
  } catch (err) {
    isConnected.value = false;
    console.error('Failed to fetch models:', err);
  }
};

// 打开添加对话框
const openAddDialog = () => {
  isEditMode.value = false;
  formData.value = {
    id: null,
    modelId: '',
    modelName: '',
    apiKey: '',
    baseUrl: '',
    modelType: ''
  };
  errors.value = {};
  showDialog.value = true;
};

// 打开编辑对话框
const openEditDialog = (model) => {
  isEditMode.value = true;
  formData.value = {
    id: model.id,
    modelId: model.modelId,
    modelName: model.modelName,
    apiKey: model.apiKey,
    baseUrl: model.baseUrl,
    modelType: model.modelType || ''
  };
  errors.value = {};
  showDialog.value = true;
};

// 关闭对话框
const closeDialog = () => {
  showDialog.value = false;
};

// 验证表单
const validateForm = () => {
  errors.value = {};
  
  if (!formData.value.modelId || !formData.value.modelId.trim()) {
    errors.value.modelId = '模型 ID 不能为空';
  }
  if (!formData.value.modelName || !formData.value.modelName.trim()) {
    errors.value.modelName = '模型名称不能为空';
  }
  if (!formData.value.apiKey || !formData.value.apiKey.trim()) {
    errors.value.apiKey = 'API Key 不能为空';
  }
  if (!formData.value.baseUrl || !formData.value.baseUrl.trim()) {
    errors.value.baseUrl = 'Base URL 不能为空';
  }
  
  return Object.keys(errors.value).length === 0;
};

// 提交表单
const submitForm = async () => {
  if (!validateForm()) return;
  
  submitting.value = true;
  try {
    const payload = {
      modelId: formData.value.modelId.trim(),
      modelName: formData.value.modelName.trim(),
      apiKey: formData.value.apiKey.trim(),
      baseUrl: formData.value.baseUrl.trim(),
      modelType: formData.value.modelType ? formData.value.modelType.trim() : ''
    };

    let res;
    if (isEditMode.value && formData.value.id) {
      // 更新模式
      res = await axios.put(UPDATE_MODEL, { ...payload, id: formData.value.id });
    } else {
      // 添加模式
      res = await axios.post(ADD_MODEL, payload);
    }
    
    if (res.data.success) {
      ElMessage.success(isEditMode.value ? '模型配置更新成功' : '模型配置添加成功');
      closeDialog();
      fetchModels();
    } else {
      ElMessage.error('操作失败：' + res.data.message);
    }
  } catch (err) {
    ElMessage.error('网络请求异常：' + (err.response?.data?.message || err.message));
  } finally {
    submitting.value = false;
  }
};

// 删除模型
const deleteModel = async (model) => {
  if (!confirm(`确定要删除模型 "${model.modelName}" 吗？`)) return;
  
  try {
    const res = await axios.delete(`${DELETE_MODEL}/${model.id}`);
    if (res.data.success) {
      ElMessage.success('删除成功');
      fetchModels();
    } else {
      ElMessage.error('删除失败：' + res.data.message);
    }
  } catch (err) {
    ElMessage.error('删除失败：' + (err.response?.data?.message || err.message));
  }
};

// 格式化时间戳
const formatTimestamp = (timestamp) => {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN');
};

onMounted(() => {
  fetchModels();
});
</script>

<style scoped>
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
  height: 60px;
  box-sizing: border-box;
}

.brand { display: flex; align-items: center; gap: 12px; }
.logo-icon { font-size: 1.8rem; filter: drop-shadow(0 0 8px #4f64ff); }
.brand-text h2 { margin: 0; font-size: 1.1rem; letter-spacing: 2px; color: #4f64ff; font-weight: 800; }
.badge { font-size: 0.6rem; background: #4f64ff; color: white; padding: 1px 6px; border-radius: 4px; }
.conn-status { display: flex; align-items: center; gap: 10px; font-size: 0.75rem; padding: 6px 16px; border-radius: 20px; font-weight: bold; transition: 0.3s; }
.status-online { color: #00ff88; border: 1px solid rgba(0, 255, 136, 0.3); background: rgba(0, 255, 136, 0.05); }
.status-offline { color: #ff4444; border: 1px solid rgba(255, 68, 68, 0.3); background: rgba(255, 68, 68, 0.05); }
.indicator { width: 8px; height: 8px; border-radius: 50%; background: currentColor; box-shadow: 0 0 8px currentColor; }

.main-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.model-config {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow-y: auto;
  padding: 25px;
  box-sizing: border-box;
  padding-bottom: 40px;
}

.toolbar {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-left: 3px solid #4f64ff;
  padding-left: 12px;
}

.tag {
  font-weight: bold;
  color: #4f64ff;
  font-size: 0.85rem;
  letter-spacing: 1px;
}

.btn-add {
  background: #4f64ff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: 0.2s;
}

.btn-add:hover {
  filter: brightness(1.2);
}

.icon {
  font-size: 1.2rem;
  font-weight: bold;
}

.model-table {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: rgba(79, 100, 255, 0.1);
}

th {
  padding: 16px;
  text-align: left;
  font-size: 0.75rem;
  font-weight: bold;
  color: #4f64ff;
  letter-spacing: 1px;
  text-transform: uppercase;
}

td {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  font-size: 0.85rem;
}

tbody tr:hover {
  background: rgba(255, 255, 255, 0.02);
}

.url-cell {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #888;
  font-family: 'Consolas', monospace;
  font-size: 0.75rem;
}

.status-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: bold;
}

.status-active {
  background: rgba(0, 255, 136, 0.1);
  color: #00ff88;
  border: 1px solid rgba(0, 255, 136, 0.3);
}

.status-inactive {
  background: rgba(255, 68, 68, 0.1);
  color: #ff4444;
  border: 1px solid rgba(255, 68, 68, 0.3);
}

.empty-message {
  text-align: center;
  padding: 40px;
  color: #555;
  font-style: italic;
}

.actions {
  display: flex;
  gap: 8px;
}

.btn-action {
  padding: 5px 12px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: bold;
  cursor: pointer;
  transition: 0.2s;
  border: none;
}

.btn-edit {
  background: rgba(79, 100, 255, 0.2);
  color: #4f64ff;
  border: 1px solid rgba(79, 100, 255, 0.3);
}

.btn-edit:hover {
  background: rgba(79, 100, 255, 0.3);
}

.btn-delete {
  background: rgba(255, 68, 68, 0.2);
  color: #ff4444;
  border: 1px solid rgba(255, 68, 68, 0.3);
}

.btn-delete:hover {
  background: rgba(255, 68, 68, 0.3);
}

/* 对话框样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: #1a1b26;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.dialog-header {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #fff;
  font-weight: bold;
}

.btn-close {
  background: transparent;
  border: none;
  color: #888;
  font-size: 1.5rem;
  cursor: pointer;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: 0.2s;
}

.btn-close:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.dialog-body {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.8rem;
  color: #aaa;
  font-weight: bold;
}

.required {
  color: #ff4444;
  margin-left: 2px;
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #fff;
  font-size: 0.85rem;
  font-family: 'Consolas', monospace;
  transition: 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #4f64ff;
  background: rgba(0, 0, 0, 0.5);
}

.form-group input.error {
  border-color: #ff4444;
}

.error-msg {
  display: block;
  margin-top: 4px;
  font-size: 0.7rem;
  color: #ff4444;
}

.dialog-footer {
  padding: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-cancel {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #aaa;
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: bold;
  transition: 0.2s;
}

.btn-cancel:hover {
  border-color: #fff;
  color: #fff;
}

.btn-submit {
  background: #4f64ff;
  border: none;
  color: white;
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: bold;
  transition: 0.2s;
}

.btn-submit:hover:not(:disabled) {
  filter: brightness(1.2);
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 滚动条 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: #4f64ff;
}
</style>
