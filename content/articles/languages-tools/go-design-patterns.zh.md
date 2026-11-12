---
title: "Go 里那些设计模式，其实都不太像设计模式"
date: 2026-11-12
description: "把二十三种经典模式放到 Go 里逐个过一遍：哪些是语言本身已经替你解决的，哪些该用接口替代继承，哪些根本不该在 Go 里出现。"
location: "Shanghai"
tcf: "Go"
cover:
  image: "images/02.jpg"
---

## 起点：为什么 Go 里谈设计模式总觉得别扭

二十三年的 Java 经验让「设计模式」成了一门必修课：单例、工厂、观察者、模板方法，每个都能配上一段标准 UML 图和一套固定写法。

但把同样的清单搬到 Go 里，会发现一个奇怪的现象——很多模式你想不起来在哪用过，却并不觉得代码缺了什么。比如单例，标准写法要私有构造器、静态实例、双重检查锁；而在 Go 里：

```go
var db *sql.DB
var once sync.Once

func GetDB() *sql.DB {
    once.Do(func() {
        db, _ = sql.Open("postgres", dsn)
    })
    return db
}
```

三个语言的机制（包级变量、`sync.Once`、导出函数）直接拼出了结果，没有一行是"为了模式而模式"。这就是理解 Go 设计模式的关键起点：**Go 不是没有模式，而是把一部分模式的实现成本降到了零**，降为零之后它就不再被叫做模式了。

## 第一类：被语言特性直接消解的模式

有一批模式存在的理由，是"宿主语言缺少某种能力"。把语言换掉，理由就消失了。

### 单例 —— 包级变量就是单例

Java 的单例要对抗的是"谁都能 `new`"，所以要私有化构造器。Go 里首字母小写的包级变量，外部包根本碰不到，天然就是私有的。并发安全由 `sync.Once` 兜底，剩下的就是一个函数。

需要注意的是别把 `sync.Once` 用成"延迟初始化"的万能钥匙。它只保证**最多执行一次**，不保证执行成功。初始化失败时 `once.Do` 已经消费掉了那次机会，后续调用永远拿到零值。这种场景应该用：

```go
var (
    mu     sync.Mutex
    client *Client
)

func Get() *Client {
    mu.Lock()
    defer mu.Unlock()
    if client == nil {
        c, err := dial()
        if err != nil {
            return nil
        }
        client = c
    }
    return client
}
```

### 迭代器 —— 用 range 协议而非接口

经典迭代器模式要定义 `Iterator` 接口、`hasNext`、`next`。Go 1.23 之后有了 `range over func`，标准写法变成：

```go
func Lines(r io.Reader) func(yield func(string) bool) {
    return func(yield func(string) bool) {
        sc := bufio.NewScanner(r)
        for sc.Scan() {
            if !yield(sc.Text()) {
                return
            }
        }
    }
}

for line := range Lines(f) {
    fmt.Println(line)
}
```

早期的数据回归也可以用 channel 实现同样的语义。这两种做法都比接口版更符合调用方的直觉，因为调用方写的是 `for ... range`，不是 `for it.HasNext()`。

### 模板方法 —— 高阶函数

经典模板方法靠继承：父类定义骨架，子类覆写钩子。Go 没有继承，但有函数值：

```go
func WithRetry(attempts int, op func() error) error {
    var err error
    for i := 0; i < attempts; i++ {
        if err = op(); err == nil {
            return nil
        }
    }
    return err
}
```

骨架（循环、计数、退出条件）留在函数里，变化的部分（`op`）从参数进来。这不叫"模板方法"，它叫**普通函数**。

## 第二类：需要显式实现的经典模式

还有一批模式在 Go 里依然有用，只是实现形态变了——大多从"继承覆写"变成"接口组合"。

### 策略与工厂：接口 + 函数值

策略模式的本质是"运行时选择行为"。Go 里的标准解法是接口：

```go
type Compressor interface {
    Compress([]byte) ([]byte, error)
}
```

但如果策略只是一个无状态的纯变换，用接口反而重了，函数类型更直接：

```go
type Compressor func([]byte) ([]byte, error)
```

工厂同理。经典工厂方法要给每个产品写一个工厂类；Go 里简单工厂就是一个返回接口的构造函数，复杂的场景才需要注册表：

```go
type Parser func([]byte) (Node, error)

var parsers = map[string]Parser{}

func Register(name string, p Parser) { parsers[name] = p }

func New(name string) (Parser, bool) {
    p, ok := parsers[name]
    return p, ok
}
```

注册表这类写法在 `database/sql`、`image` 包里都用同一个思路，`init()` 里注册，调用方按名字取。它是工厂模式在 Go 生态里最地道的形态。

### 装饰器：中间件

装饰器的目标是"在不改原对象的前提下叠加能力"。Go 里这个位置被 **middleware** 完全占据：

```go
func Logging(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        next.ServeHTTP(w, r)
        log.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start))
    })
}
```

