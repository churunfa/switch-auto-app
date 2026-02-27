<template>
  <div class="splatoon-graffiti-page">
    <div class="page-header">
      <h1>🎨 斯普拉遁涂鸦绘制</h1>
      <p class="page-description">上传图片自动转换为320×120单色位图并分组绘制</p>
    </div>

    <div class="content-area">
      <div class="upload-section">
        <h2>📤 图片上传与处理</h2>
        <div class="upload-container">
          <div class="drop-zone" @dragover.prevent="handleDragOver" @drop.prevent="handleDrop" @click="triggerFileInput">
            <input type="file" ref="fileInput" @change="handleFileSelect" accept="image/*" style="display: none;" />
            <div class="upload-icon">📁</div>
            <p>拖拽图片到这里或点击选择文件</p>
            <p class="upload-hint">支持 JPG、PNG、GIF 等格式</p>
          </div>
        </div>
      </div>

      <div v-if="originalImage" class="preview-section">
        <h2>🖼️ 图片预览与处理</h2>
        <div class="preview-container">
          <div class="image-preview">
            <h3>原始图片</h3>
            <img :src="originalImage" alt="原始图片" class="preview-image" />
          </div>
          <div class="processed-preview">
            <h3>处理后图像 (320×120)</h3>
            <canvas ref="processedCanvas" width="320" height="120" class="preview-canvas"></canvas>
            <div class="processing-info">
              <p>尺寸: 320 × 120</p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="bitmapData.length > 0" class="grouping-section">
        <h2>⚙️ 配置选项</h2>
        <div class="grouping-controls">
          <div class="control-item">
            <label>绘制模式:</label>
            <div class="mode-switch-wrapper">
              <input type="checkbox" id="fastMode" v-model="fastMode" class="checkbox-input" />
              <label for="fastMode" class="checkbox-label">快速绘制 (精准度有限)</label>
            </div>
          </div>

          <div class="control-item" :class="{ 'disabled-opacity': fastMode }">
            <label>分组数量:</label>
            <input
                type="range"
                min="1"
                max="320"
                v-model.number="groupCount"
                class="slider"
                :disabled="fastMode"
            />
            <span class="value-display">{{ groupCount }} 组</span>
            <p v-if="fastMode" class="input-hint">快速模式下分组已锁定为 1</p>
          </div>

          <div class="control-item">
            <label>每组像素数:</label>
            <span class="value-display">{{ pixelsPerGroup }} 像素/组</span>
          </div>
        </div>
      </div>

      <div v-if="groupedData.length > 0" class="drawing-section">
        <h2>🎮 绘制控制</h2>
        <div class="drawing-panel-wrapper">
          <div class="action-area">
            <div v-if="!isDrawing && !isPaused" class="initial-start-options">
              <div class="start-option">
                <button @click="startDrawingFromBeginning" class="action-button primary large">🎯 直接开始绘制</button>
                <p class="option-desc">从第1组开始完整绘制</p>
              </div>
              <div class="start-option separator" v-if="!fastMode">或</div>
              <div class="start-option" v-if="!fastMode">
                <div class="goto-input-group">
                  <label>从第</label>
                  <input type="number" v-model.number="gotoGroupIndex" min="1" :max="groupCount" class="goto-input-small" />
                  <label>组开始绘制</label>
                </div>
                <button @click="startDrawingFromGroup" :disabled="gotoGroupIndex < 1 || gotoGroupIndex > groupCount" class="action-button goto large">🎯 从指定组开始</button>
              </div>
            </div>
            <div v-else class="drawing-controls">
              <button v-if="isDrawing && !isPaused" @click="pauseDrawing" class="action-button secondary large">⏸️ 暂停绘制</button>
              <button v-else-if="isPaused" @click="resumeDrawing" class="action-button primary large">▶️ 继续绘制</button>
              <button @click="stopDrawing" class="action-button stop">⏹️ 停止绘制</button>
            </div>
          </div>

          <div class="status-area">
            <div class="drawing-progress" v-if="isDrawing || isPaused">
              <div class="progress-bar"><div class="progress-fill" :style="{ width: `${drawingProgress}%` }"></div></div>
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
                  <p class="completion-stats">完成 {{ Math.round((lastDrawnGroup + 1) * 100 / groupCount) }}%</p>
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

