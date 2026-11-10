---
title: "Go 是什么？"
date: 2026-11-09
draft: false
sustain: true
description: "Go（又称 Golang）是 Google 开发的开源编程语言，以简洁、高效、原生并发支持著称，是云原生时代的首选后端语言。"
tags:
  - Go
topics:
  - go
series: go-tutorial
---

Go（又称 Golang）是由 Google 的 Robert Griesemer、Rob Pike 和 Ken Thompson 于 2007 年设计、2009 年开源的静态强类型、编译型编程语言。
它的设计目标是**简单、快速、安全、原生支持并发**。Go 融合了静态类型语言的编译时安全性和动态语言的开发效率，内置垃圾回收，编译速度极快，生成的原生二进制无需任何运行时依赖。

## 设计哲学

Go 的核心设计哲学可以概括为：**少即是多**。语言特性克制但精准，避免了其他语言中常见的复杂特性（如泛型直到 1.18 才引入、无类继承、无异常），让代码更易读、更易维护。

Go 语言的主要特点
特点	说明
语法简洁	语言关键字少，代码可读性高
静态类型	编译阶段进行类型检查
编译执行	编译生成原生可执行文件
并发支持	使用 Goroutine 和 Channel
垃圾回收	自动管理内存
跨平台	支持 Linux、Windows、macOS 等
标准库丰富	内置 HTTP、JSON、网络、文件等常用功能
部署简单	通常可以直接部署编译后的二进制文件

### 简洁优先

Go 没有类继承、没有三元运算符、没有函数重载、没有默认参数。设计者认为**清晰的代码比聪明的代码更重要**。

```go
// 一个典型的 Go 函数
func Add(a, b int) int {
    return a + b
}
```

### 原生并发

Go 的 Goroutine 和 Channel 是其最具标志性的特性。Goroutine 是轻量级协程，由 Go runtime 调度在 OS 线程上运行，可以轻松创建数万个。

```go
go func() {
    fmt.Println("Hello from goroutine!")
}()
```

### 工程友好

Go 工具链非常完善，`go build`、`go test`、`go fmt`、`go mod` 一应俱全，标准库质量极高，`net/http`、`encoding/json` 等包足以覆盖绝大多数后端开发需求。

## 适用场景

Go 特别适合以下场景：

- **云原生基础设施**：Docker、Kubernetes、Prometheus、Terraform 均为 Go 编写
- **高性能后端服务**：高并发 API、微服务网关、消息队列
- **DevOps 工具**：CLI 工具、CI/CD 插件、自动化脚本
- **网络编程**：反向代理、负载均衡器、RPC 框架

## 与其他语言对比

| 特性 | Go | Python | Java | Rust |
|------|----|--------|------|------|
| 类型系统 | 静态强类型 | 动态 | 静态强类型 | 静态强类型 |
| 编译速度 | 极快 | 解释型 | 中等 | 慢 |
| 运行时 | 无（原生二进制） | CPython/JIT | JVM | 无（原生二进制） |
| 并发模型 | Goroutine/Channel | asyncio | Thread/VirtualThread | async/await + Thread |
| 学习曲线 | 低 | 低 | 中 | 高 |

## 小结

Go 凭借简洁的语法、优秀的并发模型、快速的编译和原生二进制部署，已成为云原生时代最受欢迎的编程语言之一。接下来让我们进入具体的语法学习。