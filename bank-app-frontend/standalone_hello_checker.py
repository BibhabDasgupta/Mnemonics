import os
import hashlib
import json
import ctypes
from ctypes import wintypes, POINTER, byref
import platform
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

class WindowsHelloChecker:
    """Lightweight Windows Hello state checker"""
    
    def __init__(self):
        self.winbio = None
        self._setup_winbio()
    
    def _setup_winbio(self):
        """Setup Windows Biometric API"""
        if platform.system() != "Windows":
            return
        
        try:
            self.winbio = ctypes.WinDLL("winbio.dll")
        except OSError as e:
            print(f"Warning: Could not load winbio.dll: {e}")
        except Exception as e:
            print(f"Warning: Could not setup Windows Hello API: {e}")
    
    def get_database_size(self) -> int:
        """Get the total size of biometric database files in bytes"""
        try:
            biometric_paths = [
                r"C:\Windows\System32\WinBioDatabase"
            ]
            
            total_size = 0
            file_count = 0
            
            for path in biometric_paths:
                if os.path.exists(path) and os.path.isdir(path):
                    try:
                        files = os.listdir(path)
                        for file in files:
                            try:
                                file_path = os.path.join(path, file)
                                if os.path.isfile(file_path):
                                    file_size = os.path.getsize(file_path)
                                    total_size += file_size
                                    file_count += 1
                            except (PermissionError, OSError):
                                pass
                    except (PermissionError, OSError):
                        pass
            
            print(f"Debug: Database - {file_count} files, {total_size} bytes")
            return total_size if file_count > 0 else 0
            
        except Exception as e:
            print(f"Debug: Database size check error: {e}")
            return 0
    
    def get_biometric_state_hash(self) -> str:
        """Generate hash from current biometric state"""
        try:
            username = os.getenv('USERNAME', 'unknown')
            computer_name = os.getenv('COMPUTERNAME', 'unknown')
            
            print(f"Debug: Starting biometric state hash generation for {username}")
            
            db_size = self.get_database_size()
            state_components = [
                f"db_size_{db_size}",
                f"user_{username}",
                f"computer_{computer_name}"
            ]
            
            try:
                import winreg
                hello_paths = [
                    r"SOFTWARE\Microsoft\Windows\CurrentVersion\WinBio",
                    r"SOFTWARE\Policies\Microsoft\Biometrics"
                ]
                
                for reg_path in hello_paths:
                    try:
                        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, reg_path) as key:
                            info = winreg.QueryInfoKey(key)
                            subkeys_count = info[0]
                            values_count = info[1]
                            state_components.append(f"reg_{reg_path.split('\\')[-1]}_{subkeys_count}_{values_count}")
                    except (FileNotFoundError, PermissionError, OSError):
                        pass
                        
                try:
                    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\WinBio") as key:
                        info = winreg.QueryInfoKey(key)
                        state_components.append(f"user_winbio_{info[0]}_{info[1]}")
                except (FileNotFoundError, PermissionError, OSError):
                    pass
                    
            except ImportError:
                print("winreg not available")
            
            try:
                import subprocess
                result = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq WinBioSrv.exe'], 
                                      capture_output=True, text=True, timeout=5)
                if 'WinBioSrv.exe' in result.stdout:
                    state_components.append("winbio_service_running")
                else:
                    state_components.append("winbio_service_not_running")
            except (subprocess.TimeoutExpired, FileNotFoundError):
                pass
            
            combined_state = "|".join(state_components)
            hash_result = hashlib.sha256(combined_state.encode('utf-8')).hexdigest()
            
            print(f"Debug: State components: {state_components}")
            print(f"Debug: Final hash: {hash_result[:16]}...")
            
            return hash_result
            
        except Exception as e:
            print(f"Error in get_biometric_state_hash: {e}")
            fallback_data = f"error_fallback_{os.getenv('USERNAME', 'unknown')}_{time.time()}"
            return hashlib.sha256(fallback_data.encode()).hexdigest()
    
    def check_for_changes(self):
        """Check if biometric state has changed"""
        current_hash = self.get_biometric_state_hash()
        current_size = self.get_database_size()
        
        return {
            'current_hash': current_hash,
            'current_size': current_size,
            'timestamp': time.time()
        }

class SimpleHTTPHandler(BaseHTTPRequestHandler):
    """Simple HTTP handler for frontend requests"""
    
    def __init__(self, *args, checker=None, **kwargs):
        self.checker = checker
        super().__init__(*args, **kwargs)
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', 'http://localhost:8080')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        if self.path == '/check_state':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', 'http://localhost:8080')
            self.end_headers()
            
            result = self.checker.check_for_changes()
            self.wfile.write(json.dumps(result).encode())
            
        elif self.path == '/check_hello_availability':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', 'http://localhost:8080')
            self.end_headers()
            
            if platform.system() != "Windows":
                result = {
                    'available': False,
                    'message': 'Windows Hello is only available on Windows systems',
                    'platform': platform.system()
                }
            elif not self.checker.winbio:
                result = {
                    'available': False,
                    'message': 'Windows Hello API could not be loaded',
                    'platform': platform.system()
                }
            else:
                try:
                    db_size = self.checker.get_database_size()
                    result = {
                        'available': True,
                        'message': 'Windows Hello checker is available',
                        'platform': platform.system(),
                        'database_size': db_size
                    }
                except Exception as e:
                    result = {
                        'available': False,
                        'message': f'Error checking Windows Hello: {str(e)}',
                        'platform': platform.system()
                    }
            
            self.wfile.write(json.dumps(result).encode())
            
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        pass

def run_checker_server(port=5000):
    """Run the lightweight checker server"""
    checker = WindowsHelloChecker()
    
    def handler(*args, **kwargs):
        SimpleHTTPHandler(*args, checker=checker, **kwargs)
    
    server = HTTPServer(('localhost', port), handler)
    print(f"Windows Hello Checker running on http://localhost:{port}")
    print("Endpoints:")
    print("  GET /check_state - Get current state")
    print("  GET /check_hello_availability - Check Windows Hello availability")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down checker server...")
        server.server_close()

if __name__ == "__main__":
    run_checker_server()