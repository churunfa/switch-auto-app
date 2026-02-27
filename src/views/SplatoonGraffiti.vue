<template>
  <div class="splatoon-graffiti-page">
    <div class="page-header">
      <h1>🎨 斯普拉遁涂鸦绘制</h1>
      <p class="page-description">上传图片自动转换为320×120单色位图并分组绘制</p>
    </div>
    
    <div class="content-area">
      <!-- 图片上传区域 -->
      <div class="upload-section">
        <h2>📤 图片上传与处理</h2>
        <div class="upload-container">
          <div 
            class="drop-zone" 
            @dragover.prevent="handleDragOver"
            @drop.prevent="handleDrop"
            @click="triggerFileInput"
          >
            <input 
              type="file" 
              ref="fileInput" 
              @change="handleFileSelect" 
              accept="image/*"
              style="display: none;"
            />
            <div class="upload-icon">📁</div>
            <p>拖拽图片到这里或点击选择文件</p>
            <p class="upload-hint">支持 JPG、PNG、GIF 等格式</p>
          </div>
        </div>
      </div>

      <!-- 图片预览和处理区域 -->
      <div v-if="originalImage" class="preview-section">
        <h2>🖼️ 图片预览与处理</h2>
        <div class="preview-container">
          <div class="image-preview">
            <h3>原始图片</h3>
            <img :src="originalImage" alt="原始图片" class="preview-image" />
          </div>
          
          <div class="processed-preview">
            <h3>处理后图像 (320×120)</h3>
            <canvas 
              ref="processedCanvas" 
              width="320" 
              height="120" 
              class="preview-canvas"
            ></canvas>
            <div class="processing-info">
              <p>尺寸: {{ imageWidth }} × {{ imageHeight }} → 320 × 120</p>
              <p>处理方式: {{ processingMethod }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 分组配置区域 -->
      <div v-if="bitmapData.length > 0" class="grouping-section">
        <h2>⚙️ 分组配置</h2>
        <div class="grouping-controls">
          <div class="control-item">
            <label>分组数量:</label>
            <input 
              type="range" 
              min="1" 
              max="320" 
              v-model.number="groupCount" 
              class="slider"
            />
            <span class="value-display">{{ groupCount }} 组</span>
          </div>
          
          <div class="control-item">
            <label>每组像素数:</label>
            <span class="value-display">{{ pixelsPerGroup }} 像素/组</span>
          </div>
        </div>
      </div>

      <!-- 绘制控制区域 -->
      <div v-if="groupedData.length > 0" class="drawing-section">
        <h2>🎮 绘制控制</h2>

        <div class="drawing-panel-wrapper">
          <div class="action-area">
            <div v-if="!isDrawing && !isPaused" class="initial-start-options">
              <div class="start-option">
                <button
                    @click="startDrawingFromBeginning"
                    class="action-button primary large"
                >
                  🎯 直接开始绘制
                </button>
                <p class="option-desc">从第1组开始完整绘制</p>
              </div>

              <div class="start-option separator">或</div>

              <div class="start-option">
                <div class="goto-input-group">
                  <label>从第</label>
                  <input
                      type="number"
                      v-model.number="gotoGroupIndex"
                      min="1"
                      :max="groupCount"
                      class="goto-input-small"
                  />
                  <label>组开始绘制</label>
                </div>
                <button
                    @click="startDrawingFromGroup"
                    :disabled="gotoGroupIndex < 1 || gotoGroupIndex > groupCount"
                    class="action-button goto large"
                >
                  🎯 从指定组开始
                </button>
              </div>
            </div>

            <div v-else class="drawing-controls">
              <button
                  v-if="isDrawing && !isPaused"
                  @click="pauseDrawing"
                  class="action-button secondary large"
              >
                ⏸️ 暂停绘制
              </button>

              <button
                  v-else-if="isPaused"
                  @click="resumeDrawing"
                  class="action-button primary large"
              >
                ▶️ 继续绘制
              </button>

              <button
                  @click="stopDrawing"
                  class="action-button stop"
              >
                ⏹️ 停止绘制
              </button>
            </div>
          </div>

          <div class="status-area">
            <div class="drawing-progress" v-if="isDrawing || isPaused">
              <div class="progress-bar">
                <div
                    class="progress-fill"
                    :style="{ width: `${drawingProgress}%` }"
                ></div>
              </div>
              <p v-if="isDrawing">正在绘制第 {{ currentGroupIndex + 1 }}/{{ groupCount }} 组</p>
              <p v-else-if="isPaused">已暂停，当前第 {{ currentGroupIndex + 1 }}/{{ groupCount }} 组</p>
            </div>

            <div class="drawing-result" v-if="!isDrawing && !isPaused && lastDrawnGroup >= 0 && lastDrawnGroup === groupCount - 1">
              <div class="completion-card">
                <div class="completion-icon">🎉</div>
                <div class="completion-content">
                  <h3>绘制完成！</h3>
                  <p>已成功绘制全部 {{ groupCount }} 组</p>
                  <p class="completion-stats">完成 100%</p>
                </div>
              </div>
            </div>
            <div class="drawing-result" v-else-if="!isDrawing && !isPaused && lastDrawnGroup >= 0">
              <div class="completion-card partial">
                <div class="completion-icon">⏸️</div>
                <div class="completion-content">
                  <h3>绘制已停止</h3>
                  <p>已绘制到第 {{ lastDrawnGroup + 1 }} 组</p>
                  <p class="completion-stats">共 {{ groupCount }} 组，完成 {{ Math.round((lastDrawnGroup + 1) * 100 / groupCount) }}%</p>
                </div>
              </div>
            </div>
            <div class="drawing-result" v-else-if="!isDrawing && !isPaused && lastDrawnGroup === -1">
              <div class="completion-card incomplete">
                <div class="completion-icon">⏹️</div>
                <div class="completion-content">
                  <h3>绘制已停止</h3>
                  <p>未开始绘制操作</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../utils/api.js';

// 响应式数据
const fileInput = ref(null);
const originalImage = ref(null);
const processedCanvas = ref(null);
const imageWidth = ref(0);
const imageHeight = ref(0);
const processingMethod = ref('');
const bitmapData = ref([]);
const groupCount = ref(320);
const isDrawing = ref(false);
const isPaused = ref(false);
const currentGroupIndex = ref(0);
const lastDrawnGroup = ref(-1);
const gotoGroupIndex = ref(1);
const drawingProgress = ref(0);
const isDrawingFromSpecificGroup = ref(false);

// 计算属性
const pixelsPerGroup = computed(() => Math.floor(320 * 120 / groupCount.value));
const lastGroupPixels = computed(() => (320 * 120) % groupCount.value);
const groupedData = computed(() => {
  if (bitmapData.value.length === 0) return [];

  const groups = [];
  const totalPixels = 320 * 120;
  const regularGroupSize = pixelsPerGroup.value;

  // 蛇形分组逻辑：先将原始像素数据转换为蛇形顺序
  const snakeOrderedData = [];
  const width = 320;
  const height = 120;

  // 按蛇形顺序重新排列像素数据
  for (let y = 0; y < height; y++) {
    if (y % 2 === 0) {
      // 偶数行：从左到右
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        snakeOrderedData.push(bitmapData.value[index]);
      }
    } else {
      // 奇数行：从右到左
      for (let x = width - 1; x >= 0; x--) {
        const index = y * width + x;
        snakeOrderedData.push(bitmapData.value[index]);
      }
    }
  }

  // 然后按组大小分组
  for (let i = 0; i < groupCount.value; i++) {
    const startIndex = i * regularGroupSize;
    const endIndex = i === groupCount.value - 1
      ? totalPixels
      : startIndex + regularGroupSize;

    groups.push(snakeOrderedData.slice(startIndex, endIndex));
  }

  return groups;
});

