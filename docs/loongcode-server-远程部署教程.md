# LoongCode 远程部署与连接教程

> 在 Linux 服务器上启动 `loongcode serve`，从 Windows 桌面版远程连接，复用服务器的文件 / 命令 / 模型环境。含直连与 SSH 隧道两种方案。
>
> 适用版本：`dev` 分支（commit `245eef55b` 及之后，`lgcode → loongcode` 改名已完成）

---

## 0. 这份教程和旧版有何不同

仓库已从 `LGcode` 改名为 `LoongCode`。如果你用过旧版（基于 `lgcode-clean` 的那份 HTML 教程），注意以下关键变化，**旧命令直接照抄会全部踩坑**：

| 项 | 旧版（lgcode） | 现版（loongcode） |
|---|---|---|
| CLI 命令 | `lgcode serve` | `loongcode serve` |
| 密码环境变量 | `LGCODE_SERVER_PASSWORD` | `LOONGCODE_SERVER_PASSWORD` |
| 默认用户名 | `lgcode` | `loongcode` |
| 启动日志 | `lgcode server listening` | `loongcode server listening` |
| 桌面端产物名 | `lgcode-desktop-*` | `loongcode-desktop-*` |
| 健康检查端点 | `/global/health` | `/api/health`（v1 兼容路径 `/global/health` 仍可用） |
| 健康检查认证 | 设密码后带 `-u` | **设密码后必须带 `-u loongcode:密码`**（只有 manifest 图标放行） |

另外两个非改名相关的注意点：
- `--hostname` **默认仍是 `127.0.0.1`**（只听本地）——这是连不上的头号原因，必须显式 `0.0.0.0` 或走 SSH 隧道。
- `--port` **yargs 默认是 `0`**，运行时回退逻辑先试 4096，4096 被占会退到随机端口。生产必须显式 `--port 4096` 保证确定性。

---

## 1. 架构与原理

```
Windows 桌面版  ──HTTP/WebSocket──▶  Linux 服务器 (loongcode serve)
   (Electron)                          │
   你操作代码                          ├─ 读/写服务器上的文件
                                       ├─ 调用模型 API（如 LGDG 远程）
                                       └─ 在服务器上执行命令/工具
```

| 项 | 值 |
|---|---|
| 仓库 | `https://github.com/Clearlove7Zz/LoongCode`，分支 `dev` |
| 服务器地址（示例） | `10.18.23.241`（Ubuntu 24.04 + bun 1.3.14） |
| 部署目录 | `/root/loongcode` |
| CLI 入口 | `/usr/local/bin/loongcode`（软链到 bin 脚本） |
| 默认监听 | ⚠ `127.0.0.1`（仅本机）—— 必须改 `0.0.0.0` 或走隧道 |
| 端口 | `4096` |
| 认证 | HTTP Basic Auth，用户名 `loongcode`，密码 `loongcode@241` |
| 健康检查 | `GET /api/health` → 期望 `{"healthy":true}` |

---

## 2. 服务器侧准备（首次部署）

> **先看第 2.0 节**：有 4 种快捷安装方式可以跳过「git clone + bun install 4000+ 包」。能联网的 Linux x64 机器推荐方式一(npm)，最省事。

### 2.0 快捷安装（推荐，跳过源码安装）

loongcode 是用 `bun build --compile` 编译成**单文件自包含二进制**的，能跑 `serve` 命令，不需要 node_modules。服务器装好这个二进制就能直接用。

已发版，npm 和 GitHub Releases 都有现成的二进制。下面 4 种方式任选其一：

#### 方式一：npm 全局安装（推荐，最省事）

npm 上有 `loongcode` 包（Linux x64 自包含二进制），一条命令装好，还能 `npm update -g loongcode` 升级。

```bash
# 装（npm/yarn/pnpm 都行；服务器没装 node 先装 node）
npm install -g loongcode

# 运行时依赖：ripgrep（server 会调用 rg 做代码搜索）
sudo apt install -y ripgrep     # Debian/Ubuntu
# sudo yum install -y ripgrep   # CentOS/RHEL

# 验证
loongcode --version
```

