<template>
  <div class="dashboard">
    <header class="glass-header">
      <div class="brand">
        <span class="logo-icon">🎮</span>
        <div class="brand-text">
          <h2>BUTTON BINDING MANAGER</h2>
          <span class="badge">PHASE 2: CONTROLLER CONFIG</span>
        </div>
      </div>

      <div :class="['conn-status', isConnected ? 'status-online' : 'status-offline']">
        <div class="indicator"></div>
        {{ isConnected ? `🎮 ${connectedGamepad?.name || '控制器'} 已连接` : '🎮 等待控制器连接...' }}
      </div>
    </header>

    <div class="main-layout">
      <!-- 左侧：按钮绑定列表 -->
      <section class="binding-list">
        <div class="toolbar">
          <span class="tag">按键绑定配置</span>
          <span class="count">{{ buttonBindings.length }} BUTTONS DETECTED</span>
        </div>

        <div class="bindings-container">
          <div 
            v-for="binding in buttonBindings" 
            :key="binding.id" 
            class="binding-card"
            :class="{ 'active': selectedBinding?.id === binding.id }"
            @click="selectBinding(binding)"
          >
            <div class="card-header">
              <span class="button-id">ID: {{ binding.id }}</span>
              <span class="button-name">{{ binding.sdlBtnName }}</span>
              <div class="function-key-indicator" v-if="binding.functionKey">
                ⚡ 功能键
              </div>
            </div>

            <div class="card-content">
              <div class="binding-info">
                <div class="info-item mapping-display" @click="openMappingModal(binding)">
                  <label>映射按键:</label>
                  <div class="mapping-value">
                    <span class="edit-icon">✏️</span>
                    <span class="mapped-button">{{ binding.buttonName }}</span>
                  </div>
                </div>
              </div>

              <div class="graph-info" v-if="binding.graphId && binding.graphId !== -1">
                <div class="linked-graph">
                  <span class="graph-label">关联操作:</span>
                  <span class="graph-name">{{ getGraphCombinationName(binding.graphId) }}</span>
                </div>
              </div>
              <div class="no-graph" v-else>
                <span class="empty-state">{{ binding.graphId === -1 ? '未绑定拓扑配置' : '未绑定拓扑配置' }}</span>
              </div>
            </div>

            <div class="card-actions">
              <button 
                class="btn-op toggle-func"
                @click.stop="toggleFunctionKey(binding)"
                :class="{ 'active': binding.functionKey }"
              >
                {{ binding.functionKey ? '关闭功能键' : '设为功能键' }}
              </button>
              
              <button 
                class="btn-op unbind" 
                @click.stop="unbindGraph(binding)"
                :disabled="!binding.graphId"
              >
                解除关联操作
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 中间：游戏手柄信息 -->
      <section class="gamepad-info">
        <div class="toolbar">
          <span class="tag">连接的游戏手柄</span>
        </div>

        <div class="gamepad-card" v-if="connectedGamepad && isConnected">
          <div class="gamepad-header">
            <span class="gamepad-icon">🕹️</span>
            <div class="gamepad-details">
              <h3>{{ connectedGamepad.name }}</h3>
              <p v-if="connectedGamepad.vendorId && connectedGamepad.productId">
                ID: {{ connectedGamepad.vendorId }}:{{ connectedGamepad.productId }}
              </p>
            </div>
          </div>
          
          <div class="gamepad-specs">
            <div class="spec-item" v-if="connectedGamepad.buttonCount !== undefined">
              <label>按键数量:</label>
              <span>{{ connectedGamepad.buttonCount }}</span>
            </div>
            <div class="spec-item" v-if="connectedGamepad.axisCount !== undefined">
              <label>轴数:</label>
              <span>{{ connectedGamepad.axisCount }}</span>
            </div>
            <div class="spec-item">
              <label>连接状态:</label>
              <span class="status-connected">🟢 已连接</span>
            </div>
            <div class="spec-item" v-if="connectedGamepad.vendorId">
              <label>厂商ID:</label>
              <span class="vendor-id">{{ connectedGamepad.vendorId }}</span>
            </div>
            <div class="spec-item" v-if="connectedGamepad.productId">
              <label>产品ID:</label>
              <span class="product-id">{{ connectedGamepad.productId }}</span>
            </div>
          </div>

          <button class="btn-refresh" @click="refreshGamepadInfo">
            刷新手柄信息
          </button>
        </div>

        <div class="no-gamepad" v-else>
          <div class="empty-state-large">
            <span class="icon">{{ isConnected ? '⚠️' : '🎮' }}</span>
            <p>{{ isConnected ? '手柄连接异常' : '未检测到游戏手柄' }}</p>
            <p class="sub-text" v-if="!isConnected">请连接USB或蓝牙游戏手柄</p>
            <button class="btn-primary" @click="scanGamepads">
              {{ isConnected ? '重新检测' : '扫描手柄设备' }}
            </button>
          </div>
        </div>
      </section>

      <!-- 右侧：组合图绑定 -->
      <aside class="graph-sidebar">
        <div class="sidebar-header">
          <span>组合图绑定</span>
          <button @click="refreshGraphList" class="clear-btn">刷新</button>
        </div>
        
        <div class="sidebar-content" v-if="selectedBinding">
          <div class="current-selection">
            <h4>当前选中: {{ selectedBinding.sdlBtnName }}</h4>
            <p class="selection-desc">选择要绑定的组合图</p>
          </div>

          <!-- 搜索框 -->
          <div class="search-container">
            <input 
              v-model="searchKeyword" 
              @input="handleSearchInput"
              type="text" 
              placeholder="搜索组合图名称、项目名或ID..." 
              class="search-input"
            />
            <div class="search-info" v-if="searchKeyword">
              找到 {{ filteredGraphs.length }} 个匹配项
            </div>
          </div>

          <div class="graphs-list">
            <div 
              v-for="graph in filteredGraphs" 
              :key="graph.id"
              class="graph-item"
              :class="{ 'bound': isGraphBound(graph.id) }"
              @click="bindGraphToButton(graph)"
            >
              <div class="graph-header">
                <span class="graph-id">#{{ graph.id }}</span>
                <span class="graph-name">{{ graph.combinationName }}</span>
                <span class="project-tag">{{ graph.projectName }}</span>
              </div>
              <div class="graph-info">
                <div class="info-row">
                  <span class="info-label">最小时间:</span>
                  <span class="info-value">{{ graph.minTime }}ms</span>
                </div>
              </div>
              <div class="graph-status">
                <span v-if="isGraphBound(graph.id)" class="status-bound">已绑定</span>
                <span v-else class="status-available">可绑定</span>
              </div>
            </div>
            
            <div v-if="availableGraphs.length === 0" class="no-graphs">
              <p>暂无可用的组合图</p>
              <small>请先创建组合图</small>
            </div>
          </div>
        </div>
        
        <div class="no-selection" v-else>
          <p>请选择一个按钮进行绑定操作</p>
        </div>
      </aside>
    </div>

    <!-- 按键映射选择模态框 -->
    <div v-if="showMappingModal" class="modal-overlay" @click="closeMappingModal">
      <div class="mapping-modal" @click.stop>
        <div class="modal-header">
          <h3>选择映射按键</h3>
          <button class="modal-close" @click="closeMappingModal">×</button>
        </div>
        <div class="modal-content">
          <div class="current-mapping">
            <div class="mapping-info">
              <div class="physical-key">
                <span>物理按键: </span>
                <strong>{{ currentBindingForMapping?.sdlBtnName || '未知' }}</strong>
              </div>
              <div class="current-target">
                <span>当前映射: </span>
                <strong>{{ currentBindingForMapping?.buttonName }}</strong>
              </div>
            </div>
          </div>
          <div class="button-grid">
            <div 
              v-for="type in switchButtonTypes" 
              :key="type.value"
              class="button-option"
              :class="{ 'selected': currentBindingForMapping?.buttonType === type.value }"
              @click="selectMappingButton(type.value)"
            >
              <div class="button-label">{{ type.label }}</div>
              <div class="button-name">{{ type.name }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import axios from 'axios';
import { getApiEndpoint } from '../utils/api';

const API_BASE = getApiEndpoint('BUTTON_BINDING');

// 数据状态
const buttonBindings = ref([]);
const connectedGamepad = ref(null);
const availableGraphs = ref([]);
const filteredGraphs = ref([]);
const searchKeyword = ref('');
const selectedBinding = ref(null);
const isConnected = ref(false);
const showMappingModal = ref(false);
const currentBindingForMapping = ref(null);
const gamepadRefreshInterval = ref(null);

// SwitchButtonType枚举映射
const switchButtonTypes = [
  { value: 0, label: 'Y', name: 'SWITCH_BUTTON_TYPE_Y' },
  { value: 1, label: 'X', name: 'SWITCH_BUTTON_TYPE_X' },
  { value: 2, label: 'B', name: 'SWITCH_BUTTON_TYPE_B' },
  { value: 3, label: 'A', name: 'SWITCH_BUTTON_TYPE_A' },
  { value: 4, label: 'SR', name: 'SWITCH_BUTTON_TYPE_SR' },
  { value: 5, label: 'SL', name: 'SWITCH_BUTTON_TYPE_SL' },
  { value: 6, label: 'R', name: 'SWITCH_BUTTON_TYPE_R' },
  { value: 7, label: 'ZR', name: 'SWITCH_BUTTON_TYPE_ZR' },
  { value: 8, label: '-', name: 'SWITCH_BUTTON_TYPE_MINUS' },
  { value: 9, label: '+', name: 'SWITCH_BUTTON_TYPE_PLUS' },
  { value: 10, label: '按下R', name: 'SWITCH_BUTTON_TYPE_THUMB_R' },
  { value: 11, label: '按下L', name: 'SWITCH_BUTTON_TYPE_THUMB_L' },
  { value: 12, label: 'HOME', name: 'SWITCH_BUTTON_TYPE_HOME' },
  { value: 13, label: '', name: 'SWITCH_BUTTON_TYPE_CAPTURE' },
  { value: 14, label: '震动', name: 'SWITCH_BUTTON_TYPE_DUMMY' },
  { value: 15, label: '充电握把', name: 'SWITCH_BUTTON_TYPE_CHARGING_GRIP' },
  { value: 16, label: '⬇️', name: 'SWITCH_BUTTON_TYPE_DPAD_DOWN' },
  { value: 17, label: '⬆️', name: 'SWITCH_BUTTON_TYPE_DPAD_UP' },
  { value: 18, label: '➡️', name: 'SWITCH_BUTTON_TYPE_DPAD_RIGHT' },
  { value: 19, label: '⬅️', name: 'SWITCH_BUTTON_TYPE_DPAD_LEFT' },
  { value: 20, label: '左SL', name: 'SWITCH_BUTTON_TYPE_LEFT_SL' },
  { value: 21, label: '左SR', name: 'SWITCH_BUTTON_TYPE_LEFT_SR' },
  { value: 22, label: 'L', name: 'SWITCH_BUTTON_TYPE_L' },
  { value: 23, label: 'ZL', name: 'SWITCH_BUTTON_TYPE_ZL' },
  { value: 24, label: 'Unknown', name: 'SWITCH_BUTTON_TYPE_NONE' }
];

// 根据buttonType获取对应的按键名称
const getButtonNameByType = (buttonType) => {
  switch (buttonType) {
    case 0: return 'Y';
    case 1: return 'X';
    case 2: return 'B';
    case 3: return 'A';
    case 4: return 'SR';
    case 5: return 'SL';
    case 6: return 'R';
    case 7: return 'ZR';
    case 8: return '-';
    case 9: return '+';
    case 10: return '按下R';
    case 11: return '按下L';
    case 12: return 'HOME';
    case 13: return '';
    case 16: return '⬇️';
    case 17: return '⬆️';
    case 18: return '➡️';
    case 19: return '⬅️';
    case 22: return 'L';
    case 23: return 'ZL';
    default: return 'Unknown';
  }
};

// 获取所有按钮绑定
const fetchButtonBindings = async () => {
  try {
    const res = await axios.get(`${API_BASE}/all-bindings`);
    if (res.data.success) {
      buttonBindings.value = res.data.data;
      isConnected.value = true;
    }
  } catch (err) {
    isConnected.value = false;
  }
};

// 获取连接的手柄信息
const fetchConnectedGamepad = async () => {
  try {
    const res = await axios.get(`${API_BASE}/connected-gamepad`);
    if (res.data.success) {
      connectedGamepad.value = res.data.data;
      // 根据API返回的connected字段判断连接状态
      isConnected.value = res.data.data.connected === true;
    } else {
      connectedGamepad.value = null;
      isConnected.value = false;
    }
  } catch (err) {
    connectedGamepad.value = null;
    isConnected.value = false;
  }
};

// 获取所有手柄信息（用于扫描）
const scanGamepads = async () => {
  try {
    const res = await axios.get(`${API_BASE}/all-gamepads`);
    if (res.data.success) {
      // 这里可以显示手柄列表供用户选择
    }
  } catch (err) {
  }
};

// 刷新手柄信息
const refreshGamepadInfo = async () => {
  await fetchConnectedGamepad();
};

// 启动自动刷新连接状态
const startAutoRefresh = () => {
  // 每5秒自动刷新一次连接状态
  gamepadRefreshInterval.value = setInterval(() => {
    fetchConnectedGamepad();
  }, 5000);
};

// 停止自动刷新
const stopAutoRefresh = () => {
  if (gamepadRefreshInterval.value) {
    clearInterval(gamepadRefreshInterval.value);
    gamepadRefreshInterval.value = null;
  }
};

// 选择按钮绑定
const selectBinding = (binding) => {
  selectedBinding.value = binding;
  loadAvailableGraphs();
};

// 切换功能键状态
const toggleFunctionKey = async (binding) => {
  try {
    await axios.post(`${API_BASE}/set-function-key`, null, {
      params: {
        id: binding.id,
        functionKey: !binding.functionKey
      }
    });
    
    binding.functionKey = !binding.functionKey;
    // 自动刷新按钮绑定数据
    await fetchButtonBindings();
  } catch (err) {
  }
};

// 解绑组合图
const unbindGraph = async (binding) => {
  if (!binding.graphId) return;
  
  try {
    await axios.post(`${API_BASE}/unbind-graph`, null, {
      params: { id: binding.id }
    });
    
    binding.graphId = null;
    // 自动刷新按钮绑定数据
    await fetchButtonBindings();
  } catch (err) {
  }
};

// 加载可用的组合图
const loadAvailableGraphs = async () => {
  console.log('开始加载组合图数据...');
  try {
    const combinationApiUrl = getApiEndpoint('COMBINATION_GRAPH');
    console.log('组合图API地址:', combinationApiUrl);
    const response = await axios.get(combinationApiUrl + '/all-combination');
    console.log('API响应:', response.data);
    
    if (response.data.success) {
      // 只展示指定的四个字段：id、projectName、combinationName、minTime
      availableGraphs.value = response.data.data.map(combination => ({
        id: combination.id,
        projectName: combination.projectName || '',
        combinationName: combination.combinationName || '',
        minTime: combination.minTime || 0
      }));
      // 应用当前搜索过滤
      filterGraphs();
    } else {
      // 失败时使用模拟数据
      availableGraphs.value = [
        { id: 1, projectName: '默认项目', combinationName: '基础移动组合', minTime: 100 },
        { id: 2, projectName: '战斗系统', combinationName: '战斗技能链', minTime: 200 },
        { id: 3, projectName: '环境交互', combinationName: '环境交互序列', minTime: 150 }
      ];
    }
  } catch (error) {
    console.error('加载组合图数据失败:', error);
    // 异常时使用模拟数据
    console.log('使用模拟数据');
    availableGraphs.value = [
      { id: 1, projectName: '默认项目', combinationName: '基础移动组合', minTime: 100 },
      { id: 2, projectName: '战斗系统', combinationName: '战斗技能链', minTime: 200 },
      { id: 3, projectName: '环境交互', combinationName: '环境交互序列', minTime: 150 }
    ];
  }
};

// 绑定组合图到按钮
const bindGraphToButton = async (graph) => {
  if (!selectedBinding.value) return;
  
  try {
    await axios.post(`${API_BASE}/bind-graph`, null, {
      params: {
        id: selectedBinding.value.id,
        graphId: graph.id
      }
    });
    
    selectedBinding.value.graphId = graph.id;
    // 自动刷新按钮绑定数据
    await fetchButtonBindings();
  } catch (err) {
  }
};

// 检查图是否已绑定
const isGraphBound = (graphId) => {
  return selectedBinding.value?.graphId === graphId;
};

// 刷新组合图列表
const refreshGraphList = async () => {
  console.log('正在刷新组合图列表...');
  await loadAvailableGraphs();
};

// 搜索过滤组合图
const filterGraphs = () => {
  if (!searchKeyword.value.trim()) {
    filteredGraphs.value = [...availableGraphs.value];
    return;
  }
  
  const keyword = searchKeyword.value.toLowerCase().trim();
  filteredGraphs.value = availableGraphs.value.filter(graph => 
    graph.combinationName.toLowerCase().includes(keyword) ||
    graph.projectName.toLowerCase().includes(keyword) ||
    graph.id.toString().includes(keyword)
  );
};

// 监听搜索关键词变化
const handleSearchInput = () => {
  filterGraphs();
};

// 获取组合图的组合名称
const getGraphCombinationName = (graphId) => {
  // 如果graphId为-1，返回特殊标识
  if (graphId === -1) {
    return '未绑定拓扑配置';
  }
  const graph = availableGraphs.value.find(g => g.id === graphId);
  return graph ? graph.combinationName : `#${graphId}`;
};

// 获取映射按钮的显示标签
const getMappedButtonLabel = (buttonType) => {
  // buttonType 是 SwitchButtonType 枚举的数值
  const type = switchButtonTypes.find(t => t.value === buttonType);
  return type ? type.label : '未设置';
};

// 打开映射选择模态框
const openMappingModal = (binding) => {
  currentBindingForMapping.value = binding;
  showMappingModal.value = true;
};

// 关闭映射选择模态框
const closeMappingModal = () => {
  showMappingModal.value = false;
  currentBindingForMapping.value = null;
};

// 选择新的映射按钮
const selectMappingButton = async (buttonType) => {
  if (!currentBindingForMapping.value) return;
  
  try {
    await updateButtonBinding(currentBindingForMapping.value, buttonType);
    closeMappingModal();
    // 重新加载按钮绑定数据以反映最新状态
    await fetchButtonBindings();
  } catch (err) {
    console.error('更新映射失败:', err);
  }
};

// 更新按钮绑定
const updateButtonBinding = async (binding, newButtonType) => {
  try {
    const updateData = {
      id: binding.id,
      sdlBtn: binding.sdlBtn, // 保持原有SDL按钮值
      buttonType: newButtonType // 从枚举中选择的新按钮类型
    };
    
    await axios.post(`${API_BASE}/update`, updateData);
    // 更新本地数据
    binding.buttonType = newButtonType;
    // 根据buttonType更新buttonName
    binding.buttonName = getButtonNameByType(newButtonType);
    console.log(`${binding.sdlBtnName} 按钮映射已更新为 ${getButtonNameByType(newButtonType)}`);
    
    // 自动刷新按钮绑定数据以确保同步
    await fetchButtonBindings();
  } catch (err) {
    console.error('更新按键绑定失败:', err);
  }
};



// 初始化加载
onMounted(async () => {
  // 先加载组合图数据
  await loadAvailableGraphs();
  // 再获取按钮绑定信息
  await fetchButtonBindings();
  // 最后获取手柄连接状态
  await fetchConnectedGamepad();
  // 启动自动刷新连接状态
  startAutoRefresh();
});

// 组件卸载时清理定时器
onUnmounted(() => {
  stopAutoRefresh();
});
</script>

<style scoped>
/* 继承BaseOperate.vue的整体样式结构 */
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
.logo-icon { font-size: 1.8rem; filter: drop-shadow(0 0 8px #ff6b6b); }
.brand-text h2 { margin: 0; font-size: 1.1rem; letter-spacing: 2px; color: #ff6b6b; font-weight: 800; }
.badge { font-size: 0.6rem; background: #ff6b6b; color: white; padding: 1px 6px; border-radius: 4px; }

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

/* 左侧按钮绑定列表 */
.binding-list {
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
  border-left: 3px solid #ff6b6b; 
  padding-left: 12px; 
}

.tag { font-weight: bold; color: #ff6b6b; font-size: 0.85rem; letter-spacing: 1px; }
.count { color: #555; font-size: 0.75rem; }

.bindings-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 18px;
}

.binding-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.25s ease;
  cursor: pointer;
}

.binding-card:hover {
  transform: translateY(-4px);
  background: rgba(255, 255, 255, 0.05);
  border-color: #ff6b6b;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}

.binding-card.active {
  border-color: #ff6b6b;
  background: rgba(255, 107, 107, 0.1);
  box-shadow: 0 0 20px rgba(255, 107, 107, 0.3);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.button-id {
  font-size: 0.65rem;
  color: #ff6b6b;
  font-family: monospace;
  opacity: 0.8;
}

.button-name {
  font-size: 1.2rem;
  font-weight: 900;
  color: #fff;
  flex: 1;
}

.function-key-indicator {
  font-size: 0.6rem;
  background: #ffd93d;
  color: #000;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
}

.card-content {
  margin-bottom: 12px;
}

.binding-info {
  display: flex;
  gap: 15px;
  margin-bottom: 8px;
}

.info-item {
  display: flex;
  flex-direction: column;
  font-size: 0.7rem;
}

.info-item label {
  color: #888;
  margin-bottom: 2px;
}

.info-item code {
  color: #00ff88;
  font-family: 'Consolas', monospace;
  background: rgba(0,0,0,0.3);
  padding: 2px 6px;
  border-radius: 3px;
}

.graph-info {
  margin-top: 8px;
}

.linked-graph {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.7rem;
}

.graph-label {
  color: #888;
}

.graph-name {
  color: #4f64ff;
  font-weight: bold;
}

.no-graph .empty-state {
  color: #555;
  font-size: 0.7rem;
  font-style: italic;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.button-mapping-selector {
  margin-top: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.button-mapping-selector > label {
  display: block;
  font-size: 0.75rem;
  color: #aaa;
  margin-bottom: 8px;
  font-weight: 500;
}

.radio-group {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 6px;
  max-height: 120px;
  overflow-y: auto;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.7rem;
}

.radio-option:hover {
  background: rgba(255, 255, 255, 0.08);
}

.radio-option:hover .radio-label {
  color: #fff;
}

.radio-input {
  width: 14px;
  height: 14px;
  accent-color: #ff6b6b;
  cursor: pointer;
}

.radio-label {
  color: #ccc;
  font-size: 0.7rem;
  white-space: nowrap;
  transition: color 0.2s;
}

.radio-input:checked + .radio-label {
  color: #ff6b6b;
  font-weight: 500;
}

/* 滚动条样式 */
.radio-group::-webkit-scrollbar {
  width: 4px;
}

.radio-group::-webkit-scrollbar-track {
  background: transparent;
}

.radio-group::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.radio-group::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 107, 107, 0.5);
}

.btn-op {
  flex: 1;
  border: none;
  padding: 6px;
  border-radius: 6px;
  font-weight: 800;
  cursor: pointer;
  font-size: 0.65rem;
  transition: 0.2s;
}

.toggle-func {
  background: rgba(255, 217, 61, 0.2);
  color: #ffd93d;
  border: 1px solid rgba(255, 217, 61, 0.3);
}

.toggle-func.active {
  background: #ffd93d;
  color: #000;
}

.unbind {
  background: rgba(255, 107, 107, 0.2);
  color: #ff6b6b;
  border: 1px solid rgba(255, 107, 107, 0.3);
}

.btn-op:hover:not(:disabled) {
  filter: brightness(1.2);
  transform: translateY(-1px);
}

.btn-op:active:not(:disabled) {
  transform: scale(0.95);
}

.btn-op:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* 中间手柄信息区域 */
.gamepad-info {
  width: 320px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.02);
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  padding: 25px;
  overflow-y: auto;
}

.gamepad-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 20px;
}

.gamepad-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 15px;
}

.gamepad-icon {
  font-size: 2rem;
}

.gamepad-details h3 {
  margin: 0 0 4px 0;
  color: #fff;
  font-size: 1.1rem;
}

.gamepad-details p {
  margin: 0;
  color: #888;
  font-size: 0.75rem;
}

.gamepad-specs {
  margin-bottom: 20px;
}

.spec-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.8rem;
}

.spec-item label {
  color: #888;
}

.status-connected {
  color: #00ff88;
  font-weight: bold;
}

.btn-refresh {
  width: 100%;
  background: rgba(255, 107, 107, 0.2);
  color: #ff6b6b;
  border: 1px solid rgba(255, 107, 107, 0.3);
  padding: 8px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  transition: 0.2s;
}

.btn-refresh:hover {
  background: rgba(255, 107, 107, 0.3);
  transform: translateY(-1px);
}

.no-gamepad {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.empty-state-large {
  text-align: center;
  color: #555;
}

.empty-state-large .icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 15px;
}

.empty-state-large p {
  margin: 0 0 20px 0;
  font-size: 1rem;
}

.btn-primary {
  background: #ff6b6b;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  transition: 0.2s;
}

.btn-primary:hover {
  background: #ff5252;
  transform: translateY(-2px);
}

/* 右侧组合图侧边栏 */
.graph-sidebar {
  width: 320px;
  flex-shrink: 0;
  background: #08090d;
  border-left: 1px solid rgba(255,255,255,0.05);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.sidebar-header {
  padding: 15px 18px;
  background: rgba(0,0,0,0.2);
  display: flex; 
  justify-content: space-between; 
  align-items: center;
  font-size: 0.8rem; 
  font-weight: bold; 
  color: #ff6b6b;
  flex-shrink: 0;
  border-bottom: 1px solid #1a1a1a;
}

.sidebar-content {
  flex: 1;
  padding: 15px;
  overflow-y: auto;
}

.current-selection {
  margin-bottom: 20px;
  padding: 12px;
  background: rgba(255, 107, 107, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(255, 107, 107, 0.2);
}

.current-selection h4 {
  margin: 0 0 4px 0;
  color: #ff6b6b;
  font-size: 0.9rem;
}

.selection-desc {
  margin: 0;
  color: #888;
  font-size: 0.7rem;
}

/* 搜索框样式 */
.search-container {
  margin-bottom: 20px;
  padding: 0 12px;
}

.search-input {
  width: 100%;
  padding: 10px 15px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  font-size: 0.85rem;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}

.search-input:focus {
  border-color: #ff6b6b;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 2px rgba(255, 107, 107, 0.2);
}

.search-input::placeholder {
  color: #666;
}

.search-info {
  margin-top: 8px;
  font-size: 0.7rem;
  color: #aaa;
  text-align: center;
}

.graphs-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.graph-item {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.graph-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: #4f64ff;
  transform: translateX(4px);
}

.graph-item.bound {
  border-color: #00ff88;
  background: rgba(0, 255, 136, 0.05);
}

.graph-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.graph-id {
  font-size: 0.7rem;
  color: #4f64ff;
  font-family: monospace;
  align-self: flex-start;
}

.graph-name {
  font-size: 0.9rem;
  font-weight: bold;
  color: #fff;
}

.project-tag {
  font-size: 0.65rem;
  color: #ffd93d;
  background: rgba(255, 217, 61, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
  align-self: flex-start;
}

.graph-info {
  margin: 8px 0;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.info-label {
  font-size: 0.7rem;
  color: #aaa;
}

.info-value {
  font-size: 0.7rem;
  color: #fff;
  font-weight: 500;
}

.graph-status .status-bound {
  color: #00ff88;
  font-size: 0.65rem;
  font-weight: bold;
}

.graph-status .status-available {
  color: #ffd93d;
  font-size: 0.65rem;
  font-weight: bold;
}

.no-graphs {
  text-align: center;
  color: #555;
  padding: 30px 0;
}

.no-graphs p {
  margin: 0 0 8px 0;
}

.no-graphs small {
  color: #444;
  font-size: 0.7rem;
}

.no-selection {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #555;
  text-align: center;
  padding: 20px;
}

/* 底部日志面板 */
.log-panel {
  height: 180px;
  background: #08090d;
  border-top: 1px solid rgba(255,255,255,0.05);
  display: flex;
  flex-direction: column;
}

.log-header {
  padding: 10px 18px;
  background: rgba(0,0,0,0.2);
  display: flex; 
  justify-content: space-between; 
  align-items: center;
  font-size: 0.75rem; 
  font-weight: bold; 
  color: #ff6b6b;
  flex-shrink: 0;
  border-bottom: 1px solid #1a1a1a;
}

.log-body {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  font-family: 'Consolas', monospace;
  font-size: 0.7rem;
}

.log-entry {
  margin-bottom: 6px;
  line-height: 1.4;
  border-left: 2px solid #1a1a1a;
  padding-left: 8px;
  word-break: break-all;
  white-space: pre-wrap;
}

.t-stamp { color: #444; margin-right: 6px; font-size: 0.65rem; font-weight: bold; }
.success { border-left-color: #00ff88; color: #00ff88; }
.error { border-left-color: #ff4444; color: #ff4444; }
.warning { border-left-color: #ffd93d; color: #ffd93d; }
.info { border-left-color: #4f64ff; color: #4f64ff; }
.log-placeholder { text-align: center; margin-top: 30px; color: #333; font-style: italic; }

.clear-btn { 
  background: transparent; 
  border: 1px solid #333; 
  color: #555; 
  font-size: 0.6rem; 
  cursor: pointer; 
  padding: 2px 10px; 
  border-radius: 4px; 
}

.clear-btn:hover { color: #fff; border-color: #666; }

/* 按键映射显示样式 */
.mapping-display {
  cursor: pointer;
  transition: all 0.2s;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 8px;
}

.mapping-display:hover {
  background: rgba(255, 255, 255, 0.05);
}

.mapping-value {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mapping-target {
  padding: 6px 12px;
  background: rgba(255, 107, 107, 0.1);
  border-radius: 16px;
  display: inline-block;
}

.mapped-button {
  background: rgba(255, 107, 107, 0.2);
  color: #ff6b6b;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 0.8rem;
  font-weight: 500;
}

.target-button {
  color: #ff6b6b;
  font-size: 0.8rem;
  font-weight: 500;
}

.edit-icon {
  font-size: 0.9rem;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.mapping-display:hover .edit-icon {
  opacity: 1;
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.mapping-modal {
  background: #1a1a1a;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.modal-header h3 {
  margin: 0;
  color: #ff6b6b;
  font-size: 1.2rem;
}

.modal-close {
  background: transparent;
  border: none;
  color: #aaa;
  font-size: 1.5rem;
  cursor: pointer;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.modal-content {
  padding: 20px;
}

.current-mapping {
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(255, 107, 107, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(255, 107, 107, 0.2);
}

.mapping-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.physical-key, .current-target {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}

.physical-key span, .current-target span {
  color: #aaa;
  font-size: 0.9rem;
}

.physical-key strong, .current-target strong {
  color: #ff6b6b;
  font-size: 1.1rem;
  font-weight: 600;
}

.button-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.button-option {
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 16px 12px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.button-option:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 107, 107, 0.3);
  transform: translateY(-2px);
}

.button-option.selected {
  background: rgba(255, 107, 107, 0.2);
  border-color: #ff6b6b;
  box-shadow: 0 0 0 2px rgba(255, 107, 107, 0.3);
}

.button-label {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
}

.button-name {
  font-size: 0.7rem;
  color: #888;
  font-family: monospace;
}

.button-option.selected .button-label {
  color: #ff6b6b;
}

.button-option.selected .button-name {
  color: #ff6b6b;
}

/* 模态框滚动条 */
.button-grid::-webkit-scrollbar {
  width: 6px;
}

.button-grid::-webkit-scrollbar-track {
  background: transparent;
}

.button-grid::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.button-grid::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 107, 107, 0.5);
}

/* 滚动条美化 */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: #ff6b6b; }
</style>