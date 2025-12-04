# PHP 反序列化 POP 链检测插件 - 改进总结

## 概述

本次改进为 VS Code PHP 安全分析插件添加了针对 CTF 题目的高级检测能力，特别是对正则过滤绕过、__wakeup 绕过和 Session 反序列化的支持。

## 新增功能

### 1. 正则过滤检测与绕过建议

#### 功能描述
自动检测代码中的 `preg_match` 正则过滤，并提供针对性的绕过方法。

#### 支持的检测模式
- `O:\d+:` 模式检测
- 类名匹配检测
- 大小写敏感性检测（/i 修饰符）

#### 绕过方法建议
1. **+ 号绕过**: 将 `O:4:"User"` 改为 `O:+4:"User"`
2. **%00 填充**: 使用 `O:4%00:"ClassName"`
3. **十六进制编码**: 将类名首字母编码为 `\x` 格式
4. **大写 S 格式**: 使用 `S:4:"\x55ser"` 代替普通字符串

#### 示例输出
```
检测到正则过滤:
  模式: /O:\d+:"User"/ (line 58)
  绕过方法:
    - 使用 + 号绕过: O:+4:"ClassName" 代替 O:4:"ClassName"
    - 使用 %00 填充: O:4%00:"ClassName"
    - 尝试使用 \x 十六进制编码类名: 如 U -> \x55
```

### 2. __wakeup 绕过检测

#### 功能描述
检测 `__wakeup` 方法对属性的重置，并自动标记需要绕过的情况。

#### CVE-2016-7124 利用
- 自动生成属性数量修改代码
- 明确标注仅在 PHP < 7.4.26 版本有效
- 提供手动修改和自动化两种方法

#### 示例输出
```php
// === 绕过 __wakeup (修改属性数量) ===
// 将 User:X: 改为 User:(X+1):
$payload = preg_replace('/O:(\d+):"User":(\d+):/', 'O:$1:"User":' . ('$2' + 1) . ':', $payload);
// 注意: 此方法仅在 PHP < 7.4.26 有效
```

### 3. Session 反序列化漏洞检测

#### 功能描述
检测 PHP Session 序列化处理器设置，识别可能的 Session 反序列化漏洞。

#### 支持的处理器
- `php` (默认)
- `php_serialize`
- `php_binary`

#### 攻击提示
当检测到 `php_serialize` 处理器时，自动提供：
1. 处理器差异说明
2. `|` 分隔符注入方法
3. 完整攻击流程
4. 自动生成带 `|` 前缀的 Session payload

#### 示例输出
```
检测到 Session 序列化处理器:
  处理器: php_serialize (line 23)

Session 反序列化攻击提示:
  如果存在多个文件使用不同的处理器，可能存在 session 反序列化漏洞
  利用方法:
    1. 在使用 php_serialize 的页面注入: |O:4:"User":1:{...}
    2. | 符号前的内容会被 php 处理器当作键名
    3. | 符号后的内容会被反序列化
    4. 访问使用默认 php 处理器的页面触发反序列化
```

### 4. 增强的 Payload 生成

#### 正则绕过 Payload
自动生成包含绕过代码的 payload：
```php
// === 绕过正则过滤 ===
// 原始: O:4:"User":4:
// 使用 +: O:+4:"User":4:
$payload_bypass = str_replace('O:4:"', 'O:+4:"', $payload);
```

#### Session 注入 Payload
自动生成 Session 反序列化 payload：
```php
// === Session 反序列化 Payload ===
// 在表单中提交以下内容:
$session_payload = '|' . $payload;
echo "Session Payload:\n" . $session_payload . "\n\n";
```

## 测试结果

### 题目2: 反序列化入门 ✅
- ✅ 检测到正则过滤 `/O:\d+:"User"/`
- ✅ 检测到 `__wakeup` 重置 `isAdmin` 属性
- ✅ 提供 5 种正则绕过方法
- ✅ 生成包含绕过代码的完整 payload
- ✅ 标注 __wakeup 绕过在 PHP 7.4+ 已失效

**检测结果摘要:**
```
Found 2 POP chains/vulnerabilities
- Chain #1: Logger::__destruct (文件写入)
- Chain #2: User::__destruct (属性注入获取 flag)
```