> 适合：联网的 **Linux x64** 服务器（绝大多数服务器）。一条命令搞定、升级方便。
>
> ⚠ npm 包只含 **Linux x64** 二进制。arm64 服务器、musl(Alpine)、老 CPU(baseline) 走方式二 Releases 下载对应变体。

#### 方式二：GitHub Releases 下载预编译二进制（覆盖所有架构/离线）

Releases 里有各架构 Linux 二进制（`loongcode-linux-x64.tar.gz`、`loongcode-linux-arm64.tar.gz` 等），解压就是单文件二进制。**服务器只需 3 条命令**：

```bash
# 1. 下载二进制（x64 服务器；arm64 换成 loongcode-linux-arm64.tar.gz）
curl -L https://github.com/Clearlove7Zz/LoongCode/releases/latest/download/loongcode-linux-x64.tar.gz | tar xz
sudo mv loongcode /usr/local/bin/

# 2. 运行时依赖：ripgrep（server 会调用 rg 做代码搜索）
sudo apt install -y ripgrep     # Debian/Ubuntu
# sudo yum install -y ripgrep   # CentOS/RHEL

# 3. 验证
loongcode --version
```

> 其他 Linux 变体（按服务器实际情况选，替换上面 URL 里的文件名）：
> - `loongcode-linux-arm64.tar.gz` — ARM 服务器（AWS Graviton、树莓派等）
> - `loongcode-linux-x64-baseline.tar.gz` — 老 CPU（无 AVX2，跑起来报 `Illegal instruction` 时换这个）
> - `loongcode-linux-x64-musl.tar.gz` — Alpine Linux（musl libc）
>
> 不确定架构就跑 `uname -m`：`x86_64` → x64，`aarch64`/`arm64` → arm64。Alpine 看 `cat /etc/os-release | grep NAME`。
>
> **也可以用一键安装脚本**（自动检测平台、装 ripgrep、配 PATH）：
> ```bash
> curl -fsSL https://github.com/Clearlove7Zz/LoongCode/raw/dev/install | bash
> ```
> 脚本装到 `~/.loongcode/bin/loongcode`，并自动写入 shell 的 PATH。

#### 方式三：自己用 GitHub Actions 编译（没有 Linux 本机、想自建 Release 时）

如果你只有 Windows、手头没有 Linux 机器来 `--single` 编译，可以让 **GitHub Actions 帮你编**，编完直接发到 Releases，你从 Windows 浏览器下载即可。**零密钥**，仓库已有现成工作流 `build-server-binary.yml`。

