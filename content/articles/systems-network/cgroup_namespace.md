---
title: "cgroup 与 namespace：容器隔离的底层机制"
date: 2026-11-13
description: "从内核视角拆解容器隔离：namespace 负责看得见什么，cgroup 负责用得了多少。"
tcf: "Linux"
cover:
  image: "images/123f23f23rrffwr322f1ed32.jpg"
---

## 先说结论
容器不是虚拟机，内核中根本不存在容器这个对象，只有一个进程加载两套机制，
+ namespace 负责看得见什么， - 命名空间隔离，私有进程表，私有网卡，私有根目录等。
+ cgroup 负责用得了多少。 - cpu时间，内存字节，IO宽带等
---
两者正交，谁也替代不了谁
+ cgroup v2 是 cgroup 的新版本，比 v1 更加强大，支持更多功能 重点关注的
  +  https://docs.kernel.org/admin-guide/cgroup-v2.html?utm_source=chatgpt.com
+ cgroup v1 作为了解历史，不建议在新项目中使用
  +  https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v1/cgroups.html?utm_source=chatgpt.com
+ cgroup man page
  +  https://man7.org/linux/man-pages/man7/cgroups.7.html
+ namespace 官方文档
  + https://man7.org/linux/man-pages/man7/namespaces.7.html
+ namespace 系统调用
  +  通过clone创建进程和Namespace
    + https://man7.org/linux/man-pages/man2/clone.2.html?utm_source=chatgpt.com
  +  创建新的namespace
    +  https://man7.org/linux/man-pages/man2/unshare.2.html?utm_source=chatgpt.com
  +  加入已有的namespace
    + https://man7.org/linux/man-pages/man2/setns.2.html?utm_source=chatgpt.com

核心区别如下

| 对比 | namespace | cgroup |
| --- | --- | --- |
| 核心作用 | 资源视图隔离 | 资源统计与限制 |
| PID | 进程隔离 | 不负责 PID 视图隔离 |
| Network | 隔离网络栈 | 不负责网络栈隔离 |
| Mount | 隔离挂载视图 | 不负责挂载视图隔离 |
| CPU | 无对应 namespace | CPU 限制与统计 |
| Memory | 无对应 namespace | 内存限制与统计 |
| IO | 无对应 namespace | IO 限制与统计 |


## Namespace 基础：PID、Mount、Network、UTS、IPC
## 1. 目标
理解 Linux Namespace 如何实现进程的资源视图隔离，以及它与 Docker、containerd、Kubernetes 容器隔离机制之间的关系。

| Namespace | 隔离内容 | 重点 |
| --- | --- | --- |
| PID | 进程 ID | 进程树、PID 1 |
| Mount | 文件系统挂载视图 | 独立挂载点 |
| Network | 网络资源 | 网卡、路由、网络命名空间 |
| UTS | 主机名和域名 | 主机名和域名 |
| IPC | 进程间通信资源 | 消息队列、共享内存 |
| User | 用户和用户组 ID | UID/GID 映射 |

### 2. Namespace 的核心原理
   Namespace 是 Linux Kernel 提供的资源隔离机制。

> 它解决的问题是： 让不同 Namespace 中的进程看到不同的系统资源视图。 例如，宿主机上有两个进程：
```textmate
Host
│
├── Process A
│   └── PID Namespace A
│       ├── PID 1
│       └── PID 2
│
└── Process B
    └── PID Namespace B
        ├── PID 1
        └── PID 2
```
两个namespace 中可以分别存在pid为1 的进程，但他们在宿主机上拥有不同的实际PID，这个就是namespace 的隔离效果。

### 3. Namespace 创建和管理
#### 先来了解一下三个核心的系统调用
+ `clone()` 创建新的进程和Namespace
+ `unshare()` 创建新的Namespace
+ `setns()` 加入已有的Namespace

#### 基于以上系统调用，我们可以创建和管理不同的Namespace。实际操作一下
##### 查看当前进程的Namespace
```bash
  ls -l /proc/self/ns/
```
![img.png](../img.png)

> 上面输出中 方括号中的数字是当前进程的Namespace ID。也就是inode标识，可用于判断两个进程是否处于同一个Namespace 中。
##### 查看当前进程的namespace 信息
```bash
cat /proc/self/status |grep -E 'Pid|NSpid'
```
![img_1.png](../img_1.png)

> 说明：
>   + Pid：当前进程在宿主机 PID Namespace 中的进程 ID。 
>   + NSpid：当前进程在各层嵌套 PID Namespace 中的 PID。

##### 查看系统中有哪些 Namespace，以及关联的进程
```bash
lsns
```

##### 现在从PID Namespace开始
```bash
ls /proc/self/ns/pid && readlink /proc/1/ns/pid
```
![输出](../img_2.png)