`func(Handler) Handler` 这个签名本身就是装饰器协议，叠几层就是几层装饰，且每层都可独立测试。比起 Java 里要新建一个包装类，Go 的版本更接近装饰器最初想表达的意思。

### 观察者：channel 与回调

观察者的核心是"事件发生时通知多个订阅者"。Go 有两种自然实现：

```go
// 回调形式，适合同步通知
type Observer func(Event)

type Subject struct {
    observers []Observer
}

func (s *Subject) Subscribe(o Observer) {
    s.observers = append(s.observers, o)
}

func (s *Subject) Publish(e Event) {
    for _, o := range s.observers {
        o(e)
    }
}
```

或者用 channel 做异步广播。后者要处理好关闭语义——向已关闭的 channel 发送会 panic，所以广播方通常要自己维护订阅者的注销，避免出现"谁来关这个 channel"的僵局。

## 第三类：Go 里应当谨慎或放弃的模式

这一类的共同特征是：它们在 Go 里能写出来，但写出来会比不用更糟。

### 责任链

责任链依赖"每个节点知道自己下一个是谁"。Go 里更常见的做法是把职责显式拆成独立的函数依次调用，或者用中间件链（其实也是责任链，但顺序由组合代码固定，而非由对象自己持有）。如果硬要写 `handler.SetNext(next)` 那种形式，链的断裂只能在运行时暴露，且不好调试。

### 访问者

访问者模式依赖方法重载或反射来分发类型。Go 没有重载，只能用类型开关：

```go
func Visit(n Node) {
    switch v := n.(type) {
    case *Binary:
        Visit(v.Left)
        Visit(v.Right)
    }
}
```

能工作，但一旦节点类型增多，这个 switch 就成了所有新类型的必经修改点，恰好是访问者想解决的问题本身。Go 更推荐"为每种操作写一个独立的遍历函数"，牺牲一点复用换清晰。

### 原型

原型模式要"深拷贝一个对象作为模板"。Go 里没有隐式拷贝语义的兜底，值拷贝和引用拷贝的区别要自己判断，涉及 slice、map、指针时一定要手写 clone。建议直接用显式的 `Clone()` 方法并配套 `go vet` 的 `copylocks` 检查，而不是指望一个通用的原型注册表。

### 抽象工厂 + 建造者

这两个模式在 Go 里最常被过度使用。抽象工厂的动机是"切换整套产品族"，但 Go 里一个接口 + 一个构造函数通常就够了；建造者（Builder）的动机是"参数太多、构造过程分步"，而 Go 里有更轻的解法：

```go
type Option func(*Server)

func WithPort(p int) Option { return func(s *Server) { s.port = p } }

func NewServer(opts ...Option) *Server {
    s := &Server{port: 8080}
    for _, opt := range opts {
        opt(s)
    }
    return s
}
```

这是 Go 社区公认的 **functional options**，它替代了建造者在配置场景下的绝大部分用途。只有在构造过程本身需要状态机（分多个必选步骤且顺序有关）时，才值得真的写一个 builder 结构体。

### 代理与享元

代理模式在 Go 里通常表现为"包一层接口再转发"，本身没问题，但要警惕为了加一行日志就造一个包装类型——那更适合 middleware。享元模式（共享内部状态、外部状态作参数传入）在 Go 里几乎没有必要单独实现，因为值类型本来就按值传递，指针共享也足够直白。

## 回到本质：Go 的设计观

把这些模式逐个拆开之后，会看到一个反复出现的规律：

| 语言机制 | 被它消解的模式 |
|---|---|
| 包级私有变量 | 单例 |
| 接口满足（无继承） | 策略、工厂、装饰器 |
| 函数值 | 模板方法、策略、建造者 |
| `range over func` | 迭代器 |
| `sync.Once` / channel | 单例、观察者 |

经典设计模式的出发点，是在**静态强类型 + 继承**的语言里用结构来弥补语言表达力的不足。Go 的选择是另一条路：把表达力下沉到接口、函数值、并发原语这些原语上，让上层代码少绕弯。

所以写 Go 时值得问自己的两个问题，比背模式清单更有用：

1. **这个模式要解决的问题，语言本身是不是已经给了更短的路径？**
2. **这段抽象是为了应对当前的变化，还是为了应对想象中的变化？**

第二个问题尤其重要，因为 Go 的接口可以在用的时候再抽，而不是先抽象再填入。`io.Reader` 这种"先有实现、后有接口"的演进方式，正是这种务实取向的产物。

## 一页速查

- **单例**：包级变量 + `sync.Once`，失败可重试时改用手写锁
- **策略 / 工厂**：无状态变换用函数类型，有状态用接口
- **装饰器**：`func(T) T` 签名 + 中间件组合
- **观察者**：回调切片同步、channel 异步，注意注销语义
- **模板方法**：高阶函数，骨架留函数体内
- **建造者**：优先 functional options，状态机场景才用真 builder
- **责任链 / 访问者 / 原型 / 抽象工厂**：先确认是否真需要，往往是过度设计