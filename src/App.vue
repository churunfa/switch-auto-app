<template>
  <div class="app-layout">
    <nav class="side-nav">
      <div class="nav-logo">SWITCH BOT</div>
      <router-link to="/base" class="nav-item">
        <span class="nav-icon">⌨️</span> 基础按键
      </router-link>
      <router-link to="/topology" class="nav-item">
        <span class="nav-icon">🕸️</span> 拓扑图配置
      </router-link>
      <router-link to="/yolo" class="nav-item">
        <span class="nav-icon">👁️</span> YOLO 识别
      </router-link>
    </nav>

    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<style>
/* 核心修复：确保 HTML 和 Body 不产生滚动条 */
html, body {
  margin: 0;
  padding: 0;
  background-color: #0a0b10;
  font-family: sans-serif;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

/* 布局容器锁定高度为视口高度 */
.app-layout {
  display: flex;
  height: 100vh; /* 必须是固定高度，不能是 min-height */
  width: 100vw;
  overflow: hidden;
}

.side-nav {
  width: 240px;
  background: #11141d;
  border-right: 1px solid #222;
  display: flex;
  flex-direction: column;
  padding: 20px 0;
  flex-shrink: 0; /* 防止侧边栏被内容挤扁 */
}

.nav-logo {
  padding: 0 25px 30px;
  font-size: 1.5rem;
  font-weight: bold;
  color: #4f64ff;
  letter-spacing: 2px;
}

.nav-item {
  padding: 15px 25px;
  color: #888;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.3s;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.router-link-active {
  color: #fff;
  background: rgba(79, 100, 255, 0.15);
  border-right: 4px solid #4f64ff;
}

/* 核心修复：主内容区域独立滚动 */
.main-content {
  flex: 1;
  min-width: 0; /* 允许 flex 项目正常缩小 */
  height: 100%;
  overflow: hidden; /* 由内部组件 BaseOperate.vue 自己控制滚动 */
}
</style>