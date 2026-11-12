# real-shenghong

> Personal technical blog and engineering knowledge base.

一个面向基础设施与 AI 系统工程的个人技术博客。

## 定位

**AI-Native Infrastructure Engineer**

构建生产级 AI 背后的基础设施、运行时与工程系统。

## 技术方向

* Kubernetes
* AI Infrastructure
* Agent Runtime
* GPU / DRA
* Linux
* Go
* Container Runtime
* Cloud Native

## 内容

博客主要记录：

* Kubernetes 与云原生基础设施
* AI Infrastructure 与 GPU 集群
* Agent / Runtime 系统设计
* Linux 与系统工程
* Go 工程实践
* 容器与运行时
* 开源项目与工程实践
* 技术研究与实践记录

## 技术栈

```text
Hugo
Go
Hugo Modules
Markdown
Podman
Ubuntu
Kubernetes
```

博客使用 **Hugo + Hugo Modules** 构建，开发环境基于 **VS Code + Podman + Ubuntu**。

## 项目结构

```text
real-shenghong/
├── .devcontainer/      # VS Code Dev Container
├── archetypes/         # Hugo content templates
├── assets/             # Assets
├── content/            # Blog content
├── data/               # Data files
├── layouts/            # Custom layouts
├── static/             # Static files
├── themes/             # Local theme overrides
├── hugo.toml           # Hugo configuration
├── go.mod              # Hugo Modules
├── go.sum              # Module checksums
└── README.md
```

## 本地开发

进入开发容器：

```bash
hugo server --bind 0.0.0.0
```

访问：

```text
http://localhost:1313
```

GitHub Actions 会在推送到 `main` 或提交 Pull Request 时自动检查 Hugo 配置并构建站点，构建结果会作为 workflow artifact 保存。

构建：

```bash
hugo
```

检查 Hugo Modules：

```bash
hugo mod graph
```

更新依赖：

```bash
hugo mod get -u
hugo mod tidy
```

## 内容创作

### 新建文章

文章放在 `content/articles/<分类目录>/` 下，文件名形如 `my-post.zh.md`（中文）与 `my-post.en.md`（英文），两种语言必须同名。

```yaml
---
title: "Go 里那些设计模式，其实都不太像设计模式"
date: 2026-11-12
description: "列表页显示的一句话摘要"
location: "Shanghai"
tcf: "Go"
cover:
  image: "images/02.jpg"
---
```

| 字段 | 说明 |
|------|------|
| `title` | 文章标题，列表页与详情页大标题 |
| `date` | 发布日期，决定列表排序与「最新优先」 |
| `description` | 卡片摘要，超过一行会自动截断 |
| `tcf` | 文章主题标签（The Core Focus），显示为紫色胶囊 |
| `location` | 地点标签，显示为绿色胶囊 |
| `cover.image` | 封面图，填 `assets/images/` 下的资源路径，构建时自动裁成 16:6 |

**分类**：目录名决定所属分类，无需在 front matter 里写 `categories`。新增分类时创建对应目录并添加 `_index.zh.md`：

```yaml
---
title: "语言与工具"
description: "Go、Linux 与日常工具链"
---
```

