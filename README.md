# PHP Security Analyzer

🔒 专为 CTF 竞赛设计的 PHP 安全分析插件，自动检测漏洞、分析 POP 链、生成利用 Payload。

![VS Code](https://img.shields.io/badge/VS%20Code-^1.80.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-1.0.0-orange)

## ✨ 功能特性

### 🔍 漏洞检测
- **LFI/RFI** - 本地/远程文件包含
- **SQL 注入** - 包括 intval 绕过检测
- **XXE** - XML 外部实体注入
- **命令注入** - system/exec/passthru 等
- **反序列化** - unserialize 危险调用
- **SSRF** - 服务端请求伪造
- **变量覆盖** - extract/parse_str 等

### ⛓️ POP 链分析
- 自动识别魔术方法（__destruct, __wakeup, __toString 等）
- 追踪属性注入点
- 构建完整攻击链
- 可视化展示调用关系

### 📊 代码结构图
- Maltego 风格的交互式图表
- 类/方法/属性关系可视化
- 数据流追踪
- 危险函数调用高亮

### 🎯 Payload 生成
- 自动生成漏洞利用代码
- 支持 POP 链序列化 Payload
- 提供多种绕过技巧

## 📦 安装

### 从 VSIX 安装
```bash
code --install-extension php-code-analyzer-ctf-x.x.x.vsix
```

### 从源码构建
```bash
git clone https://github.com/ZUENS2020/vscode_php_analyzer.git
cd vscode_php_analyzer
npm install
npm run compile
npx vsce package
```

## 🚀 使用方法

1. 打开 PHP 文件
2. 使用命令面板 (`Ctrl+Shift+P`)：
   - `PHP Analyzer: Full Security Analysis` - 完整安全分析
   - `PHP Analyzer: Find POP Chain` - 查找 POP 链
   - `PHP Analyzer: Scan Vulnerabilities` - 扫描漏洞
   - `PHP Analyzer: Generate Exploit Payload` - 生成利用代码
   - `PHP Analyzer: Show Code Graph` - 显示代码结构图

3. 右键菜单也可快速访问分析功能

## 📸 截图

### 代码结构图
交互式图表展示代码结构和攻击路径：
- 🟢 入口点 (unserialize)
- 🔵 类
- 🟢 方法
- 🔴 魔术方法
- 🟠 用户输入源
- 🔴 危险函数

### POP 链检测
自动发现反序列化攻击链并生成 Payload。

## ⚙️ 配置

在 VS Code 设置中搜索 `phpAnalyzer`：

| 设置 | 默认值 | 说明 |
|------|--------|------|
| `phpAnalyzer.enableInlineHints` | true | 显示内联提示 |
| `phpAnalyzer.highlightDangerousPatterns` | true | 高亮危险代码 |
| `phpAnalyzer.showPOPChains` | true | 显示 POP 链 |
| `phpAnalyzer.graphServerPort` | 3000 | 图表服务器端口 |

## 🔧 开发

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 监听模式
npm run watch

# 打包
npx vsce package
```

按 `F5` 启动调试模式。

## 📝 更新日志

### v1.0.0
- 首个正式版本
- 完整的漏洞检测功能
- POP 链自动分析
- Maltego 风格代码结构图
- Payload 自动生成

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**⚠️ 免责声明：本工具仅供安全研究和 CTF 学习使用，请勿用于非法用途。**
