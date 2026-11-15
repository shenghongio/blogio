# ShengHong | StackTrace

<p>
  <a href="https://shenghongio.github.io/blogio/"><img alt="站点" src="https://img.shields.io/badge/site-online-1c8a6a?style=flat-square&logo=githubpages&logoColor=white"></a>
  <a href="https://github.com/shenghongio/blogio/actions/workflows/build.yml"><img alt="构建状态" src="https://img.shields.io/github/actions/workflow/status/shenghongio/blogio/build.yml?style=flat-square&logo=githubactions&logoColor=white&label=build"></a>
  <img alt="Hugo" src="https://img.shields.io/badge/Hugo-0.169.0-ff4088?style=flat-square&logo=hugo&logoColor=white">
  <img alt="Go" src="https://img.shields.io/badge/Go-1.22-00add8?style=flat-square&logo=go&logoColor=white">
  <img alt="GitHub Pages" src="https://img.shields.io/badge/deploy-GitHub%20Pages-222222?style=flat-square&logo=github&logoColor=white">
  <img alt="许可" src="https://img.shields.io/badge/license-MIT%20%2B%20CC%20BY--NC--SA%204.0-f0a040?style=flat-square&logo=creativecommons&logoColor=white">
</p>

> 面向 AI Infrastructure 与云原生系统工程的个人技术博客，同时作为长期可检索的工程知识库。

站点地址：https://shenghongio.github.io/blogio/

## 目的

这个仓库解决三个问题：

1. **沉淀** —— 把工程实践中遇到的问题、设计取舍、验证结论记录下来，而不是停留在聊天记录里。
2. **可检索** —— 内容按「分类 → 系列 → 文章」三层组织，配合本地构建的全文搜索，随时能找回过去的技术判断。
3. **可复用** —— 写下来的方案要能直接被下一次工程决策引用，而不是写完即弃的教程搬运。

写文章的判断标准只有一条：**是否包含真实工程过程**。单纯翻译文档、罗列概念的内容不进入本博客。

## 技术方向

| 方向 | 关注点 |
|------|--------|
| AI Infrastructure | GPU 集群调度、DRA、推理服务工程 |
| Agent Runtime | 智能体运行时的隔离、状态与生命周期 |
| Kubernetes / 云原生 | 核心抽象、生产化改造、Service Mesh |
| Linux / 系统工程 | cgroup、namespace、资源与性能观测 |
| Go 工程实践 | 并发模型、设计模式在真实项目中的取舍 |
| 容器与运行时 | OCI、运行时隔离、镜像构建链路 |

## 关键要点

**架构**

- **Hugo + Hugo Modules**，主题以模块方式引入 PaperMod，不做 fork 改造，定制全部通过 `layouts/` 覆盖与 `assets/css/custom.css` 追加。
- **多层覆盖优先级**：站点 `layouts/` → 主题 `_vendor/` → 模块默认。改样式先确认层级，避免改了不生效。
- **数据驱动导航**：分类与系列的关系不在模板里硬编码，而是由 `data/*.yaml` 描述，模板遍历生成。新增系列只改数据，不改模板。
- **中英双语**：内容以 `.zh.md` / `.en.md` 区分。英文缺失时自动回退中文，列表页不会出现空洞。

**构建与发布**

- GitHub Actions 监听 `main` 分支推送，构建后部署到 GitHub Pages。
- 构建使用 `hugo --gc --minify --printPathWarnings`，路径警告会直接暴露模板引用问题。
- 构建前会执行 `hugo mod verify`，主题模块异常会立刻失败，不会产出风格错乱的站点。

**内容组织**

- 目录名即分类，无需在 front matter 重复声明 `categories`。
- 教程系列用 `cascade` 把 layout 下发给全部子篇，分篇只写 `title` 和 `date`。
- 文章通过 `series` 字段挂载到系列节点，这是导航、目录、关系图共同依赖的唯一关联键。

## 关注点

维护这个仓库时需要守住的东西：