分类在列表页左栏的显示顺序由 [list.html](file:///Users/ssh/workspace/github.com/blogio/layouts/articles/list.html#L18) 的 `$catOrder` 控制，未列出的分类自动排在最后。

**封面图**：推荐用脚本下载并压缩：

```bash
./scripts/fetch-cover.sh <图片URL> 02
```

生成的文件落在 `assets/images/`，模板通过 `resources.Get` 读取，压缩后的资源不会进入 Git。

**英文缺失**：只写中文版即可。英文站会按分类自动回退到中文文章，列表不会出现空缺，但页面内容为中文。

### 新建教程系列

教程是「多篇 + 系列首页」的形态，放在 `content/series/<slug>/`：

```text
content/series/kubernetes-tutorial/
├── _index.zh.md              # 系列首页
├── part-i.zh.md              # 分篇
├── part-ii.zh.md
└── part-iii.zh.md
```

**系列首页** `_index.zh.md`：

```yaml
---
title: "Kubernetes 教程"
description: "从核心抽象到生产实践的完整 K8s 学习路径"
layout: "kubernetes-tutorial"
cascade:
  layout: "kubernetes-tutorial"
stackGroup: "云原生"
---
```

`cascade` 会把 `layout` 下发到该目录下所有分篇，因此分篇只需要写自己的 `title` 和 `date`：

```yaml
---
title: "Part I · 云原生基础与核心抽象"
date: 2026-11-09
layout: "kubernetes-tutorial-part"
sustain: true
---
```

| 字段 | 说明 |
|------|------|
| `layout` | 系列专用模板：首页用 `kubernetes-tutorial`，分篇用 `kubernetes-tutorial-part` |
| `cascade` | 自动继承给所有子页面，避免每篇重复声明 |
| `sustain` | 分篇标记，表示内容处于持续更新状态 |

**系列与导航的关联**：在 `data/blog_links.yaml` 添加条目，导航与 `/categories/` 分类图会自动发现：

```yaml
- title:
    en: "Kubernetes Tutorial"
    zh: "Kubernetes 教程"
  icon: "kubernetes"
  url: "/series/kubernetes-tutorial/"
  category: "cloud-native"
```

然后在文章 front matter 中加 `series: kubernetes-tutorial`，文章会自动挂到该系列节点下。详见下方[神经网络分类关系图](#神经网络分类关系图)。

### 本地预览与检查

```bash
hugo server --bind 0.0.0.0   # 本地预览 http://localhost:1313
hugo --gc --minify            # 构建，会同时报出模板与资源错误
```

## 设计原则

### 简洁

保持内容优先，减少不必要的视觉元素和复杂动画。

### 技术

以真实工程实践为核心，记录问题、设计、实现与验证过程。

### 长期

博客不仅用于发布文章，也作为个人长期技术知识库与工程记录。

### 开源

公开可分享的技术实践、工具和开源项目。

## Roadmap

* [x] Hugo 基础环境
* [x] Hugo Modules
* [x] Podman + Ubuntu 开发环境
* [x] VS Code Dev Container
* [ ] 个人主页
* [ ] 技术方向展示
* [ ] 精选项目
* [ ] 博客文章系统
* [ ] About 页面
* [ ] RSS
* [ ] Sitemap
* [ ] SEO
* [ ] 深色 / 浅色模式
* [ ] GitHub Pages / CI 自动部署

## License

Content and code are provided for personal and educational purposes unless otherwise specified.

---

## 神经网络分类关系图

`/categories/` 页面展示一个以 **shenghong** 为核心的三级力导向神经网络图，动态反映博客的分类、系列与文章之间的关联关系。

> 写文章、建系列的基础规范见上方[内容创作](#内容创作)，本节只说明这张图的数据与连线逻辑。

### 体系架构

```
                    Center (shenghong)
                   /      |      \      \
                  /       |       \      \
          Category   Category   Category  Resources
          /  |  \      / | \       |         \
         /   |   \    /  |  \      |          \
     Title Title Title Title Title Title     Title
       |            |       |
     Post         Post    Post ...
```

**四层节点：**

| 层级 | group 值 | 节点大小 | 颜色 | 说明 |
|------|----------|---------|------|------|
| 中心 | `center` | 28px | 金色 `#f0a040` | 固定画布中央，不可拖拽 |
| 分类 | 数字 `"1"`~`"8"` | 按文章数动态 | 分区色 | 来自 Hugo Taxonomy categories |
| 系列标题 | `title` | 10px | 继承父分类色 | 来自 `data/blog_links.yaml` |
| 文章 | `post` | 6px | 继承父分类色 | 来自 `content/posts/` |

### 数据来源

| 节点类型 | 数据源 | 生成方式 |
|----------|--------|---------|
| 中心 | 硬编码 | `id: "shenghong"`，固定在模板中 |
| 分类 | `.Site.Taxonomies.categories` | 遍历 Hugo 分类 taxonomy，自动生成 |
| Resources | 手动定义 | 不在 taxonomy 中，模板中单独添加（`id: "resources"`） |
| 系列标题 | `data/blog_links.yaml` | 遍历 `hugo.Data.blog_links`，自动生成 |
| 文章 | `.Site.RegularPages` (section `posts`) | 遍历所有已发布文章，自动生成 |

### 连线逻辑

| 连线 | source → target | 生成规则 |
|------|----------------|---------|
| 中心 → 分类 | `shenghong` → 每个 category | 固定，每个分类一条（含 resources） |
| 分类 → 系列标题 | category → title | 按 `blog_links.yaml` 中的 `category` 字段匹配 |
| 系列标题 → 文章 | title → post | 基于文章 front matter 的 `series` 字段精确匹配 |
| 分类共现 | category ↔ category | 分类在同一篇文章中共现的次数（原有逻辑） |

### 文章与系列标题的精确关联（series 字段）

每篇文章的 front matter 需要指定 `series` 字段：

```yaml
# content/posts/your-post.en.md
---
title: "Your Post Title"
categories:
  - cloud-native
series: kubernetes-tutorial   # 关联到 blog_links.yaml 中的对应标题
---
```

**匹配规则：**

1. 从 `blog_links.yaml` 中每个条目的 `url` 或 `title.en` 推导出 `slug`：
   - URL 是 `/series/xxx/` → slug = `xxx`
   - URL 是 `/posts/` → slug = `title.en` 的小写 + 空格转连字符
2. 文章的 `series` 字段与 title 的 `slug` 精确匹配后建立连线

**示例：**

| 文章 series 值 | 匹配到的 blog_links 标题 | 推导方式 |
|---------------|------------------------|---------|
| `ai-agent-building-guide` | AI Agent Building Guide | url `/series/ai-agent-building-guide/` → slug = `ai-agent-building-guide` |
| `kubernetes-tutorial` | Kubernetes Tutorial | url `/posts/` → slug = `"kubernetes tutorial".lower()` → `kubernetes-tutorial` |
| `service-mesh-intro` | Service Mesh Introduction | url `/series/service-mesh-intro/` → slug = `service-mesh-intro` |

### 自动识别机制

**新增系列标题：** 只需在 `data/blog_links.yaml` 中添加条目，无需修改任何模板代码：

```yaml
- title:
    en: "New Series"
    zh: "新系列"
  icon: "cpu"
  url: "/series/new-series/"
  category: "ai-engineering"
```

模板自动遍历 `hugo.Data.blog_links`，新增条目自动生成 title 节点和 category→title 连线。

**新增文章：** 只需在文章 front matter 中添加 `series` 字段：

```yaml
series: new-series   # 对应 blog_links.yaml 中推导出的 slug
```

模板自动遍历 `.Site.RegularPages`，新文章自动生成 post 节点和 title→post 连线。

### 技术实现

**模板文件：** `layouts/categories/list.html`

**可视化库：** D3.js v7（CDN 加载）

**关键 JS 函数：**

| 函数 | 作用 |
|------|------|
| `getNodeGroup(d)` | 获取节点的实际颜色组（title/post 继承父分类） |
| `getNodeColor(d)` | 获取节点颜色（center 返回金色） |
| `nodeRadius(d)` | 根据节点类型返回不同半径 |
| `highlightNode(d)` | 悬停高亮：当前节点+邻居高亮，其余暗淡 |
| `resetHighlight()` | 恢复所有节点和连线到默认状态 |

**力模拟参数（按层级不同）：**

| 层级 | 连线距离 | 电荷斥力 |
|------|---------|---------|
| center → category | 200px | -600 |
| category → title | 120px | -280 |
| title → post | 80px | -150 / -80 |

**交互：**
- 拖拽节点（中心节点除外）
- 点击节点跳转到对应页面
- 悬停高亮关联节点和连线
- 滚轮缩放、拖拽平移
- R 键重置视图

### 维护指南

**新增系列：**
1. 编辑 `data/blog_links.yaml`，在对应 category 下添加条目
2. （可选）创建 `content/series/<slug>/_index.en.md` 和 `_index.zh.md`
3. 更新 `layouts/partials/icon.html` 添加新图标（如需要）

**新增文章并关联到系列：**
1. 在文章 front matter 中设置 `categories`（至少一个）
2. 在文章 front matter 中设置 `series`（对应 blog_links 中某条目的 slug）
3. 文章自动出现在图中，并连线到对应系列标题

**新增图标：**
1. 在 `layouts/partials/icon.html` 中添加 `else if eq $name "新图标名"` 分支
2. 在 `data/blog_links.yaml` 对应条目中设置 `icon: "新图标名"`