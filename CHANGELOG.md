# Changelog

All notable changes to PHP Security Analyzer will be documented in this file.

## [1.0.0] - 2024-12-05

### 🎉 首个正式版本

#### 功能特性
- **漏洞检测** - 支持 LFI、SQL注入、XXE、命令注入、反序列化等 20+ 种漏洞模式
- **POP 链分析** - 自动识别魔术方法，构建反序列化攻击链
- **代码结构图** - Maltego 风格的交互式可视化
- **Payload 生成** - 自动生成漏洞利用代码
- **数据流追踪** - 污点分析，追踪用户输入到危险函数

#### 命令
- `PHP Analyzer: Full Security Analysis` - 一键完整安全分析
- `PHP Analyzer: Find POP Chain` - 查找反序列化攻击链
- `PHP Analyzer: Scan Vulnerabilities` - 扫描代码漏洞
- `PHP Analyzer: Generate Exploit Payload` - 生成利用代码
- `PHP Analyzer: Show Code Graph` - 可视化代码结构
- `PHP Analyzer: Analyze Class Relations` - 分析类关系

#### 支持的漏洞类型
- 反序列化漏洞 (unserialize)
- 文件包含 (LFI/RFI)
- SQL 注入 (包括 intval 绕过)
- 命令注入 (system/exec/passthru)
- XXE 注入
- SSRF
- 变量覆盖 (extract/parse_str)
- 任意文件读写