操作：GitHub 仓库 → Actions 页 → 选 `build-server-binary` → Run workflow → 等约 5 分钟。编完自动建 Release 并上传 Linux 各架构二进制。详见 [附：触发发版](#附触发发版)。

> 适合：本机非 Linux、想出 Release 给多台服务器复用。

#### 方式四：在 Linux 机器上 `--single` 自编译（有 Linux 本机时）

如果手头有 Linux 机器（架构 = 服务器架构），可以本地编一个二进制，scp 到服务器。**编一次，多处复用**。

```bash
# 在 Linux 构建机上
git clone -b dev https://github.com/Clearlove7Zz/LoongCode.git
cd Loongcode
bun install
./packages/loongcode/script/build.ts --single
# 产出：packages/loongcode/dist/loongcode-linux-x64/bin/loongcode

# scp 到服务器
scp packages/loongcode/dist/loongcode-linux-x64/bin/loongcode root@10.18.23.241:/usr/local/bin/loongcode
ssh root@10.18.23.241 'chmod +x /usr/local/bin/loongcode && apt install -y ripgrep'
```

> ⚠ `--single` 只编译**当前机器**的平台。Windows 上编不出 Linux 二进制，必须有 Linux 构建机。没有的话用方式三让 GitHub Actions 编。

---

#### 桌面版安装（客户端，连远程 server 用）

以上 4 种是**服务器端**装法。你本机（Windows/Mac）要装的是**桌面版客户端**——同样是 Release 里现成的安装包，下载双击装即可：```bash
# 在 Linux 构建机上
git clone -b dev https://github.com/Clearlove7Zz/LoongCode.git
cd Loongcode
bun install
./packages/loongcode/script/build.ts --single
# 产出：packages/loongcode/dist/loongcode-linux-x64/bin/loongcode

# scp 到服务器
scp packages/loongcode/dist/loongcode-linux-x64/bin/loongcode root@10.18.23.241:/usr/local/bin/loongcode
ssh root@10.18.23.241 'chmod +x /usr/local/bin/loongcode && apt install -y ripgrep'
```

> ⚠ `--single` 只编译**当前机器**的平台。Windows 上编不出 Linux 二进制，必须有 Linux 构建机。没有的话用方式二让 GitHub Actions 编。
> 也可以不传 `--single`，会编译全部 12 个目标（含各 Linux/macOS/Windows 变体），慢但全。

---

#### 桌面版安装（客户端，连远程 server 用）

以上 4 种是**服务器端**装法。你本机（Windows/Mac）要装的是**桌面版客户端**——同样是 Release 里现成的安装包，下载双击装即可：

| 你的本机系统 | 下载这个文件 | 安装方式 |
|---|---|---|
| Windows x64（绝大多数） | `Loongcode Setup x64.exe` | 双击运行 |
| Windows ARM | `Loongcode Setup arm64.exe` | 双击运行 |
| macOS Apple Silicon（M 系） | `Loongcode-arm64.dmg` | 打开拖到 Applications |
| macOS Intel | 暂无预编译包，用 `build-desktop-mac-x64` 或源码 | — |
| Linux | `loongcode-desktop-linux-x64.tar.gz` / `.deb` / `.rpm` | 按发行版选 |

下载页：https://github.com/Clearlove7Zz/LoongCode/releases/latest

> 桌面版产物由 4 个 `build-desktop-*` 工作流产出并自动发到 Release。若 Release 里还没有桌面包（比如某次只触发了 server 构建），到 Actions 页面手动触发对应的 `build-desktop-*` 工作流，填同样的版本号 `0.0.1`，跑完自动补传。详见 [附：触发发版](#附触发发版)。
>
> desktop 与 server 版本要对应（都 `0.0.1`），否则可能协议不兼容。

装好桌面版后，**回到第 5 节（直连）或第 6 节（SSH 隧道）**填表连接服务器。

---

#### 装好后做什么

无论用哪种方式装好 `loongcode` 二进制，**直接跳到第 3 节**手动启动验证，或第 4 节配 systemd 常驻。后续步骤完全一样，只是不用再做 git clone + bun install。

> 如果你的服务器无法联网、又拿不到预编译二进制，只能退回下面的源码安装。

---

### 2.1 源码安装（备用，无快捷方式时）

```bash
# 1. 装 bun（loongcode 入口是 #!/usr/bin/env bun，必须用 bun 跑原生 TS）
#    版本必须和仓库 packageManager 一致：bun@1.3.14
curl -fsSL https://bun.sh/install | bash
bun --version          # 确认 1.3.14

# 2. 拉 dev 分支到 /root/loongcode
cd /root
git clone -b dev https://github.com/Clearlove7Zz/LoongCode.git loongcode
cd /root/loongcode

# 3. 装依赖（约 4000+ 包）
#    注意：ghostty-web 是 github git 依赖，服务器访问 github 慢需配代理。
#    server 本身不依赖它（桌面端才用），但 workspace install 会拉。
bun install

# 4. 全局软链，方便直接用 loongcode 命令
ln -sf /root/loongcode/packages/loongcode/bin/loongcode /usr/local/bin/loongcode

# 5. 验证 CLI 可用
loongcode --help       # 输出命令列表即正常
```

> **分支选型**：用 `dev`，不要用 `lgcode-clean`。`dev` 是活跃主线含完整改名；`lgcode-clean` 是改名前的孤立 orphan 分支，处处对不上本教程。



> **分支选型**：用 `dev`，不要用 `lgcode-clean`。
> `dev` 是活跃主线，含完整 loongcode 改名、logo、CI 修复、自动更新源修复。`lgcode-clean` 是改名前的孤立 orphan 分支（单 commit，不是 dev 的祖先），还停留在 LGcode 基线，用它反而处处对不上本教程。

---

## 3. 手动启动验证

```bash
# 设密码（必须有，否则裸奔警告）
export LOONGCODE_SERVER_PASSWORD='loongcode@241'
# 用户名可不设，默认 loongcode；要改：
# export LOONGCODE_SERVER_USERNAME='loongcode'

# --hostname 0.0.0.0 才能被外部访问（默认 127.0.0.1 只听本地，头号坑）
# --port 4096 显式指定保证确定性（默认 0 靠回退，4096 被占会随机）
loongcode serve --hostname 0.0.0.0 --port 4096
```

看到这行就成功了（注意是 **`loongcode server`**）：

```
loongcode server listening on http://0.0.0.0:4096
```

> **认证说明**
> 用户名默认 `loongcode`（代码里 `EffectConfig.withDefault("loongcode")`），不能空、不能填 admin。密码由环境变量 `LOONGCODE_SERVER_PASSWORD` 控制。不设密码时 server 会打印 `Warning: LOONGCODE_SERVER_PASSWORD is not set; server is unsecured.`

### 健康检查（设密码必须带 Basic Auth）

```bash
# v2 端点（推荐）
curl -u loongcode:loongcode@241 http://127.0.0.1:4096/api/health
# 期望：{"healthy":true}

# v1 兼容端点（旧教程用的，仍可用）
curl -u loongcode:loongcode@241 http://127.0.0.1:4096/global/health
```

> 设密码后健康检查也被认证拦截（只有 `/site.webmanifest` 等图标放行），curl **必须带 `-u`**。没设密码时去掉 `-u` 也能通。

---

## 4. systemd 常驻 + 开机自启

裸 `nohup` / `setsid` 也能后台跑，但 SSH 一关、机器重启就没了。做成 systemd 服务最稳。

创建 `/etc/systemd/system/loongcode.service`:

```ini
[Unit]
Description=LoongCode Headless Server
After=network.target

[Service]
Type=simple
# WorkingDirectory 仅源码安装时有意义(二进制安装可改成任意可写目录,如 /root)
WorkingDirectory=/root/loongcode
Environment="LOONGCODE_SERVER_PASSWORD=loongcode@241"
Environment="LOONGCODE_SERVER_USERNAME=loongcode"
# 直连场景:--hostname 0.0.0.0 对外可达
# 隧道场景:去掉 --hostname 0.0.0.0(用默认 127.0.0.1,只听本地最安全)
# 二进制在 /usr/local/bin/loongcode（npm/Releases/build --single 装法）或 npm 全局 bin 目录
# 或 /root/loongcode/packages/loongcode/bin/loongcode(源码软链后用 loongcode)
ExecStart=/usr/local/bin/loongcode serve --hostname 0.0.0.0 --port 4096
Restart=on-failure
RestartSec=3
StandardOutput=append:/root/loongcode.log
StandardError=append:/root/loongcode.log

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable loongcode       # 开机自启
sudo systemctl restart loongcode
sleep 4

# 确认状态
sudo systemctl is-active loongcode    # → active
ss -tlnp | grep ":4096 "              # → 0.0.0.0:4096（直连场景）
```

现在 server 由 systemd 托管：关 SSH 不掉、重启机器自启、崩溃 3 秒后自动拉起。日志在 `/root/loongcode.log`。

> ⚠ 如果提示 `Unit ... is masked`，先 `sudo systemctl unmask loongcode`，再重建 service 文件，重新 `daemon-reload + enable + restart`。

---

## 5. 方案 A：桌面版直连（网络较好时）

适用：客户端能直接访问服务器的 4096 端口（同网段、或服务器有公网 IP、防火墙放行 4096）。

systemd 保持第 4 节配置（`--hostname 0.0.0.0`）。

### 5.1 客户端先测网络

在 Windows PowerShell：

```powershell
curl.exe -u loongcode:loongcode@241 http://10.18.23.241:4096/api/health
```

- 返回 `{"healthy":true}` → 网络 + 地址 + 账密全 OK，进 5.2 配桌面版。
- 卡住 / 超时 → 网络层不通，查防火墙/网段/端口放行，或直接跳到方案 B 用 SSH 隧道。

### 5.2 桌面版填写连接信息

桌面版「添加服务器」对话框填 4 个字段：

| 字段 | 值 |
|---|---|
| 服务器 URL | `http://10.18.23.241:4096`（**不要**带 `/api/health` 等路径，别漏 `http://` 和端口） |
| 服务器名称（可选） | 如 `Linux 服务器` |
| 用户名 | `loongcode`（不是 admin、不是空） |
| 密码 | `loongcode@241`（注意有 `@`） |

**填地址常踩的坑**：
- 漏 `http://` 前缀 → 桌面版解析失败
- 漏端口 `:4096` → 默认走 80，连不上
- 多带路径 → 桌面版自己拼端点，你别加
- 用户名没填 `loongcode` → 认证 401

---

## 6. 方案 B：SSH 隧道连接（跨网段 / 网络差，强烈推荐）

适用：跨网段网络质量差、服务器 4096 端口不通、或想全程加密不暴露 server。

SSH 走 22 端口（通常稳定），把桌面版流量通过 SSH 隧道转发到服务器 127.0.0.1:4096，绕过 4096 直连的不稳定，且 server 完全不对外暴露。

### 6.1 server 侧调整

编辑 service 文件，ExecStart **去掉 `--hostname 0.0.0.0`**（用默认 127.0.0.1，只听本地，最安全）：

```ini
ExecStart=/usr/local/bin/loongcode serve --port 4096
```

改完：

```bash
sudo systemctl daemon-reload && sudo systemctl restart loongcode
ss -tlnp | grep ":4096 "     # 现在应是 127.0.0.1:4096
```

### 6.2 建隧道

在 Windows PowerShell 跑（保持窗口开着，关了隧道就断）：

```powershell
ssh -N -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -L 4096:127.0.0.1:4096 root@10.18.23.241
```

输入服务器 root 密码后命令"卡住"无输出 = 隧道已建立，正常。

- `-N` 不执行远程命令，仅做端口转发
- `-L 4096:127.0.0.1:4096` 把本机 4096 转发到服务器的 `127.0.0.1:4096`
- `-o ServerAliveInterval=30` 保活，防空闲断开

### 6.3 桌面版改连本地

隧道建好后，桌面版连接地址改成 localhost：

| 字段 | 值 |
|---|---|
| 服务器 URL | `http://127.0.0.1:4096`（或 `http://localhost:4096`） |
| 用户名 | `loongcode` |
| 密码 | `loongcode@241` |

### 6.4 验证隧道

另开一个 PowerShell：

```powershell
curl.exe -u loongcode:loongcode@241 http://127.0.0.1:4096/api/health
# 返回 {"healthy":true} = 隧道通
```

> 🔧 **进阶：隧道常驻**
> 用 SSH 密钥免密：本机 `ssh-keygen` 生成密钥，`ssh-copy-id root@10.18.23.241` 推到服务器，之后隧道免密自连。
> 把隧道命令存成 `start-tunnel.bat`，用 Windows 计划任务"登录时运行"挂起来即可后台常驻。

---

## 7. 配 LGDG 远程模型

连上桌面版后配模型。本仓库 **LGDG（龙岗数据）供应商已置顶到列表首位**（代码层置顶 + 独立分组排最前）：

1. 桌面版 → 设置 → 供应商
2. 「龙岗数据」分组在最顶部，点连接
3. 填入 LGDG API Key（在 `https://modelhub.lgdg.cc` 获取）
4. 保存后，模型列表自动从 `https://modelhub.lgdg.cc/aigateway/v1/models` 拉取

> 即便 LGDG discoverModels 接口临时失败，LGDG 会始终保留在列表里（已修复"0 模型供应商被删除"问题），方便随时回来配置。

配好 key 后选一个模型（如 `GLM-5.1-w4a8`），新建对话，流式回复从服务器中转到桌面版。

---

## 8. 运维速查

| 操作 | 命令 |
|---|---|
| 看状态 | `sudo systemctl status loongcode` |
| 启动 | `sudo systemctl start loongcode` |
| 停止 | `sudo systemctl stop loongcode` |
| 重启 | `sudo systemctl restart loongcode` |
| 看日志（实时） | `tail -f /root/loongcode.log` |
| 看日志（报错） | `grep -aE "ERROR\|Error" /root/loongcode.log \| tail -20` |
| 改密码 | 改 service 文件 `Environment="LOONGCODE_SERVER_PASSWORD=新密码"` → `systemctl daemon-reload && systemctl restart loongcode`，桌面版同步改密码 |
| 改端口 | 改 service 文件 ExecStart 的 `--port` → reload + restart |
| 关自启 | `sudo systemctl disable loongcode` |
| 健康检查 | `curl -u loongcode:loongcode@241 http://127.0.0.1:4096/api/health` |

---

## 9. 疑难排查

### 症状 A：桌面版一直连不上

**第 1 步：客户端测网络**（PowerShell）

```powershell
curl.exe -v -m 8 http://10.18.23.241:4096/api/health
```

- **Established + 401** → 网络通，账密/地址填错，检查桌面版配置（用户名必须 `loongcode`）
- **Connection refused** → 端口在但服务没起；或服务监听 127.0.0.1（没改 0.0.0.0）
- **超时无响应** → 网络层被挡，走方案 B SSH 隧道

**第 2 步：服务器侧排查**

```bash
sudo systemctl is-active loongcode          # active=在
ss -tlnp | grep ":4096 "                    # 0.0.0.0:4096 才对外可连（直连场景）
ufw status                                  # inactive=放行
tail -30 /root/loongcode.log
```

### 症状 B：能用，但开新对话 / 新工作区很慢

通常瓶颈在网络不在 server。server 接口响应都是毫秒级，但跨网段裸 HTTP 长连接质量差。**对策：首选 SSH 隧道（方案 B）**，释放服务器资源，模型用远程 API（LGDG）而非本地大模型。

### 症状 C：用一会儿就掉线

多数是网络抖动，桌面版重连即可。频繁掉 → 改 SSH 隧道（带 `-o ServerAliveInterval=30` 保活）。检查 service `Restart=on-failure` 是否生效：崩溃会 3 秒自重启。

### 症状 D：日志报 `Path is not absolute: D:\...`

**这是桌面版把本地 Windows 目录当工作目录发给了远程 Linux server。** server 在 Linux 上不认 `D:\...` 这种 Windows 绝对路径，posix 校验不通过。

**对策**：在桌面版选工作目录时，填**服务器上的 Linux 绝对路径**（如 `/root/你的项目`、`/data/xxx`），不要填 `D:\...`。正常 UI 流程下远程 server 用 server 端目录浏览不会触发；手动输入或迁移旧数据易触发。

### 症状 E：curl 健康检查 401

设了密码后健康检查也被认证拦截。**对策**：curl 带 `-u loongcode:loongcode@241`。

### 症状 F：环境变量不生效

误用旧 `LGCODE_` 前缀。**对策**：必须用 `LOONGCODE_` 前缀（`LOONGCODE_SERVER_PASSWORD`、`LOONGCODE_SERVER_USERNAME`）。

### 症状 G：端口实际不是 4096

不显式 `--port` 时默认 0，4096 被占回退随机端口。**对策**：生产显式 `--port 4096`，看启动日志确认实际端口。

---

## 附：关键命令速记

```bash
# 手动启动
LOONGCODE_SERVER_PASSWORD='loongcode@241' loongcode serve --hostname 0.0.0.0 --port 4096

# 健康检查（设密码必带 -u）
curl -u loongcode:loongcode@241 http://127.0.0.1:4096/api/health

# SSH 隧道（本机 Windows）
ssh -N -o ServerAliveInterval=30 -L 4096:127.0.0.1:4096 root@10.18.23.241
```

桌面版填表：URL `http://10.18.23.241:4096`（直连）或 `http://127.0.0.1:4096`（隧道），用户名 `loongcode`，密码 `loongcode@241`。

---

## 附：触发发版（出 Release 让快捷安装可用）

仓库自带的 `publish.yml` 是完整发版流程（npm + Apple/Azure 签名 + AUR + Homebrew + Docker），依赖 18 个 secrets，你 fork 大概率没配齐，走不通也犯不着配。

**实际用的是这两个零密钥工作流**（只用 Actions 自带的 `github.token`）：

### 1. `build-server-binary.yml` — 编译 server 二进制发到 Releases

手动触发，跑 `build.ts` 编 Linux 各架构二进制，`gh release upload` 上传到对应 Release。约 5 分钟。详见第 2.0 节方式一/二。

```bash
# 触发（gh 已登录时），或去 Actions 页面手动 Run workflow
gh workflow run build-server-binary.yml --repo Clearlove7Zz/LoongCode -f version=0.0.1
```

环境变量：`LOONGCODE_VERSION`（版本号）+ `LOONGCODE_RELEASE=1`（触发上传）+ `GH_REPO` + `GH_TOKEN`（自带）。

### 2. `build-desktop-*.yml`（3 个）— 编译桌面安装包发到 Releases

`build-desktop-windows`（一次出 x64+arm64 双架构）、`build-desktop-mac-arm64`、`build-desktop-linux`，各自手动触发，输入 `channel`（prod/beta/dev，默认 prod）。版本号自动从 `packages/loongcode/package.json` 读取，无需手填。构建后 `gh release upload` 把 `.exe`/`.dmg`/`.deb` 等传到对应 Release。

```bash
# 例：触发 Windows 桌面构建（版本随 package.json）
gh workflow run build-desktop-windows.yml --repo Clearlove7Zz/LoongCode -f channel=prod
```

4 个平台可同时触发，互不冲突（产物文件名不同，传同一个 Release）。

### 出新版本的流程

代码改完 push 到 dev 后：

1. Actions 页 → `build-server-binary` → Run workflow → 填新版本号（如 `0.0.2`）
2. 想发桌面端再触发需要的 `build-desktop-*`，填**同样的** `0.0.2`
3. 等几分钟，Releases 里 `v0.0.2` 就齐了

> 服务器和桌面端**版本号要一致**，否则可能协议不兼容。每次出Release保证两者用同一个版本号触发。

### 发版前的代码修复（已在本分支完成，不用再动）

- ✅ `packages/loongcode/Dockerfile`：`lgcode→loongcode` 路径已修（`publish.yml` 发 Docker 镜像时才用到）
- ✅ `install` 脚本：`APP=loongcode`、仓库地址 `Clearlove7Zz/LoongCode`、安装目录 `~/.loongcode` 已修
- ✅ `packages/loongcode/script/build.ts`：产物名 `loongcode-*` / 二进制 `loongcode`（原本就对）
- ✅ `build-server-binary.yml` 用 `ubuntu-24.04` runner（非 blacksmith，fork 能跑）
- ✅ 4 个 `build-desktop-*.yml` 加了 `version` 输入 + Upload to Release 步骤

### 关于 `publish.yml`（完整发版，可选）

如果想走完整发版（npm 包 `loongcode`、Apple/Azure 代码签名、AUR/Homebrew、Docker 镜像），才需要配齐 `publish.yml` 那 18 个 secrets。**只做 server + 桌面端部署完全用不到它**，本教程的两个零密钥工作流就够。配 `publish.yml` 的细节见仓库 `publish.yml` 顶部和 `packages/loongcode/script/publish.ts`。


