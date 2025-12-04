<?php
/*
 * 题目1: 弱类型比较
 * 考察点: PHP弱类型比较、MD5碰撞、科学计数法绕过
 * 难度: 简单
 * Flag: flag{php_w3ak_typ3_1s_d4ng3r0us}
 */

error_reporting(0);
highlight_file(__FILE__);

$flag = "flag{php_w3ak_typ3_1s_d4ng3r0us}";

// 第一关：数字与字符串的弱类型比较
if (isset($_GET['num'])) {
    $num = $_GET['num'];
    if ($num == 2024 && !is_numeric($num)) {
        echo "Level 1 Passed!<br>";
        
        // 第二关：MD5弱类型比较（0e开头）
        if (isset($_GET['str1']) && isset($_GET['str2'])) {
            $str1 = $_GET['str1'];
            $str2 = $_GET['str2'];
            
            if ($str1 !== $str2 && md5($str1) == md5($str2)) {
                echo "Level 2 Passed!<br>";
                
                // 第三关：MD5强碰撞（使用数组绕过）
                if (isset($_POST['arr1']) && isset($_POST['arr2'])) {
                    $arr1 = $_POST['arr1'];
                    $arr2 = $_POST['arr2'];
                    
                    if ($arr1 !== $arr2 && md5($arr1) === md5($str2)) {
                        echo "Level 3 Passed!<br>";
                        
                        // 第四关：strcmp绕过
                        if (isset($_POST['password'])) {
                            $password = $_POST['password'];
                            if (strcmp($password, "S3cr3tP@ssw0rd!") == 0 && $password !== "S3cr3tP@ssw0rd!") {
                                echo "Congratulations! Here is your flag: " . $flag;
                            } else {
                                echo "Level 4 Failed! Hint: strcmp有什么特性？";
                            }
                        }
                    } else {
                        echo "Level 3 Failed! Hint: 数组的MD5值是什么？";
                    }
                }
            } else {
                echo "Level 2 Failed! Hint: 0e开头的MD5值";
            }
        }
    } else {
        echo "Level 1 Failed! Hint: 科学计数法？";
    }
}

/*
Writeup:
1. Level 1: num=2024a 或 num=2024e0（科学计数法形式的字符串）
2. Level 2: str1=QNKCDZO&str2=240610708（两者MD5值都是0e开头）
3. Level 3: arr1[]=1&arr2[]=2（数组的MD5返回NULL）
4. Level 4: password[]=1（strcmp传入数组返回0）

最终payload:
GET: ?num=2024a&str1=QNKCDZO&str2=240610708
POST: arr1[]=1&arr2[]=2&password[]=1
*/
?>
