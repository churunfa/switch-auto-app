import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue()],
    // 开发服务器配置 - 让Vite自动选择端口（不指定port）
    server: {
      host: true
    },
    // 环境变量配置 - 确保SERVER_PORT能被前端访问（后端服务端口）
    define: {
      'import.meta.env.SERVER_PORT': JSON.stringify(env.SERVER_PORT || undefined)
    }
  }
})