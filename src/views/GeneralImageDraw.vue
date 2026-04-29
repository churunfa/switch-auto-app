<template>
  <div class="general-image-draw-page">
    <div class="page-header">
      <h1>🖌️ 通用图像绘制</h1>
      <p class="page-description">上传图片自动转换为指定尺寸进行绘制</p>
    </div>

    <div class="content-area">
      <!-- 图片上传区域 -->
      <div class="upload-section">
        <h2>📤 图片上传</h2>
        <div class="upload-container">
          <div class="drop-zone" @dragover.prevent="handleDragOver" @drop.prevent="handleDrop" @click="triggerFileInput">
            <input type="file" ref="fileInput" @change="handleFileSelect" accept="image/*" style="display: none;" />
            <div class="upload-icon">📁</div>
            <p>拖拽图片到这里或点击选择文件</p>
            <p class="upload-hint">支持 JPG、PNG、GIF 等格式</p>
          </div>
        </div>
      </div>

      <!-- 参数配置区域 -->
      <div v-if="originalImage" class="config-section">
        <h2>⚙️ 参数配置</h2>
        <div class="config-controls">
          <div class="control-item">
            <label>输出宽度 (像素):</label>
            <input
                type="number"
                min="1"
                max="1000"
                v-model.number="outputWidth"
                class="number-input"
            />
          </div>

          <div class="control-item">
            <label>输出高度 (像素):</label>
            <input
                type="number"
                min="1"
                max="1000"
                v-model.number="outputHeight"
                class="number-input"
            />
          </div>

          <div class="control-item">
            <label>颜色种类数:</label>
            <input
                type="number"
                min="2"
                max="256"
                v-model.number="colorCount"
                class="number-input"
            />
          </div>

          <div class="control-item action-item">
            <button @click="processImage" class="action-button primary" :disabled="isProcessing">
              {{ isProcessing ? '处理中...' : '🔄 开始处理' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 图片预览区域 -->
      <div v-if="processedImageData" class="preview-section">
        <h2>🖼️ 处理结果预览</h2>
        <div class="preview-container">
          <div class="original-preview">
            <h3>原始图片</h3>
            <img :src="originalImage" alt="原始图片" class="preview-image" />
          </div>
          <div class="processed-preview">
            <h3>处理后图像 ({{ currentWidth }}×{{ currentHeight }}) <span v-if="!hasProcessed" class="waiting-hint">（等待处理）</span></h3>
            <canvas ref="processedCanvas" :width="currentWidth" :height="currentHeight" class="preview-canvas"></canvas>
          </div>
        </div>
      </div>

      <!-- 颜色展示区域 -->
      <div v-if="extractedColors.length > 0" class="colors-section">
        <h2>🎨 提取的颜色 (共 {{ extractedColors.length }} 种)</h2>
        <div class="colors-grid">
          <div
            v-for="(color, index) in extractedColors"
            :key="index"
            class="color-item"
            :class="{ 'selected': selectedColorIndex === index }"
            @click="selectColor(index)"
          >
            <div class="color-swatch" :style="{ backgroundColor: color.hex }"></div>
            <div class="color-info">
              <span class="color-hex">{{ color.hex }}</span>
              <span class="color-percent">{{ color.percentage }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 选中颜色的像素展示区域 -->
      <div v-if="selectedColorIndex >= 0 && processedCanvas" class="pixel-preview-section">
        <h2>🔍 选中颜色的像素分布</h2>
        <div class="pixel-preview-container">
          <canvas 
            ref="pixelPreviewCanvas" 
            :width="currentWidth" 
            :height="currentHeight" 
            class="pixel-preview-canvas"
          ></canvas>
          <div class="pixel-info">
            <p>颜色: <span class="color-badge" :style="{ backgroundColor: extractedColors[selectedColorIndex]?.hex }">{{ extractedColors[selectedColorIndex]?.hex }}</span></p>
            <p>像素数量: {{ selectedPixelCount }} 个</p>
            <p>占比: {{ extractedColors[selectedColorIndex]?.percentage }}%</p>
          </div>
        </div>
      </div>

      <!-- 绘制控制区域 -->
      <div v-if="selectedColorIndex >= 0" class="drawing-section">
        <h2>🎮 绘制控制 - 当前颜色:
          <span class="current-color-indicator" :style="{ backgroundColor: extractedColors[selectedColorIndex]?.hex }">
            {{ extractedColors[selectedColorIndex]?.hex }}
          </span>
        </h2>
        <div class="drawing-panel">
          <div class="drawing-actions">
            <button v-if="!isDrawing && !isPaused" @click="startDrawing" class="action-button primary large">
              🎯 开始绘制
            </button>
            <button v-if="isDrawing && !isPaused" @click="pauseDrawing" class="action-button secondary large">
              ️ 暂停绘制
            </button>
            <button v-if="isPaused" @click="resumeDrawing" class="action-button primary large">
              ▶️ 继续绘制
            </button>
            <button v-if="isDrawing || isPaused" @click="stopDrawing" class="action-button stop large">
              ⏹️ 停止绘制
            </button>
          </div>

          <div class="drawing-status" v-if="isDrawing || isPaused">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${drawingProgress}%` }"></div>
            </div>
            <p v-if="isDrawing">正在绘制第 {{ currentGroupIndex + 1 }}/{{ groupCount }} 组</p>
            <p v-else-if="isPaused">已暂停，当前第 {{ currentGroupIndex + 1 }}/{{ groupCount }} 组</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../utils/api.js';

const fileInput = ref(null);
const originalImage = ref(null);
const processedCanvas = ref(null);
const processedImageData = ref(null);
const pixelPreviewCanvas = ref(null);

// 配置参数
const outputWidth = ref(200);
const outputHeight = ref(200);
const colorCount = ref(16);
const isProcessing = ref(false);
const hasProcessed = ref(false); // 标记是否已经处理过图片

// 实际使用的Canvas尺寸（只在点击处理后才更新）
const currentWidth = ref(200);
const currentHeight = ref(200);

// 颜色数据
const extractedColors = ref([]);
const selectedColorIndex = ref(-1);
const selectedPixelCount = ref(0);

// 绘制状态
const isDrawing = ref(false);
const isPaused = ref(false);
const drawingProgress = ref(0);
const currentGroupIndex = ref(0);
const groupCount = ref(1); // 通用图像默认1组（一次性绘制所有选中像素）
const fastMode = ref(false); // 快速模式
let drawTimer = null;

// 存储选中颜色的像素数据（二值化数组）
const binaryPixelData = ref([]);

// 文件上传处理
function triggerFileInput() {
  fileInput.value?.click();
}

function handleDragOver(e) {
  e.currentTarget.classList.add('drag-over');
}

function handleDrop(e) {
  e.currentTarget.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    originalImage.value = e.target.result;
    ElMessage.success('图片上传成功，请配置参数后点击处理');
  };
  reader.readAsDataURL(file);
}

// 图片处理
async function processImage() {
  if (!originalImage.value) {
    ElMessage.warning('请先上传图片');
    return;
  }

  isProcessing.value = true;

  try {
    // TODO: 调用后端接口处理图片
    // 这里先模拟处理过程
    await simulateImageProcessing();

    ElMessage.success('图片处理完成，请选择颜色进行绘制');
  } catch (error) {
    ElMessage.error('图片处理失败: ' + error.message);
  } finally {
    isProcessing.value = false;
  }
}

// 模拟图片处理(待替换为真实API调用)
async function simulateImageProcessing() {
  return new Promise((resolve) => {
    setTimeout(() => {
      // 更新实际Canvas尺寸
      currentWidth.value = outputWidth.value;
      currentHeight.value = outputHeight.value;
      
      extractedColors.value = [];
      processedImageData.value = true;
      hasProcessed.value = true;
      
      // 在canvas上绘制处理后的图像
      nextTick(() => {
        processAndDrawImage();
      });
      
      resolve();
    }, 1500);
  });
}

// HSL转HEX颜色
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

// 处理并绘制图像到canvas
function processAndDrawImage() {
  if (!processedCanvas.value || !originalImage.value) return;

  const canvas = processedCanvas.value;
  const ctx = canvas.getContext('2d');

  // 创建一个新的Image对象来加载原始图片
  const img = new Image();
  img.onload = () => {
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 计算缩放比例，保持图片比例并居中
    const scale = Math.min(
      canvas.width / img.width,
      canvas.height / img.height
    );

    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const x = (canvas.width - scaledWidth) / 2;
    const y = (canvas.height - scaledHeight) / 2;

    // 填充白色背景
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制缩放后的图片
    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

    // 提取图片中的颜色
    extractColorsFromCanvas(ctx, canvas.width, canvas.height);

    // 应用颜色量化到Canvas
    nextTick(() => {
      applyColorQuantization(ctx, canvas.width, canvas.height);
    });
  };
  img.src = originalImage.value;
}

// 应用颜色量化
function applyColorQuantization(ctx, width, height) {
  if (extractedColors.value.length === 0) return;

  // 获取图像数据
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // 将提取的颜色转换为RGB数组
  const targetColors = extractedColors.value.map(color => {
    const hex = color.hex.substring(1);
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16)
    };
  });

  // 对每个像素应用颜色量化
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // 跳过透明像素
    if (a < 128) continue;

    // 找到最接近的目标颜色
    const closestColor = findClosestColor(r, g, b, targetColors);

    // 替换为最接近的颜色
    data[i] = closestColor.r;
    data[i + 1] = closestColor.g;
    data[i + 2] = closestColor.b;
  }

  // 将处理后的数据放回Canvas
  ctx.putImageData(imageData, 0, 0);
}

// 找到最接近的颜色
function findClosestColor(r, g, b, targetColors) {
  let minDistance = Infinity;
  let closestColor = targetColors[0];

  for (const color of targetColors) {
    // 计算欧氏距离
    const distance = Math.sqrt(
      Math.pow(r - color.r, 2) +
      Math.pow(g - color.g, 2) +
      Math.pow(b - color.b, 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestColor = color;
    }
  }

  return closestColor;
}

// 从canvas中提取颜色
function extractColorsFromCanvas(ctx, width, height) {
  // 获取图像数据
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // 统计颜色频率
  const colorMap = new Map();
  let validPixelCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // 跳过透明像素
    if (a < 128) continue;

    validPixelCount++;

    // 简化颜色（减少精度以合并相似颜色）
    const simplifiedR = Math.round(r / 32) * 32;
    const simplifiedG = Math.round(g / 32) * 32;
    const simplifiedB = Math.round(b / 32) * 32;

    const colorKey = `${simplifiedR},${simplifiedG},${simplifiedB}`;

    if (colorMap.has(colorKey)) {
      colorMap.set(colorKey, colorMap.get(colorKey) + 1);
    } else {
      colorMap.set(colorKey, 1);
    }
  }

  // 转换为数组并排序
  const colorArray = Array.from(colorMap.entries())
    .map(([key, count]) => {
      const [r, g, b] = key.split(',').map(Number);
      const hex = rgbToHex(r, g, b);
      return { hex, count };
    })
    .sort((a, b) => b.count - a.count);

  // 根据用户设置的颜色数量，取前N个主要颜色
  const topColors = colorArray.slice(0, colorCount.value);

  // 计算选中颜色的总像素数
  const topColorsTotalCount = topColors.reduce((sum, color) => sum + color.count, 0);

  // 计算百分比 - 基于选中的颜色总数进行归一化
  extractedColors.value = topColors.map(color => ({
    hex: color.hex,
    percentage: ((color.count / topColorsTotalCount) * 100).toFixed(1)
  }));
}

// RGB转HEX
function rgbToHex(r, g, b) {
  return '#' + [r, g, b]
    .map(x => {
      const hex = Math.min(255, Math.max(0, x)).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    })
    .join('')
    .toUpperCase();
}

// 颜色选择
function selectColor(index) {
  selectedColorIndex.value = index;
  const color = extractedColors.value[index];
  ElMessage.info(`已选择颜色: ${color.hex} (占比 ${color.percentage}%)`);

  // 高亮显示选中的像素
  nextTick(() => {
    highlightSelectedPixels();
  });
}

// 高亮显示选中的像素
function highlightSelectedPixels() {
  if (!processedCanvas.value || !pixelPreviewCanvas.value || selectedColorIndex.value < 0) return;

  const sourceCanvas = processedCanvas.value;
  const previewCanvas = pixelPreviewCanvas.value;
  const ctx = previewCanvas.getContext('2d');

  // 获取源图像数据
  const imageData = sourceCanvas.getContext('2d').getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const data = imageData.data;

  // 获取选中的颜色
  const selectedColor = extractedColors.value[selectedColorIndex.value];
  const hex = selectedColor.hex.substring(1);
  const targetR = parseInt(hex.substring(0, 2), 16);
  const targetG = parseInt(hex.substring(2, 4), 16);
  const targetB = parseInt(hex.substring(4, 6), 16);

  // 清空预览画布（完全透明）
  ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

  let pixelCount = 0;
  const binaryData = new Array(outputWidth.value * outputHeight.value).fill(0);

  // 遍历每个像素
  for (let y = 0; y < sourceCanvas.height; y++) {
    for (let x = 0; x < sourceCanvas.width; x++) {
      const i = (y * sourceCanvas.width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 检查是否是选中的颜色（允许一定的容差）
      const tolerance = 5;
      const isMatch = Math.abs(r - targetR) <= tolerance &&
                      Math.abs(g - targetG) <= tolerance &&
                      Math.abs(b - targetB) <= tolerance;

      if (isMatch) {
        // 显示选中的像素
        ctx.fillStyle = selectedColor.hex;
        ctx.fillRect(x, y, 1, 1);
        pixelCount++;
        binaryData[y * sourceCanvas.width + x] = 1; // 标记为需要绘制
      }
    }
  }

  selectedPixelCount.value = pixelCount;
  binaryPixelData.value = binaryData;
}

// 绘制控制 - 复用斯普拉顿的绘制接口
function startDrawing() {
  if (selectedColorIndex.value < 0) {
    ElMessage.warning('请先选择一种颜色');
    return;
  }

  if (binaryPixelData.value.length === 0) {
    ElMessage.warning('当前颜色没有可绘制的像素');
    return;
  }

  currentGroupIndex.value = 0;
  isDrawing.value = true;
  isPaused.value = false;
  drawingProgress.value = 0;

  continueDrawingLoop();
}

function pauseDrawing() {
  isPaused.value = true;
  clearTimeout(drawTimer);
}

function resumeDrawing() {
  isPaused.value = false;
  continueDrawingLoop();
}

function stopDrawing() {
  clearTimeout(drawTimer);
  if (isDrawing.value || isPaused.value) {
    // 记录当前绘制进度
  }
  isDrawing.value = false;
  isPaused.value = false;
  drawingProgress.value = 0;
  ElMessage.info('绘制已停止');
}

// 绘制循环 - 复用斯普拉顿接口
async function continueDrawingLoop() {
  if (!isDrawing.value || isPaused.value) return;

  try {
    // 构造蛇形扫描的像素数据（与斯普拉顿一致）
    const snakePixelData = [];
    for (let y = 0; y < outputHeight.value; y++) {
      const isEvenRow = y % 2 === 0;
      for (let x = 0; x < outputWidth.value; x++) {
        const actualX = isEvenRow ? x : (outputWidth.value - 1 - x);
        snakePixelData.push(binaryPixelData.value[y * outputWidth.value + actualX]);
      }
    }

    // 调用斯普拉顿的绘制接口
    await api.post('/api/splatoon-graffiti/draw', {
      groupIndex: currentGroupIndex.value,
      pixelData: snakePixelData, // 蛇形扫描的二值化像素数据
      fastMode: fastMode.value,
      totalGroups: groupCount.value,
      reset: false, // 首次绘制时重置
      groupSize: snakePixelData.length, // 像素总数
      colCount: outputWidth.value,
      rowCount: outputHeight.value
    });

    currentGroupIndex.value++;
    drawingProgress.value = (currentGroupIndex.value / groupCount.value) * 100;

    if (currentGroupIndex.value >= groupCount.value) {
      isDrawing.value = false;
      isPaused.value = false;
      ElMessage.success('绘制完成！');
    } else {
      // 每组之间延迟50ms
      drawTimer = setTimeout(continueDrawingLoop, 50);
    }
  } catch (err) {
    ElMessage.error('绘制出错: ' + (err.message || '未知错误'));
    stopDrawing();
  }
}
</script>

<style scoped>
.general-image-draw-page {
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
  max-width: 1400px;
  margin: 0 auto;
}

/* 上传区域 */
.upload-section, .config-section, .preview-section, .colors-section, .drawing-section {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 30px;
  margin-bottom: 30px;
}

.upload-section h2, .config-section h2, .preview-section h2, .colors-section h2, .drawing-section h2 {
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

/* 配置区域 */
.config-controls {
  display: grid;
  grid-template-columns: repeat(3, 1fr) auto;
  gap: 20px;
  align-items: end;
}

.control-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-item label {
  color: #ddd;
  font-weight: 500;
  font-size: 0.95rem;
}

.number-input {
  padding: 10px 14px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 1rem;
  transition: all 0.3s ease;
  height: 42px;
  box-sizing: border-box;
}

.number-input:focus {
  border-color: #4f64ff;
  background: rgba(255, 255, 255, 0.12);
  outline: none;
}

.input-hint {
  font-size: 0.8rem;
  color: #6b8aff;
  margin: 0;
  margin-top: 4px;
  min-height: 20px;
}

.action-item {
  display: flex;
  align-items: flex-end;
}

.action-item .action-button {
  padding: 12px 32px;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #4f64ff 0%, #00c3ff 100%);
  color: #fff;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(79, 100, 255, 0.3);
  white-space: nowrap;
  height: 42px;
}

.action-item .action-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(79, 100, 255, 0.4);
}

.action-item .action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* 预览区域 */
.preview-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
}

.original-preview, .processed-preview {
  text-align: center;
}

.original-preview h3, .processed-preview h3 { 
  color: #fff; 
  margin-bottom: 15px; 
}

.waiting-hint {
  color: #ffa500;
  font-size: 0.9rem;
  font-weight: normal;
}

.preview-image {
  max-width: 100%;
  max-height: 300px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.preview-canvas {
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: #fff;
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}

/* 颜色展示区域 */
.colors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 15px;
}

.color-item {
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.color-item:hover {
  border-color: #4f64ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(79, 100, 255, 0.3);
}

.color-item.selected {
  border-color: #4f64ff;
  background: rgba(79, 100, 255, 0.15);
  box-shadow: 0 0 15px rgba(79, 100, 255, 0.5);
}

.color-swatch {
  width: 100%;
  height: 80px;
  border-radius: 6px;
  margin-bottom: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.color-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.color-hex {
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
}

.color-percent {
  color: #aaa;
  font-size: 0.85rem;
}

/* 像素展示区域 */
.pixel-preview-section {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 30px;
  margin-bottom: 30px;
}

.pixel-preview-section h2 {
  color: #fff;
  font-size: 1.5rem;
  margin: 0 0 20px 0;
}

.pixel-preview-container {
  display: flex;
  gap: 30px;
  align-items: flex-start;
}

.pixel-preview-canvas {
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: repeating-conic-gradient(#2a2b33 0% 25%, #1a1b23 0% 50%) 50% / 16px 16px;
  max-width: 100%;
  height: auto;
  display: block;
  flex: 1;
}

.pixel-info {
  min-width: 200px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.pixel-info p {
  color: #fff;
  margin: 12px 0;
  font-size: 1rem;
  font-weight: 500;
}

.color-badge {
  display: inline-block;
  padding: 6px 14px;
  border-radius: 6px;
  color: #fff;
  font-weight: bold;
  font-size: 0.95rem;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  margin-left: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* 绘制控制区域 */
.current-color-indicator {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  color: #fff;
  font-weight: bold;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  margin-left: 10px;
}

.drawing-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.drawing-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
  flex-wrap: wrap;
}

.action-button {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
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
  padding: 15px 30px;
  font-size: 1.1rem;
  min-width: 180px;
}

.action-button.primary {
  background: linear-gradient(90deg, #4f64ff, #00c3ff);
  color: white;
}

.action-button.primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(79, 100, 255, 0.4);
}

.action-button.secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.action-button.secondary:hover:not(:disabled) {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.15);
}

.action-button.stop {
  background: linear-gradient(90deg, #da3633, #f85149);
  color: white;
}

.action-button.stop:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(218, 54, 51, 0.4);
}

.drawing-status {
  text-align: center;
}

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

.drawing-status p {
  color: #ddd;
  font-size: 1rem;
  margin: 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .preview-container {
    grid-template-columns: 1fr;
  }

  .config-controls {
    grid-template-columns: 1fr;
  }

  .colors-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
}
</style>