> 说明：
> - `4026531836` 是当前进程所属 PID Namespace 的 inode 编号，可以这样理解：
>   - `/proc/self`：指向当前进程的 Proc 文件目录
>   - `ns/pid`：表示当前进程所属的 PID Namespace
>   - `4026531836`：该 Namespace 在内核中对应的 inode 标识
> - 💡  如果两个进程的 /proc/[pid]/ns/pid 显示相同的 inode 编号，通常说明它们属于同一个 PID Namespace。 如果 inode 不同，则说明它们属于不同的 PID Namespace。

##### 思考一个问题
上面`ls /proc/self/ns/pid && readlink /proc/1/ns/pid` 显示的 inode 编号是相同的，说明当前进程和 PID 1 的进程所属的 PID Namespace 是同一个。
> ⚠️ 这里的 inode 编号是 PID Namespace 的 inode 编号，不是当前进程的 inode 编号。

这里要说明的是，为什么要比较这两个值？

+ Linux通过Namespace 来实现进程的资源视图隔离。
  + 假设宿主机和容器处于不同的 PID Namepace
  + 宿主机 PID Namespace
```text
PID 1    systemd
PID 1250 containerd
PID 2300 容器主进程
```
 + 容器 PID Namespace
```text
PID 1    应用主进程
PID 2    应用子进程
```
> 示意：同一个进程在不同 PID Namespace 中可以具有不同的 PID 视图

这就是为什么容器内部可以看到自己的 PID 1，而宿主机看到的却是另一个 PID。

![img_3.png](../img_3.png)

重点关注：
- PID 1：/sbin/init，当前 PID Namespace 中的 1 号进程。
- PID 2：kthreadd，Linux 内核线程管理进程。
- PID 3、4 等：内核工作线程。
  这里可以先建立一个认识：PID Namespace 隔离的是进程 ID 的视图，而不是让系统真的创建一套独立的 Linux 内核

现在我们通过 unshare 创建一个独立的 PID Namespace，观察同一个实验环境中的 PID 变化。
```bash
# 默认这个命令是没有的，需要apt安装
unshare --fork --pid --mount-proc bash
```

|参数| 作用                       |
|---|--------------------------|
|unshare| 让指定的子进程不再共享某些 Namespace。 |
|--fork| 创建子进程，让它进入新的 PID Namespace |
|--pid| 为子进程创建新的 PID Namespace |
|--mount-proc| 为子进程新环境重新挂载 /proc，让 ps 等工具看到新 Namespace 的进程视图 |
![img_4.png](../img_4.png)
> ⚠️ 注意： 这组命令会创建独立的子环境，不会替换宿主机的 PID 1。退出实验时执行：`exit`

最重要的知识：同一个进程可以有多个 PID
现在我们进入一个核心概念。
假设宿主机创建了一个进程，它进入新的 PID Namespace。
这个进程可能同时具有两个 PID：
![img_5.png](../img_5.png)

什么第一条 NSpid 没有输出？
这里的关键是 /proc/self。
/proc/self 是一个特殊路径，指向访问 /proc 的进程自身。
你当前的 /proc 是通过 --mount-proc 在新 PID Namespace 中重新挂载的。
```bash
$echo "1. 当前进程的 PID：";echo $$;echo "2. 当前进程的 status 路径：";readlink /proc/self;echo "3. 当前进程的 NSpid：";grep NSpid /proc/$$/status;echo "4. PID 1 的完整状态信息：";cat /proc/1/status | grep -E '^(Name|Pid|PPid|NSpid):'
1. 当前进程的 PID：
1
2. 当前进程的 status 路径：
26
3. 当前进程的 NSpid：
NSpid:	1
4. PID 1 的完整状态信息：
Name:	bash
Pid:	1
PPid:	0
NSpid:	1
```

> 💡说明：
> 为什么父进程是 0？ 
> 因为 Bash 是新 PID Namespace 的第一个进程。 它在新 Namespace 中没有一个可见的父进程，因此 PPid 显示为 0。


一个关键宿主机上的 Bash 和新 Namespace 中的 Bash，到底是不是同一个进程？
答案是：是同一个进程，只是 PID 视角不同
我们现在通过exit 回到宿主机查看
```bash
$echo "当前 Shell PID: $$";echo "当前 PID Namespace:";readlink /proc/self/ns/pid;echo "当前 Shell 的 PID Namespace:";readlink /proc/$$/ns/pid
当前 Shell PID: 1
当前 PID Namespace:
pid:[4026532747]
当前 Shell 的 PID Namespace:
pid:[4026532747]
$ps -ef
UID          PID    PPID  C STIME TTY          TIME CMD
root           1       0  0 08:57 pts/1    00:00:00 bash
root          32       1  0 09:18 pts/1    00:00:00 ps -ef
```




## Cgroup v2：CPU、Memory、IO、PID Controller。
## clone()、unshare()、setns() 系统调用。
## /proc/[pid]/ns、/proc/[pid]/cgroup。
## containerd / runc 如何组合使用 Namespace 和 Cgroup。