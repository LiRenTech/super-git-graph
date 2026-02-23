# Super Git Graph

这是一个基于 Tauri + React 构建的桌面应用，旨在提供一个无限大的二维平面，用于可视化查看和管理项目的 Git Graph。

## 🌟 功能特性

### 核心功能
- **无限二维平面**: 在一个无限大的画布上自由浏览 Git 提交历史。
- **自定义布局**: 支持用户自定义拖拽节点改变布局，且布局会自动持久化保存，下次打开时恢复原样。
- **多标签页支持**: 支持同时打开并管理多个项目的 Git Graph。

### 可视化展示
- **分支着色**: 不同的分支会自动以不同的颜色区分显示。
- **特殊节点标识**: Stash 节点将以双圈形式突出显示。
- **分支标签**: 分支名将以标签形式直观地指向对应的提交节点。
- **懒加载机制**: 默认仅显示最近的节点，早期节点会自动折叠。用户可以通过点击省略号（...）来加载更多历史节点。

### 实用工具
- **实时搜索**: 提供搜索框，支持输入关键词实时过滤并显示匹配结果。
- **一键刷新**: 内置刷新按钮，可随时获取当前项目的最新 Git Graph 状态。

### 分支管理
- **节点菜单**: 点击任意提交节点可弹出操作菜单，支持创建新分支、切换到该提交等操作。
- **分支操作**: 点击分支标签可进行检出、拉取、推送、删除分支等操作。
- **创建分支**: 支持在任意历史提交上创建新分支。
- **删除分支**: 支持安全删除本地分支（不能删除当前分支）。

## 🎮 操作指南

| 操作 | 描述 |
| --- | --- |
| **缩放视野** | 使用鼠标滚轮 |
| **移动视野** | 按住鼠标中键拖拽 |
| **选择节点** | 鼠标左键框选 |
| **移动节点** | 鼠标左键拖拽选中的节点 |
| **打开节点菜单** | 点击提交节点打开操作菜单 |

## 安装

### 下载安装包
1. 访问 [Releases](https://github.com/yourusername/super-git-graph/releases) 页面
2. 下载对应平台的安装包：
   - **Windows**: `super-git-graph_x64-setup.exe`
   - **macOS**: `super-git-graph_x64.dmg`
   - **Linux**: `super-git-graph_x64.AppImage`

### 从源码构建
```bash
# 克隆项目
git clone https://github.com/yourusername/super-git-graph.git
cd super-git-graph

# 安装依赖
pnpm install

# 开发模式运行
pnpm tauri dev

# 构建安装包
pnpm tauri build
```

## 开发

### 环境要求
- **Node.js** 18+ 和 **pnpm**
- **Rust** 和 **Cargo**（Tauri 依赖）
- 系统构建工具（如 Xcode Command Line Tools、Visual Studio Build Tools）

### 项目结构
```
super-git-graph/
├── src/                    # React 前端源码
├── src-tauri/             # Tauri 后端源码
│   ├── src/              # Rust 后端代码
│   ├── icons/            # 应用图标
│   └── tauri.conf.json   # Tauri 配置文件
└── package.json          # 前端依赖
```

### 技术栈
- **前端**: React + TypeScript + Vite + Tailwind CSS
- **后端**: Rust + Tauri
- **状态管理**: Zustand
- **UI 组件**: shadcn/ui
- **Git 操作**: git2-rs (libgit2 绑定)
