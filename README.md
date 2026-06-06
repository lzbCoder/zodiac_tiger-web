# 越群山智能生活助手 - 前端

基于 Vue3 + Vite + Element Plus 的智能生活助手前端。

## 技术栈

- **框架**: Vue 3 + TypeScript
- **构建**: Vite
- **UI**: Element Plus
- **状态管理**: Pinia
- **图表**: ECharts (vue-echarts)
- **样式**: SCSS (科技霓虹风)

## 目录结构

```
tiger-web/
├── index.html
├── package.json
├── vite.config.ts
├── src/
│   ├── main.ts              # 应用入口
│   ├── App.vue              # 根组件
│   ├── router/              # 路由配置
│   ├── api/                 # API 接口层
│   ├── views/               # 7 个页面
│   ├── components/          # 公共/业务组件
│   ├── stores/              # Pinia 状态
│   ├── styles/              # 全局样式/主题
│   └── utils/               # 工具函数
```

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 访问页面
# http://localhost:5173/chat
```

## 页面路由

| 路由 | 页面 | 说明 |
|------|------|------|
| /chat | 智能聊天 | 多轮对话、流式输出、Agent 步骤可视化 |
| /template | 提示词模板 | 模板增删改查、分类管理 |
| /skill | 技能管理 | 动态技能扩展、启停控制 |
| /mcp | MCP 服务 | 外部服务配置、连接测试 |
| /task | 对话记录 | Agent 执行历史、详情查看 |
| /file | 文件资源 | 报告/行程/代码文件下载 |
| /setting | 系统设置 | 模型/缓存/日志/主题配置 |

## 构建部署

```bash
npm run build    # 生产构建，输出到 dist/
npm run preview  # 预览生产构建
```

开发时后端代理已配置在 `vite.config.ts` 中，`/api` 请求自动转发到 `http://127.0.0.1:8000`。
