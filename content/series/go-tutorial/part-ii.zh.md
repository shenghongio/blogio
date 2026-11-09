---
title: "并发编程与工程化"
date: 2026-11-09
---

> Goroutine 和 Channel 是 Go 并发编程的灵魂，配合 Context、Mutex 等原语，构成了 Go 工程化的完整拼图。
> 本 Part 聚焦 Go 最核心的并发模型，以及模块化、测试、Error 处理等工程实践。

## 并发编程

### Goroutine 与 Channel
学习轻量级协程的原理，掌握 Channel 通信模型，理解 CSP 并发哲学。

### 同步与并发模式
深入 Mutex、RWMutex、WaitGroup、Once、Context，以及常见的并发设计模式。

## 工程化

### 模块与依赖
理解 Go Modules 的工作原理，掌握包管理和 vendor 最佳实践。

### 测试与质量
系统学习单元测试、表驱动测试、Benchmark 性能测试，以及 Error 处理最佳实践。
