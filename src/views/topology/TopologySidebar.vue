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
          :class="['combo-card', activeId === item.id ? 'active' : '']"
          @click="$emit('select', item.id)"
      >
        <div class="card-glow"></div>
        <div class="card-content">
          <div class="card-title">
            <span class="name">{{ item.combinationName }}</span>
            <button class="btn-delete-tiny" @click.stop="$emit('delete', item)">×</button>
          </div>
          <p class="desc">{{ item.desc || 'No description provided.' }}</p>
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

const props = defineProps({
  combinations: {
    type: Array,
    default: () => []
  },
  activeId: [Number, String],
  hasProject: Boolean
});

defineEmits(['select', 'delete']);

const searchQuery = ref('');

const filteredList = computed(() => {
  if (!searchQuery.value) return props.combinations;
  return props.combinations.filter(item =>
      item.combinationName.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
});
</script>

<style scoped>
.sidebar { background: #08090d; border-right: 1px solid rgba(255,255,255,0.03); display: flex; flex-direction: column; height: 100%; }
.sidebar-info { padding: 15px 20px; border-bottom: 1px solid #111; }
.label-group { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.sidebar-info .label { font-size: 0.75rem; color: #444; font-weight: bold; letter-spacing: 1px; }
.sidebar-info .count { background: #1a1a1a; color: #4f64ff; font-size: 0.7rem; padding: 2px 8px; border-radius: 10px; font-weight: bold; }

.mini-search { width: 100%; background: rgba(255,255,255,0.02); border: 1px solid #1a1a1a; border-radius: 4px; padding: 6px 10px; color: #ccc; font-size: 0.7rem; outline: none; transition: 0.3s; }
.mini-search:focus { border-color: #4f64ff; background: #000; }

.list-wrapper { flex: 1; overflow-y: auto; padding: 15px; scrollbar-width: thin; scrollbar-color: #222 transparent; }
.combo-card { position: relative; background: #0d0f17; border: 1px solid #1a1a1a; border-radius: 10px; margin-bottom: 15px; cursor: pointer; transition: 0.3s; overflow: hidden; }
.combo-card:hover { border-color: #333; transform: translateY(-2px); }
.combo-card.active { border-color: #4f64ff; background: rgba(79, 100, 255, 0.05); box-shadow: 0 10px 30px rgba(0,0,0,0.5); }

.card-glow { position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: #4f64ff; opacity: 0; transition: 0.3s; }
.combo-card.active .card-glow { opacity: 1; box-shadow: 0 0 15px #4f64ff; }

.card-content { padding: 15px; }
.card-title { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.name { font-weight: 800; color: #fff; font-size: 0.9rem; letter-spacing: 0.5px; }
.btn-delete-tiny { background: transparent; border: none; color: #333; font-size: 1.2rem; cursor: pointer; transition: 0.2s; padding: 0 5px; }
.btn-delete-tiny:hover { color: #ff4444; transform: scale(1.2); }

.desc { font-size: 0.75rem; color: #666; margin-bottom: 12px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card-footer { display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem; }
.tag { color: #4f64ff; background: rgba(79, 100, 255, 0.1); padding: 2px 8px; border-radius: 4px; font-weight: bold; }
.time { color: #333; font-family: monospace; }

.empty-list { text-align: center; padding: 40px 20px; color: #333; }
.empty-icon { font-size: 2rem; margin-bottom: 10px; opacity: 0.2; }
.empty-list p { font-size: 0.75rem; font-weight: bold; letter-spacing: 1px; }
</style>