1. **CSS 完整性** —— `custom.css` 是单文件长期追加的结果，选择器列表与声明块必须成对。一旦出现「逗号结尾但无声明块」的悬空选择器，后续规则会被整段吞掉，症状往往是某个主题下间距异常、样式莫名失效。改完务必校验花括号配平。
2. **主题不硬改** —— 不修改 `_vendor/` 与模块缓存，所有覆盖写在站点侧。主题升级才能无冲突。
3. **数据即配置** —— 导航、系列、项目列表来自 `data/`，模板里出现硬编码的分类名或链接都是技术债。
4. **内容不做虚构** —— 文章中的性能数字、结论、踩坑过程必须来自真实实践。这是本博客唯一的可信度来源。
5. **双语同步成本** —— 新增中文文章时优先保证中文质量，英文回退是兜底而非长期方案。

## 项目结构

```text
blogio/
├── layouts/            # 站点级模板覆盖（优先级最高）
│   ├── _default/       # 首页、个人主页、方向页
│   ├── articles/       # 文章列表与详情
│   ├── series/         # 教程系列首页与分篇
│   ├── partials/       # 可复用片段（导航、文章体、图标）
│   └── _markup/        # 代码块渲染定制
├── assets/
│   ├── css/custom.css  # 全部自定义样式
│   └── js/             # 排序、Mermaid 初始化
├── content/
│   ├── articles/       # 文章，按分类目录组织
│   ├── series/         # 教程系列
│   └── directions/     # 技术方向页
├── data/               # 导航、系列、项目等结构化数据
├── i18n/               # 中英文案
├── scripts/            # 封面下载、项目活动同步
└── hugo.toml           # 站点配置与模块声明
```

> `_vendor/` 与 `public/` 为构建产物，不参与修改。

## 本地开发

```bash
hugo server --bind 0.0.0.0          # 预览，访问 /blogio/
hugo --gc --minify                  # 生产构建，同时暴露模板与资源错误
hugo mod verify                     # 校验主题模块完整性
```

`Makefile` 提供常用封装：`make dev`、`make build`、`make check`、`make new POST=<name>`。

## 内容创作速查

**新增文章**：在 `content/articles/<分类>/` 下创建 `my-post.zh.md`。

```yaml
---
title: "标题"
date: 2026-11-12
description: "列表页一句话摘要"
tcf: "Go"                    # 主题胶囊标签
location: "Shanghai"
series: kubernetes-tutorial   # 可选，挂载到系列节点
cover:
  image: "images/02.jpg"
---
```

**新增系列**：在 `content/series/<slug>/_index.zh.md` 中用 `cascade` 下发 layout，并在 `data/blog_links.yaml` 添加条目让导航自动发现。

**新增分类**：创建目录并添加 `_index.zh.md`，再把它加入 `layouts/articles/list.html` 的 `$catOrder` 以控制排序位置。

## 设计原则

- **内容优先** —— 视觉服务于阅读，不做干扰性动效。
- **工程真实** —— 记录问题、设计、实现、验证的完整链路。
- **长期可用** —— 今天是博客，长期是知识库，结构要为三年后服务。
- **开放共享** —— 可公开的实践与工具都放出来。

## 许可协议

本项目采用**内容与代码分离授权**的方式：文章是创作成果，代码是工程资产，两者的使用诉求不同。

| 范围 | 许可 | 说明 |
|------|------|------|
| 代码（`layouts/`、`assets/`、`scripts/`、`hugo.toml`） | [MIT](https://opensource.org/licenses/MIT) | 可自由使用、修改、分发，保留版权声明即可 |
| 文章内容（`content/` 下的 Markdown） | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh) | 署名、非商业用途、相同方式共享 |

### 你需要知道的边界

- **可以**：引用观点并注明出处，转载全文需保留原文链接与作者署名，基于本文思路继续写作。
- **需要授权**：商业培训、付费专栏、书籍收录、以文章内容为主体的商业产品。
- **不属于本站**：`_vendor/` 下的 PaperMod 主题遵循其自身 MIT 协议；`assets/js/mermaid.min.js` 遵循 Mermaid 的 MIT 协议；文中引用的第三方图片版权归原作者。

### 为什么这样选

MIT 让想复用模板与样式的人没有负担 —— 这套「数据驱动导航 + 多层 layout 覆盖」的结构本身就有参考价值。而文章采用 CC BY-NC-SA，是因为其中的工程结论来自真实生产环境，需要保证署名与不被断章取义地商用。

如需商业授权，请通过站点 About 页面的联系方式沟通。