const fileInput = ref(null);
const originalImage = ref(null);
const processedCanvas = ref(null);
const bitmapData = ref([]);
const groupCount = ref(320);
const fastMode = ref(false);
const isLocalProcess = ref(false);

const isDrawing = ref(false);
const isPaused = ref(false);
const currentGroupIndex = ref(0);
const lastDrawnGroup = ref(-2);
const gotoGroupIndex = ref(1);
const drawingProgress = ref(0);
const isDrawingFromSpecificGroup = ref(false);
let drawTimer = null;

// --- 核心逻辑：快速模式与分组联动 ---
watch(fastMode, (newVal) => {
  if (newVal) {
    groupCount.value = 1; // 开启快速模式，分组强行归 1
  } else {
    groupCount.value = 320; // 关闭快速模式，恢复默认分组
  }
  currentGroupIndex.value = 0;
  lastDrawnGroup.value = -2;
}, { immediate: true });

const pixelsPerGroup = computed(() => {
  if (groupCount.value <= 0) return 0;
  return Math.floor(38400 / groupCount.value);
});

const groupedData = computed(() => {
  if (!bitmapData.value.length) return [];
  const snakeData = [];
  for (let y = 0; y < 120; y++) {
    const isEvenRow = y % 2 === 0;
    for (let x = 0; x < 320; x++) {
      const actualX = isEvenRow ? x : (319 - x);
      snakeData.push(bitmapData.value[y * 320 + actualX]);
    }
  }
  return Array.from({ length: groupCount.value }, (_, i) =>
      snakeData.slice(i * pixelsPerGroup.value, i === groupCount.value - 1 ? 38400 : (i + 1) * pixelsPerGroup.value)
  );
});

function triggerFileInput() { fileInput.value.click(); }
function handleDragOver(e) { e.currentTarget.classList.add('drag-over'); }
function handleDrop(e) { e.currentTarget.classList.remove('drag-over'); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); }
function handleFileSelect(e) { if (e.target.files[0]) processFile(e.target.files[0]); }

async function processFile(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    originalImage.value = e.target.result;
    const img = new Image();
    img.src = originalImage.value;
    await img.decode();

    let useRaw = false;
    let rawData = [];
    if (img.width === 320 && img.height === 120) {
      const cvs = document.createElement('canvas');
      cvs.width = 320; cvs.height = 120;
      const ctx = cvs.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, 320, 120).data;
      for (let i = 0; i < px.length; i += 4) {
        const avg = (px[i] + px[i+1] + px[i+2]) / 3;
        rawData.push(avg < 128 ? 1 : 0);
      }
      useRaw = true;
    }

    try {
      if (useRaw) {
        bitmapData.value = rawData;
        isLocalProcess.value = true;
        ElMessage.success('本地转换成功');
      } else {
        isLocalProcess.value = false;
        const blob = await fetch(originalImage.value).then(r => r.blob());
        const formData = new FormData();
        formData.append('file', new File([blob], 'img.jpg'));
        const res = await api.post('/api/splatoon-graffiti/img/process', formData);
        bitmapData.value = Array.from(atob(res.data), c => c.charCodeAt(0));
      }
      drawCanvas();
    } catch (err) { ElMessage.error('图片处理失败'); }
  };
  reader.readAsDataURL(file);
}

function drawCanvas() {
  const ctx = processedCanvas.value.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 320, 120);
  ctx.fillStyle = '#000';
  bitmapData.value.forEach((p, i) => p && ctx.fillRect(i % 320, Math.floor(i / 320), 1, 1));
}

