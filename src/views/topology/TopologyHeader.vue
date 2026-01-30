<template>
  <header class="glass-header">
    <div class="brand">
      <span class="logo-icon">🕸️</span>
      <div class="brand-text">
        <h2>TOPOLOGY CONFIG</h2>
        <span class="version">V2.1 PRO</span>
      </div>
    </div>

    <div class="project-area">
      <div class="selector-container">
        <label>PROJECT</label>
        <div class="custom-dropdown" v-click-outside="() => showProjectDrop = false">
          <div class="dropdown-trigger" @click="showProjectDrop = !showProjectDrop">
            <span class="selected-text">{{ modelValue || 'SELECT PROJECT' }}</span>
            <span class="select-arrow" :class="{ open: showProjectDrop }"></span>
          </div>

          <transition name="slide-up">
            <ul v-if="showProjectDrop" class="dropdown-menu">
              <li
                  v-for="p in projects"
                  :key="p"
                  :class="{ active: p === modelValue }"
                  @click="selectProject(p)"
              >
                {{ p }}
              </li>
            </ul>
          </transition>
        </div>

        <button class="btn-icon-refresh" @click="$emit('refresh')" :class="{ rotating: loading }">
          <span class="icon">🔄</span>
        </button>
      </div>
      <button class="btn-neon-create" @click="$emit('create')">
        <span class="plus">+</span> NEW GRAPH
      </button>
    </div>
  </header>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  projects: Array,
  modelValue: String, // 对应父组件的 currentProject
  loading: Boolean
});

const emit = defineEmits(['update:modelValue', 'refresh', 'create', 'change']);

const showProjectDrop = ref(false);

const selectProject = (p) => {
  emit('update:modelValue', p);
  emit('change', p);
  showProjectDrop.value = false;
};

// 点击外部关闭指令（建议定义在全局或工具类中，这里为组件内局部演示）
const vClickOutside = {
  mounted(el, binding) {
    el.clickOutsideEvent = (event) => {
      if (!(el === event.target || el.contains(event.target))) binding.value();
    };
    document.addEventListener("click", el.clickOutsideEvent);
  },
  unmounted(el) {
    document.removeEventListener("click", el.clickOutsideEvent);
  }
};
</script>

<style scoped>
/* 仅保留 header 相关的赛博朋克样式 */
.glass-header { height: 70px; background: rgba(13, 15, 23, 0.85); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255, 255, 255, 0.03); display: flex; justify-content: space-between; align-items: center; padding: 0 30px; z-index: 100; }
.brand { display: flex; align-items: center; gap: 15px; }
.logo-icon { font-size: 2rem; filter: drop-shadow(0 0 10px #4f64ff); }
.brand-text h2 { margin: 0; font-size: 1.1rem; letter-spacing: 2px; color: #4f64ff; font-weight: 900; }
.version { font-size: 0.6rem; color: #444; font-weight: bold; }
.project-area { display: flex; align-items: center; gap: 15px; }
.selector-container { display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.6); padding: 5px 12px; border-radius: 8px; border: 1px solid #1a1a1a; }
.selector-container label { font-size: 0.65rem; color: #555; font-weight: bold; }
.custom-dropdown { position: relative; min-width: 140px; user-select: none; }
.dropdown-trigger { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(0, 255, 136, 0.2); color: #00ff88; padding: 8px 16px; border-radius: 20px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 0.8rem; transition: all 0.3s ease; }
.dropdown-trigger:hover { background: rgba(0, 255, 136, 0.08); border-color: rgba(0, 255, 136, 0.5); }
.select-arrow { width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #00ff88; transition: 0.3s; }
.select-arrow.open { transform: rotate(180deg); }
.dropdown-menu { position: absolute; top: calc(100% + 10px); left: 0; width: 100%; background: rgba(15, 18, 26, 0.98); backdrop-filter: blur(25px); border: 1px solid rgba(0, 255, 136, 0.3); border-radius: 12px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.8); padding: 6px; list-style: none; z-index: 1000; margin: 0; }
.dropdown-menu li { padding: 10px 16px; color: #a0a0a0; font-size: 0.8rem; cursor: pointer; border-radius: 8px; transition: all 0.2s ease; }
.dropdown-menu li:hover { background: rgba(255, 255, 255, 0.05); color: #00ff88; }
.dropdown-menu li.active { background: rgba(0, 255, 136, 0.12); color: #00ff88; font-weight: bold; }
.btn-icon-refresh { background: transparent; border: none; color: #444; cursor: pointer; transition: 0.3s; }
.btn-icon-refresh:hover { color: #4f64ff; }
.btn-neon-create { background: #4f64ff; color: #fff; border: none; padding: 10px 20px; border-radius: 20px; font-weight: 800; font-size: 0.75rem; cursor: pointer; transition: 0.3s; }
.btn-neon-create:hover { background: #6375ff; box-shadow: 0 0 20px rgba(79, 100, 255, 0.4); }
.rotating { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.25s ease-out; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(-8px) scale(0.98); }
</style>