import os
import sys
import urllib.request
import zipfile
import subprocess
import ctypes

VBCABLE_URL = "https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack45.zip"

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False

def download_and_extract_vbcable(target_dir=None):
    if target_dir is None:
        target_dir = os.path.join(os.path.expanduser("~"), "Downloads", "VBCABLE_Setup")

    os.makedirs(target_dir, exist_ok=True)
    zip_path = os.path.join(target_dir, "vbcable.zip")

    print(f"Downloading VB-CABLE Driver from {VBCABLE_URL}...")
    headers = {'User-Agent': 'Mozilla/5.0'}
    req = urllib.request.Request(VBCABLE_URL, headers=headers)
    
    with urllib.request.urlopen(req) as response, open(zip_path, 'wb') as out_file:
        data = response.read()
        out_file.write(data)

    print("Extracting driver installer...")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(target_dir)

    setup_exe = os.path.join(target_dir, "VBCABLE_Setup_x64.exe")
    if not os.path.exists(setup_exe):
        setup_exe = os.path.join(target_dir, "VBCABLE_Setup.exe")

    print(f"Found setup: {setup_exe}")
    return setup_exe

def launch_installer(setup_exe):
    print("Launching installer with administrative permissions...")
    try:
        ctypes.windll.shell32.ShellExecuteW(
            None,
            "runas",
            setup_exe,
            "",
            os.path.dirname(setup_exe),
            1
        )
        return True
    except Exception as e:
        print(f"Error launching installer: {e}")
        return False

if __name__ == "__main__":
    try:
        exe = download_and_extract_vbcable()
        launch_installer(exe)
    except Exception as e:
        print(f"Installation failed: {e}")