function startDrawingFromBeginning() {
  lastDrawnGroup.value = -2;
  currentGroupIndex.value = 0;
  isDrawing.value = true;
  isPaused.value = false;
  isDrawingFromSpecificGroup.value = false;
  continueDrawingLoop();
}

function startDrawingFromGroup() {
  lastDrawnGroup.value = -2;
  currentGroupIndex.value = gotoGroupIndex.value - 1;
  isDrawing.value = true;
  isPaused.value = false;
  isDrawingFromSpecificGroup.value = true;
  continueDrawingLoop();
}

const pauseDrawing = () => isPaused.value = true;
const resumeDrawing = () => { isPaused.value = false; continueDrawingLoop(); };

function stopDrawing() {
  clearTimeout(drawTimer);
  if (isDrawing.value || isPaused.value) {
    lastDrawnGroup.value = currentGroupIndex.value - 1;
  }
  isDrawing.value = isPaused.value = false;
  drawingProgress.value = 0;
}

async function continueDrawingLoop() {
  if (!isDrawing.value || isPaused.value) return;

  try {
    await api.post('/api/splatoon-graffiti/draw', {
      groupIndex: currentGroupIndex.value,
      pixelData: groupedData.value[currentGroupIndex.value],
      fastMode: fastMode.value,
      totalGroups: groupCount.value,
      reset: currentGroupIndex.value === 0 || (isDrawingFromSpecificGroup.value && currentGroupIndex.value === gotoGroupIndex.value - 1),
      groupSize: pixelsPerGroup.value, colCount: 320, rowCount: 120
    });

    currentGroupIndex.value++;
    drawingProgress.value = (currentGroupIndex.value / groupCount.value) * 100;

    if (currentGroupIndex.value >= groupCount.value) {
      lastDrawnGroup.value = groupCount.value - 1;
      isDrawing.value = isPaused.value = false;
      ElMessage.success('绘制完成！');
    } else {
      drawTimer = setTimeout(continueDrawingLoop, fastMode.value ? 5 : 50);
    }
  } catch (err) {
    ElMessage.error('绘制出错');
    stopDrawing();
  }
}

watch(groupCount, () => {
  if (!isDrawing.value) {
    currentGroupIndex.value = 0;
    lastDrawnGroup.value = -2;
  }
});
</script>