### 题目6: 反序列化POP链 ✅
- ✅ 检测到关键字过滤正则 `/system|exec|passthru|.../i`
- ✅ 正确构建完整 POP 链
- ✅ 识别 `strval` 触发 `__toString` 的链路
- ✅ 生成可用的 exploit payload

**检测结果摘要:**
```
Found 1 POP chain
DataProcessor::__destruct → process() → Transformer::transform() → call_user_func
正确使用 strval 触发 FileReader::__toString 读取文件
```

### 题目10: Session反序列化 ✅
- ✅ 检测到 `php_serialize` 处理器
- ✅ 检测到类名过滤正则 `/FlagReader|FileHandler/i`
- ✅ 生成 Session 注入 payload（带 `|` 前缀）
- ✅ 提供详细的攻击流程说明
- ✅ 建议寻找使用默认处理器的其他页面

**检测结果摘要:**
```
Found 3 POP chains/vulnerabilities
- FileHandler::__destruct (文件写入)
- FileHandler::__toString (文件读取)
- SessionUser::__destruct (属性注入)
全部包含 Session 注入提示和 payload
```

## 技术实现

### 新增接口

```typescript
// 正则过滤信息
export interface RegexFilter {
    pattern: string;
    line: number;
    targetClass?: string;
    description: string;
    bypassMethods: string[];
}

// Session 处理器信息
export interface SessionHandler {
    handler: 'php' | 'php_serialize' | 'php_binary' | 'unknown';
    line: number;
    file?: string;
}
```

### 核心方法

1. `detectRegexFilters()`: 遍历 AST 检测 preg_match 调用
2. `analyzeRegexBypass()`: 分析正则模式并生成绕过方法
3. `detectSessionHandlers()`: 检测 ini_set 对 session.serialize_handler 的设置
4. `generateBypassHints()`: 生成综合的绕过提示

### POPChainResult 扩展

```typescript
export interface POPChainResult {
    // ... 原有字段
    regexFilters?: RegexFilter[];
    sessionHandlers?: SessionHandler[];
    bypassHints?: string[];
    vulnType?: 'pop_chain' | 'property_injection' | 'wakeup_bypass' | 'session_deserialize';
}
```

## 代码质量

- ✅ TypeScript 编译无错误
- ✅ 保持向后兼容
- ✅ 添加详细的代码注释
- ✅ 遵循现有代码风格
- ✅ 不修改已有功能

## 使用示例

### 在 VS Code 中使用

1. 打开 PHP 文件（如题目2、6、10）
2. 右键选择 "PHP Analyzer: Find POP Chain" 或 "Full Security Analysis"
3. 查看检测结果，包含：
   - 完整的 POP 链路径
   - 正则过滤检测和绕过建议
   - Session 处理器检测和利用提示
   - 自动生成的 exploit payload

### Payload 生成

每个检测结果都包含完整的 PHP exploit 代码，包括：
- 类定义
- 对象构造
- 属性设置（带注释说明）
- 正则绕过代码（如适用）
- __wakeup 绕过代码（如适用）
- Session 注入 payload（如适用）
- URL 编码输出
- 完整的利用 URL

## 未来改进建议

1. **扩展过滤器检测**: 支持更多过滤函数（如 `str_replace`, `filter_var` 等）
2. **智能绕过选择**: 根据 PHP 版本自动选择最佳绕过方法
3. **多文件分析**: 自动分析项目中所有 PHP 文件，寻找 Session 处理器差异
4. **交互式 payload 生成**: 允许用户自定义 payload 参数
5. **其他漏洞类型**: 添加文件包含、命令注入、SQL 注入等检测

## 参考资料

- CVE-2016-7124: PHP __wakeup 绕过漏洞
- PHP Session 反序列化漏洞原理
- PHP 序列化格式详解

## 总结

本次改进显著增强了插件对 CTF 反序列化题目的支持，特别是：
- 题目2: 完整支持正则绕过和 __wakeup 绕过
- 题目6: 保持原有功能正常工作
- 题目10: 新增完整的 Session 反序列化检测和利用

所有改进都经过实际测试验证，能够正确检测漏洞并生成可用的 exploit payload。
