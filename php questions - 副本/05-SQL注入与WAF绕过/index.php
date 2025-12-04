<?php
/*
 * 题目5: SQL注入与WAF绕过
 * 考察点: SQL注入、WAF绕过、堆叠注入、预编译绕过
 * 难度: 中等
 * Flag: flag{sql_1nj3ct10n_w4f_byp4ss}
 */

error_reporting(0);

// 数据库配置
$db_file = __DIR__ . '/database.db';

function init_database($db_file) {
    $db = new SQLite3($db_file);
    
    // 创建用户表
    $db->exec("CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT,
        password TEXT
    )");
    
    // 创建flag表（秘密表）
    $db->exec("CREATE TABLE IF NOT EXISTS s3cr3t_fl4g (
        id INTEGER PRIMARY KEY,
        flag TEXT
    )");
    
    // 插入测试数据
    $db->exec("INSERT OR IGNORE INTO users VALUES (1, 'admin', 'super_secret_password')");
    $db->exec("INSERT OR IGNORE INTO users VALUES (2, 'guest', 'guest123')");
    $db->exec("INSERT OR REPLACE INTO s3cr3t_fl4g VALUES (1, 'flag{sql_1nj3ct10n_w4f_byp4ss}')");
    
    return $db;
}

// WAF过滤函数
function waf($input) {
    $blacklist = [
        'union', 'select', 'from', 'where', 'and', 'or',
        'order', 'group', 'having', 'limit', 'offset',
        '--', '#', '/*', '*/', 'sleep', 'benchmark',
        'if(', 'case', 'when', 'then', 'else',
        'load_file', 'into', 'outfile', 'dumpfile',
        'hex(', 'char(', 'concat', 'substring', 'substr',
        'ascii', 'ord', 'mid(', 'left(', 'right(',
        '0x', 'information_schema', 'sqlite_master'
    ];
    
    $input_lower = strtolower($input);
    foreach ($blacklist as $word) {
        if (strpos($input_lower, $word) !== false) {
            return false;
        }
    }
    return true;
}

$db = init_database($db_file);

if (isset($_GET['action'])) {
    highlight_file(__FILE__);
    exit;
}

echo "<h1>User Login System</h1>";
echo "<p>View source: <a href='?action=source'>?action=source</a></p>";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = isset($_POST['username']) ? $_POST['username'] : '';
    $password = isset($_POST['password']) ? $_POST['password'] : '';
    
    // WAF检测
    if (!waf($username) || !waf($password)) {
        die("<p style='color:red'>WAF: Malicious input detected!</p>");
    }
    
    // 构造查询（存在SQL注入漏洞）
    $sql = "SELECT * FROM users WHERE username = '$username' AND password = '$password'";
    
    echo "<p>Debug SQL: " . htmlspecialchars($sql) . "</p>";
    
    try {
        $result = $db->query($sql);
        if ($result && $row = $result->fetchArray()) {
            echo "<p style='color:green'>Welcome, " . htmlspecialchars($row['username']) . "!</p>";
        } else {
            echo "<p style='color:red'>Invalid credentials!</p>";
        }
    } catch (Exception $e) {
        echo "<p style='color:red'>Error: " . htmlspecialchars($e->getMessage()) . "</p>";
    }
} else {
    echo '<form method="POST">
        <label>Username: <input type="text" name="username"></label><br><br>
        <label>Password: <input type="password" name="password"></label><br><br>
        <input type="submit" value="Login">
    </form>';
}

$db->close();
?>
<?php
/*
Writeup:
考察点：
1. SQLite注入
2. WAF关键字绕过
3. 获取隐藏表名和数据

绕过技巧：
1. 大小写混合：SeLeCt、UnIoN（题目用strtolower处理了，无效）
2. 双写绕过：selselectect（无效，不是替换为空）
3. 注释绕过：sel-星号-星号-ect（星号被过滤）
4. 编码绕过：URL编码（在WAF检测前已解码）
5. 换行符绕过：sel%0aect
6. 使用等价函数

SQLite特有技巧：
1. 使用||进行字符串连接
2. 使用GLOB代替LIKE
3. 使用printf函数

攻击步骤：
1. 首先尝试基本注入确认漏洞存在
   username: admin'||'1'='1
   password: anything

2. 使用换行符绕过关键字检测
   username: ' un%0aion sel%0aect 1,flag,3 fr%0aom s3cr3t_fl4g--
   
3. 如果知道表名，直接查询
   由于我们知道表名是 s3cr3t_fl4g（题目源码泄露）
   
4. 使用堆叠注入（如果支持）
   username: '; attach database '/tmp/test.db' as test;--

实际Payload：
username: ' uni%0an sel%0aect 1,flag,3 fr%0aom s3cr3t_fl4g;--
password: x

或使用盲注：
username: admin' and (select length(flag) from s3cr3t_fl4g)>10;--
*/
?>