<style scoped>
/* 保持所有原始样式不变 */
.splatoon-graffiti-page { padding: 30px; height: 100%; overflow-y: auto; background: linear-gradient(135deg, #0a0b10 0%, #121520 100%); }
.page-header { margin-bottom: 40px; text-align: center; }
.page-header h1 { color: #fff; font-size: 2.5rem; margin-bottom: 10px; background: linear-gradient(90deg, #4f64ff, #00c3ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.page-description { color: #aaa; font-size: 1.1rem; margin: 0; }
.content-area { max-width: 1200px; margin: 0 auto; }
.upload-section, .preview-section, .grouping-section, .drawing-section { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 30px; margin-bottom: 40px; min-height: 220px; }
.upload-section h2, .preview-section h2, .grouping-section h2, .drawing-section h2 { color: #fff; font-size: 1.8rem; margin: 0 0 25px 0; }
.drop-zone { border: 2px dashed rgba(255, 255, 255, 0.3); border-radius: 12px; padding: 40px; text-align: center; cursor: pointer; transition: all 0.3s ease; }
.drop-zone:hover, .drop-zone.drag-over { border-color: #4f64ff; background: rgba(79, 100, 255, 0.1); }
.upload-icon { font-size: 3rem; margin-bottom: 15px; }
.drop-zone p { color: #ddd; margin: 10px 0; }
.upload-hint { color: #888 !important; font-size: 0.9rem; }
.preview-container { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
.image-preview, .processed-preview { text-align: center; }
.image-preview h3, .processed-preview h3 { color: #fff; margin-bottom: 15px; }
.preview-image { max-width: 100%; max-height: 200px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); }
.preview-canvas { border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; background: #000; image-rendering: pixelated; }
.processing-info { margin-top: 15px; color: #aaa; font-size: 0.9rem; }
.grouping-controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
.control-item { display: flex; flex-direction: column; gap: 10px; }
.control-item label { color: #ddd; font-weight: 500; }

.mode-switch-wrapper { display: flex; align-items: center; gap: 10px; padding: 10px 0; }
.checkbox-input { width: 18px; height: 18px; cursor: pointer; accent-color: #4f64ff; }
.checkbox-label { color: #ddd; font-size: 0.95rem; cursor: pointer; font-weight: bold; }

.slider { -webkit-appearance: none; width: 100%; height: 8px; border-radius: 4px; background: rgba(255, 255, 255, 0.1); outline: none; }
.slider:disabled { opacity: 0.3; cursor: not-allowed; }
.disabled-opacity { opacity: 0.5; }
.input-hint { font-size: 0.8rem; color: #4f64ff; margin: 0; }

.slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #4f64ff; cursor: pointer; transition: all 0.2s ease; }
.value-display { color: #4f64ff; font-weight: 600; text-align: center; }
.initial-start-options { display: flex; align-items: center; justify-content: center; gap: 30px; flex-wrap: wrap; margin-bottom: 30px; padding: 20px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; }
.start-option { display: flex; flex-direction: column; align-items: center; gap: 15px; min-width: 200px; }
.start-option.separator { color: #888; font-size: 1.2rem; font-weight: bold; min-width: auto; }
.option-desc { color: #aaa; font-size: 0.9rem; text-align: center; margin: 0; }
.goto-input-group { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
.goto-input-small { padding: 8px 12px; border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 6px; background: rgba(255, 255, 255, 0.1); color: #fff; width: 60px; text-align: center; }
.drawing-controls { display: flex; gap: 20px; justify-content: center; margin-bottom: 30px; flex-wrap: wrap; }
.action-button { padding: 15px 30px; border: none; border-radius: 10px; font-size: 1.1rem; font-weight: 600; cursor: pointer; transition: all 0.3s ease; min-width: 150px; display: flex; align-items: center; justify-content: center; gap: 8px; }
.action-button:disabled { opacity: 0.5; cursor: not-allowed; }
.action-button.large { padding: 18px 35px; font-size: 1.2rem; min-width: 200px; }
.action-button.primary { background: linear-gradient(90deg, #4f64ff, #00c3ff); color: white; }
.action-button.secondary { background: rgba(255, 255, 255, 0.1); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); }
.action-button.stop { background: linear-gradient(90deg, #da3633, #f85149); color: white; }
.action-button.goto { background: linear-gradient(90deg, #6a5acd, #9370db); color: white; }
.progress-bar { width: 100%; height: 12px; background: rgba(255, 255, 255, 0.1); border-radius: 6px; overflow: hidden; margin-bottom: 15px; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #4f64ff, #00c3ff); border-radius: 6px; transition: width 0.3s ease; }
.drawing-progress p { color: #ddd; text-align: center; margin: 0; font-size: 1.1rem; }
.completion-card { display: flex; align-items: center; gap: 16px; padding: 20px; background: rgba(79, 100, 255, 0.1); border-radius: 12px; border-left: 4px solid #4f64ff; transition: all 0.3s ease; }
.completion-card.partial { background: rgba(255, 193, 7, 0.1); border-left-color: #ffc107; }
.drawing-panel-wrapper { display: flex; flex-direction: column; gap: 20px; }
.action-area { min-height: 130px; display: flex; align-items: center; justify-content: center; width: 100%; }
.status-area { min-height: 110px; display: flex; flex-direction: column; justify-content: center; width: 100%; }
</style>