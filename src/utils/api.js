/**
 * API 配置文件
 * 提供统一的 API 端点管理
 */

// 获取 API 基础端点
export function getApiEndpoint(path) {
    // 优先从 SERVER_PORT 环境变量获取后端端口，如果没有则使用默认值 8080
    const serverPort = import.meta.env.SERVER_PORT || '8080';
    const apiUrl = `http://localhost:${serverPort}`;
    
    console.log('[API Debug] serverPort:', serverPort);
    console.log('[API Debug] apiUrl:', apiUrl);
    console.log('[API Debug] path:', path);
    
    // 如果提供了路径，则返回完整URL
    if (path) {
        // 如果路径已经是完整URL，则直接返回
        if (path.startsWith('http')) {
            console.log('[API Debug] 返回完整URL:', path);
            return path;
        }
        
        // 路径映射表 - 将简写映射到实际的API路径
        const pathMap = {
            'BASE_OPERATE': '/api/base-operate/all-base-operates',
            'COMBINATION_GRAPH': '/api/combination-graph',
            'COMBINATION_GRAPH_EXEC': '/api/combination-graph/exec',
            'BUTTON_BINDING': '/api/button-binding',
            'SPLATOON_GRAFFITI': '/api/splatoon-graffiti/draw'
        };
        
        let normalizedPath;
        if (pathMap[path]) {
            // 使用映射表中的路径
            normalizedPath = pathMap[path];
        } else if (path.startsWith('/')) {
            // 已经是绝对路径
            normalizedPath = path;
        } else {
            // 其他情况，添加 /api/ 前缀
            normalizedPath = `/api/${path}`;
        }
        
        const result = `${apiUrl}${normalizedPath}`;
        console.log('[API Debug] 拼接结果:', result);
        return result;
    }
    
    // 如果没有提供路径，返回基础URL
    console.log('[API Debug] 返回基础URL:', apiUrl);
    return apiUrl;
}

// 获取完整的 API URL
export function getFullApiUrl(path) {
    const baseUrl = getApiEndpoint();
    // 确保路径以 / 开头
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
}

// 基础的 fetch 封装
export async function apiRequest(path, options = {}) {
    const url = getFullApiUrl(path);
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };
    
    try {
        const response = await fetch(url, defaultOptions);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// 常用的 CRUD 操作封装
export const api = {
    // GET 请求
    get: (path, options) => apiRequest(path, { method: 'GET', ...options }),
    
    // POST 请求
    post: (path, data, options) => apiRequest(path, {
        method: 'POST',
        body: JSON.stringify(data),
        ...options
    }),
    
    // PUT 请求
    put: (path, data, options) => apiRequest(path, {
        method: 'PUT',
        body: JSON.stringify(data),
        ...options
    }),
    
    // DELETE 请求
    delete: (path, options) => apiRequest(path, { method: 'DELETE', ...options })
};

export default {
    getApiEndpoint,
    getFullApiUrl,
    apiRequest,
    api
};

// 测试代码（开发环境）
if (import.meta.env.DEV) {
    console.log('API Endpoint Tests:');
    console.log('SERVER_PORT:', import.meta.env.SERVER_PORT);
    console.log('getApiEndpoint():', getApiEndpoint());
    console.log('getApiEndpoint("BASE_OPERATE"):', getApiEndpoint('BASE_OPERATE'));
    console.log('getApiEndpoint("COMBINATION_GRAPH_EXEC"):', getApiEndpoint('COMBINATION_GRAPH_EXEC'));
    console.log('getApiEndpoint("/custom/path"):', getApiEndpoint('/custom/path'));
}