// 方法定义
function triggerFileInput() {
  fileInput.value.click();
}

function handleDragOver(event) {
  event.currentTarget.classList.add('drag-over');
}

function handleDrop(event) {
  event.currentTarget.classList.remove('drag-over');
  const files = event.dataTransfer.files;
  if (files.length > 0) {
    processFile(files[0]);
  }
}

async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    processFile(file);
  }
}

async function processFile(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    originalImage.value = e.target.result;
    // 延迟处理以确保图片加载完成
    await processImage();
  };
  reader.readAsDataURL(file);
}

async function processImage() {
  try {
    // 创建表单数据
    const formData = new FormData();
    // 将data URL转换为Blob
    const base64Data = originalImage.value.split(',')[1];
    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    const file = new File([blob], 'uploaded_image.jpg', { type: 'image/jpeg' });
    formData.append('file', file);

    // 调用后端API处理图片
    const response = await api.post('/api/splatoon-graffiti/img/process', formData, {
      headers: {
      }
    });
    
    if (!response.success) {
      throw new Error(response.message || '图片处理失败');
    }
    
    // 解码Base64字符串为字节数组
    const bitmapBase64 = response.data;
    const bitmapBytes = window.atob(bitmapBase64);
    const bitmap = [];
    for (let i = 0; i < bitmapBytes.length; i++) {
      bitmap.push(bitmapBytes.charCodeAt(i));
    }
    
    // 设置处理后的像素数据
    bitmapData.value = bitmap;
    
    // 更新显示信息
    imageWidth.value = 320;
    imageHeight.value = 120;
    processingMethod.value = '后端处理，Bayer抖动算法';
    
    // 在canvas上显示处理后的图像
    const canvas = processedCanvas.value;
    const ctx = canvas.getContext('2d');
    
    // 清空画布并绘制背景（白色填充）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 320, 120);
    
    // 绘制处理后的黑白位图
    for (let y = 0; y < 120; y++) {
      for (let x = 0; x < 320; x++) {
        const index = y * 320 + x;
        const pixelValue = bitmap[index];
        ctx.fillStyle = pixelValue === 1 ? '#000000' : '#ffffff';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    
  } catch (error) {
    console.error('图片处理失败:', error);
    ElMessage.error('图片处理失败: ' + error.message);
  }
}

// function convertToBitmap(ctx, width, height) {
//   const imageData = ctx.getImageData(0, 0, width, height);
//   const data = imageData.data;
//   const bitmap = [];
//   
//   for (let i = 0; i < data.length; i += 4) {
//     const r = data[i];
//     const g = data[i + 1];
//     const b = data[i + 2];
//     // 简单的亮度判断转为黑白
//     const brightness = (r + g + b) / 3;
//     const bit = brightness > 128 ? 0 : 1; // 亮色为0，暗色为1
//     bitmap.push(bit);
//   }
//   
//   bitmapData.value = bitmap;
// }

// 绘制控制器
let drawTimer = null;

function startDrawingFromBeginning() {
  if (groupedData.value.length === 0) return;
  
  isDrawing.value = true;
  isPaused.value = false;
  currentGroupIndex.value = 0;
  drawingProgress.value = 0;
  isDrawingFromSpecificGroup.value = false;
  
  // 启动绘制循环
  continueDrawingLoop();
}

function startDrawingFromGroup() {
  if (groupedData.value.length === 0) return;
  
  // 验证输入范围
  if (gotoGroupIndex.value < 1 || gotoGroupIndex.value > groupCount.value) {
    alert('请输入有效的组号（1-' + groupCount.value + '）');
    return;
  }
  
  const startIndex = gotoGroupIndex.value - 1;
  
  isDrawing.value = true;
  isPaused.value = false;
  currentGroupIndex.value = startIndex;
  drawingProgress.value = (startIndex / groupedData.value.length) * 100;
  
  // 启动绘制循环
  continueDrawingLoop();
}

function pauseDrawing() {
  isPaused.value = true;
  // 清除定时器但不改变绘制状态
}

function resumeDrawing() {
  isPaused.value = false;
  // 继续绘制循环
  continueDrawingLoop();
}

function stopDrawing() {
  // 停止绘制并记录进度
  isDrawing.value = false;
  isPaused.value = false;
  
  // 清除定时器
  if (drawTimer) {
    clearTimeout(drawTimer);
    drawTimer = null;
  }
  
  // 记录最后绘制的组号
  if (currentGroupIndex.value > 0) {
    lastDrawnGroup.value = currentGroupIndex.value - 1;
  } else {
    lastDrawnGroup.value = -1;
  }
  
  drawingProgress.value = 0;
}

// 绘制循环核心函数
function continueDrawingLoop() {
  if (!isDrawing.value || isPaused.value) {
    return;
  }
  
  // 执行当前组的绘制
  sendGroupToBackend(currentGroupIndex.value, groupedData.value[currentGroupIndex.value])
    .then(() => {
      // 更新进度
      currentGroupIndex.value++;
      drawingProgress.value = (currentGroupIndex.value / groupedData.value.length) * 100;
      
      // 检查是否完成
      if (currentGroupIndex.value >= groupedData.value.length) {
        // 绘制完成
        isDrawing.value = false;
        isPaused.value = false;
        ElMessage.success('绘制完成！');
        return;
      }
      
      // 继续下一组（100ms延迟）
      drawTimer = setTimeout(continueDrawingLoop, 100);
    })
    .catch(error => {
      console.error('绘制过程中出错:', error);
      ElMessage.error('绘制失败: ' + error.message);
      stopDrawing();
    });
}

async function sendGroupToBackend(groupIndex, pixelData) {
  try {
    // 计算组大小（每组像素数）
    const groupSize = pixelsPerGroup.value;
    
    // 判断是否需要重置：当是第一次绘制（从第0组开始）或从指定组开始的第一组
    const isReset = groupIndex === 0 || (isDrawingFromSpecificGroup.value && groupIndex === gotoGroupIndex.value - 1);
    
    const response = await api.post('/api/splatoon-graffiti/draw', {
      groupIndex: groupIndex,
      pixelData: pixelData,
      totalGroups: groupCount.value,
      reset: isReset,
      groupSize: groupSize,
      colCount: 320,
      rowCount: 120
    });
    
    console.log('后端响应:', response);
    
    // 检查响应是否成功
    if (!response.success) {
      const errorMessage = response.message || '绘制失败';
      throw new Error(errorMessage);
    }
    
    return response;
  } catch (error) {
    console.error('发送到后端失败:', error);
    throw error;
  }
}

// 监听分组数量变化
watch(groupCount, () => {
  currentGroupIndex.value = 0;
});
</script>

<style scoped>
.splatoon-graffiti-page {
  padding: 30px;
  height: 100%;
  overflow-y: auto;
  background: linear-gradient(135deg, #0a0b10 0%, #121520 100%);
}

.page-header {
  margin-bottom: 40px;
  text-align: center;
}

.page-header h1 {
  color: #fff;
  font-size: 2.5rem;
  margin-bottom: 10px;
  background: linear-gradient(90deg, #4f64ff, #00c3ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-description {
  color: #aaa;
  font-size: 1.1rem;
  margin: 0;
}

.content-area {
  max-width: 1200px;
  margin: 0 auto;
}

/* 上传区域样式 */
.upload-section, .preview-section, .grouping-section, .drawing-section {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 30px;
  margin-bottom: 40px;
  min-height: 220px;
}

.upload-section h2, .preview-section h2, .grouping-section h2, .drawing-section h2 {
  color: #fff;
  font-size: 1.8rem;
  margin: 0 0 25px 0;
}

.drop-zone {
  border: 2px dashed rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.drop-zone:hover, .drop-zone.drag-over {
  border-color: #4f64ff;
  background: rgba(79, 100, 255, 0.1);
}

.upload-icon {
  font-size: 3rem;
  margin-bottom: 15px;
}

.drop-zone p {
  color: #ddd;
  margin: 10px 0;
}

.upload-hint {
  color: #888 !important;
  font-size: 0.9rem;
}

/* 预览区域样式 */
.preview-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
}

.image-preview, .processed-preview {
  text-align: center;
}

.image-preview h3, .processed-preview h3 {
  color: #fff;
  margin-bottom: 15px;
}

.preview-image {
  max-width: 100%;
  max-height: 200px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.preview-canvas {
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: #000;
  image-rendering: pixelated;
}

.processing-info {
  margin-top: 15px;
  color: #aaa;
  font-size: 0.9rem;
}

.processing-info p {
  margin: 5px 0;
}

/* 分组配置样式 */
.grouping-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.control-item {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-item label {
  color: #ddd;
  font-weight: 500;
}

.slider {
  -webkit-appearance: none;
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  outline: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #4f64ff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 0 10px rgba(79, 100, 255, 0.6);
}

.value-display {
  color: #4f64ff;
  font-weight: 600;
  text-align: center;
}

/* 首次开始绘制选项样式 */
.initial-start-options {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 30px;
  flex-wrap: wrap;
  margin-bottom: 30px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
}

.start-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  min-width: 200px;
}

.start-option.separator {
  color: #888;
  font-size: 1.2rem;
  font-weight: bold;
  min-width: auto;
}

.option-desc {
  color: #aaa;
  font-size: 0.9rem;
  text-align: center;
  margin: 0;
}

.goto-input-group {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
}

.goto-input-group label {
  color: #ddd;
  font-weight: 500;
}

.goto-input-small {
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 1rem;
  width: 60px;
  text-align: center;
  -webkit-appearance: none;
  -moz-appearance: textfield;
}

.goto-input-small:focus {
  outline: none;
  border-color: #4f64ff;
  background: rgba(255, 255, 255, 0.2);
  box-shadow: 0 0 0 2px rgba(79, 100, 255, 0.3);
}

/* 绘制控制按钮样式 */
.drawing-controls {
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-bottom: 30px;
  flex-wrap: wrap;
}

.action-button {
  padding: 15px 30px;
  border: none;
  border-radius: 10px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-button.large {
  padding: 18px 35px;
  font-size: 1.2rem;
  min-width: 200px;
}

.action-button.primary {
  background: linear-gradient(90deg, #4f64ff, #00c3ff);
  color: white;
}

.action-button.primary:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 5px 15px rgba(79, 100, 255, 0.4);
}

.action-button.secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.action-button.secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.action-button.goto {
  background: linear-gradient(90deg, #6a5acd, #9370db);
  color: white;
}

.action-button.goto:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 5px 15px rgba(106, 90, 205, 0.4);
}

.action-button.stop {
  background: linear-gradient(90deg, #da3633, #f85149);
  color: white;
}

.action-button.stop:hover {
  transform: scale(1.05);
  box-shadow: 0 5px 15px rgba(218, 54, 51, 0.4);
}

/* 进度条样式 */
.progress-bar {
  width: 100%;
  height: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 15px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4f64ff, #00c3ff);
  border-radius: 6px;
  transition: width 0.3s ease;
}

.drawing-progress p {
  color: #ddd;
  text-align: center;
  margin: 0;
  font-size: 1.1rem;
}

/* 完成卡片样式 */
.completion-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: rgba(79, 100, 255, 0.1);
  border-radius: 12px;
  border-left: 4px solid #4f64ff;
  transition: all 0.3s ease;
}

.completion-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(79, 100, 255, 0.2);
}

.completion-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
}

.completion-content h3 {
  color: #fff;
  margin: 0 0 8px 0;
  font-size: 1.4rem;
}

.completion-content p {
  color: #ddd;
  margin: 0 0 6px 0;
  font-size: 1rem;
}

.completion-stats {
  color: #4f64ff;
  font-weight: 600;
  font-size: 0.9rem;
}

.completion-card.incomplete {
  background: rgba(218, 54, 51, 0.1);
  border-left-color: #da3633;
}

.completion-card.incomplete .completion-icon {
  color: #da3633;
}

.completion-card.incomplete h3 {
  color: #da3633;
}

.completion-card.partial {
  background: rgba(255, 193, 7, 0.1);
  border-left-color: #ffc107;
}

.completion-card.partial .completion-icon {
  color: #ffc107;
}

.completion-card.partial h3 {
  color: #ffc107;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .preview-container {
    grid-template-columns: 1fr;
  }

  .drawing-controls {
    flex-direction: column;
  }

  .initial-start-options {
    flex-direction: column;
    gap: 20px;
  }

  .start-option {
    min-width: 100%;
  }

  .action-button.large {
    min-width: 100%;
  }
}

.drawing-result {
  margin-top: 20px;
  margin-bottom: 20px;
  position: relative;
}
/* 专属绘制区域外框 */
.drawing-section {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 30px;
  margin-bottom: 40px;
}

/* 总体排版容器 */
.drawing-panel-wrapper {
  display: flex;
  flex-direction: column;
  gap: 20px; /* 上下区的间距 */
}

/* 上半区：强制占用 130px 高度，保证“开始绘制”大按钮放得下 */
.action-area {
  min-height: 130px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

/* 下半区：强制占用 110px 高度，保证“停止绘制卡片”放得下 */
.status-area {
  min-height: 110px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
}

/* ！！！重要：清除原有组件自带的 marginBottom/marginTop 防止高度计算干扰 ！！！ */
.initial-start-options {
  margin-bottom: 0; /* 原来是 30px */
  padding: 0;       /* 原来是 20px */
  background: transparent;
  width: 100%;
}

.drawing-controls {
  margin-bottom: 0; /* 原来是 30px */
}

.drawing-result {
  margin-top: 0;    /* 原来是 20px */
  margin-bottom: 0; /* 原来是 20px */
}
</style>