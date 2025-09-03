import os
import hashlib
import json
import ctypes
from ctypes import wintypes
import platform
import time
import subprocess
import re
from http.server import HTTPServer, BaseHTTPRequestHandler

class BiometricChecker:
    """Cross-platform biometric state checker for Windows Hello and macOS Touch ID"""

    def __init__(self):
        """Initializes the checker based on the current operating system."""
        self.os_type = platform.system()
        self.winbio = None
        
        print(f"Initializing checker for platform: {self.os_type}")
        
        if self.os_type == "Windows":
            self._setup_windows_bio()

    def _setup_windows_bio(self):
        """Loads the winbio.dll for Windows Biometric Framework operations."""
        if self.os_type != "Windows":
            return
        try:
            self.winbio = ctypes.WinDLL("winbio.dll")
            print("Successfully loaded winbio.dll for Windows Hello.")
        except (OSError, Exception) as e:
            print(f"Warning: Could not load or setup winbio.dll: {e}")

    def _get_windows_db_size(self) -> int:
        """
        Calculates the total size of Windows biometric database files.
        This is one of the components for the state hash on Windows.
        """
        try:
            biometric_path = r"C:\Windows\System32\WinBioDatabase"
            total_size = 0
            file_count = 0
            
            if os.path.exists(biometric_path) and os.path.isdir(biometric_path):
                try:
                    for file in os.listdir(biometric_path):
                        try:
                            file_path = os.path.join(biometric_path, file)
                            if os.path.isfile(file_path):
                                total_size += os.path.getsize(file_path)
                                file_count += 1
                        except (PermissionError, OSError):
                            continue # Skip files we can't access
                except (PermissionError, OSError):
                    pass # Skip directories we can't access
            
            print(f"Debug (Windows): Database - {file_count} files, {total_size} bytes")
            return total_size
        except Exception as e:
            print(f"Debug (Windows): Database size check error: {e}")
            return 0

    def _get_windows_state(self) -> dict:
        """Collects various biometric state indicators on Windows."""
        state = {}
        state['db_size_bytes'] = self._get_windows_db_size()

        # Check if the Windows Biometric Service is running
        try:
            result = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq WinBioSrv.exe'],
                                    capture_output=True, text=True, timeout=5)
            state['service_running'] = 'WinBioSrv.exe' in result.stdout
        except (subprocess.TimeoutExpired, FileNotFoundError):
            state['service_running'] = False

        # Check for the existence and content of relevant registry keys
        try:
            import winreg
            reg_paths = {
                'hklm_winbio': (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\WinBio"),
                'hkcu_winbio': (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\WinBio"),
            }
            for name, (hive, path) in reg_paths.items():
                try:
                    with winreg.OpenKey(hive, path) as key:
                        info = winreg.QueryInfoKey(key)
                        state[f'reg_{name}_subkeys'] = info[0]
                        state[f'reg_{name}_values'] = info[1]
                except (FileNotFoundError, PermissionError, OSError):
                    state[f'reg_{name}_exists'] = False
        except ImportError:
            state['registry_check_failed'] = True
            
        return state

    def _get_macos_state(self) -> dict:
        """Collects biometric state on macOS using the 'bioutil' command."""
        state = {}
        try:
            # Execute 'bioutil -c' to check for enrolled biometric templates
            result = subprocess.run(
                ['bioutil', '-c'],
                capture_output=True, text=True, timeout=5, check=False
            )
            output = result.stdout.strip()
            
            if result.returncode == 0:
                # Parse the output to find the number of templates
                match = re.search(r'(\d+)\s+biometric\s+template\(s\)', output)
                state['template_count'] = int(match.group(1)) if match else 0
                print(f"Debug (macOS): Found {state['template_count']} templates.")
            else:
                state['template_count'] = -1 # Indicate command failure
                state['bioutil_error'] = result.stderr.strip()
                print(f"Debug (macOS): bioutil command failed: {state['bioutil_error']}")

        except (FileNotFoundError, subprocess.TimeoutExpired) as e:
            state['template_count'] = -1
            state['bioutil_error'] = f"Command could not be run: {str(e)}"
            print(f"Debug (macOS): Error executing bioutil: {e}")
            
        return state

    def get_biometric_state_hash(self) -> str:
        """
        Generates a SHA256 hash from the current biometric state for the detected OS.
        This hash changes if the underlying biometric configuration is modified.
        """
        try:
            username = os.getenv('USERNAME') or os.getenv('USER', 'unknown')
            computer_name = os.getenv('COMPUTERNAME') or platform.node() or 'unknown'

            if self.os_type == "Windows":
                state_data = self._get_windows_state()
            elif self.os_type == "Darwin":
                state_data = self._get_macos_state()
            else:
                state_data = {'status': 'unsupported_os'}

            state_components = [
                f"os_{self.os_type}",
                f"user_{username}",
                f"computer_{computer_name}"
            ]

            # Sort the state data by key to ensure the hash is consistent
            for key, value in sorted(state_data.items()):
                state_components.append(f"{key}_{value}")

            combined_state = "|".join(state_components)
            hash_result = hashlib.sha256(combined_state.encode('utf-8')).hexdigest()
            
            print(f"Debug: State components for hash: {state_components}")
            print(f"Debug: Final hash: {hash_result[:16]}...")
            return hash_result

        except Exception as e:
            print(f"Error in get_biometric_state_hash: {e}")
            fallback_data = f"error_fallback_{username}_{time.time()}"
            return hashlib.sha256(fallback_data.encode()).hexdigest()
    
    def get_primary_metric(self) -> int:
        """Gets a primary, human-readable metric of biometric data."""
        if self.os_type == "Windows":
            return self._get_windows_db_size()
        elif self.os_type == "Darwin":
            state = self._get_macos_state()
            return state.get('template_count', 0)
        return 0

    def check_for_changes(self) -> dict:
        """Returns the current state hash and a primary metric."""
        current_hash = self.get_biometric_state_hash()
        primary_metric = self.get_primary_metric()
        
        metric_name = 'unknown'
        if self.os_type == 'Windows':
            metric_name = 'database_size_bytes'
        elif self.os_type == 'Darwin':
            metric_name = 'template_count'

        return {
            'current_hash': current_hash,
            'primary_metric_name': metric_name,
            'primary_metric_value': primary_metric,
            'timestamp': time.time()
        }

    def check_availability(self) -> dict:
        """Checks if the biometric checker is available and operational on the current OS."""
        if self.os_type == "Windows":
            return {
                'available': self.winbio is not None,
                'message': 'Windows Hello/TouchID checker is available.' if self.winbio else 'Windows Hello/TouchID API (winbio.dll) could not be loaded.',
                'platform': self.os_type
            }
        elif self.os_type == "Darwin":
            try:
                # Check if bioutil command exists and is executable by running a safe, read-only command
                subprocess.run(['bioutil', '-r'], check=True, capture_output=True, timeout=2)
                return {
                    'available': True,
                    'message': 'macOS Touch ID checker (bioutil) is available.',
                    'platform': self.os_type
                }
            except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
                 return {
                    'available': False,
                    'message': f'macOS Touch ID utility (bioutil) not found or failed to run. Error: {e}',
                    'platform': self.os_type
                }
        else:
            return {
                'available': False,
                'message': f'Biometric checking is not supported on this platform ({self.os_type}).',
                'platform': self.os_type
            }

class SimpleHTTPHandler(BaseHTTPRequestHandler):
    """Simple HTTP handler to serve API requests from a frontend."""
    
    def __init__(self, *args, checker=None, **kwargs):
        self.checker = checker
        super().__init__(*args, **kwargs)
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests for development."""
        self.send_response(204) # No Content
        self.send_header('Access-Control-Allow-Origin', '*') # Allow all origins for simplicity
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        """Handles GET requests for the API endpoints."""
        if self.path == '/check_state':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            result = self.checker.check_for_changes()
            self.wfile.write(json.dumps(result).encode())
            
        elif self.path == '/check_availability':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            result = self.checker.check_availability()
            self.wfile.write(json.dumps(result).encode())
            
        else:
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Endpoint not found'}).encode())
    
    def log_message(self, format, *args):
        """Suppress default server logging to keep the console clean."""
        return

def run_checker_server(port=5050):
    """Initializes and runs the lightweight checker server."""
    checker = BiometricChecker()
    
    # Factory function to pass the checker instance to the handler
    def handler_factory(*args, **kwargs):
        SimpleHTTPHandler(*args, checker=checker, **kwargs)
    
    try:
        server = HTTPServer(('localhost', port), handler_factory)
        os_name = "macOS (Touch ID)" if platform.system() == "Darwin" else platform.system()
        print(f"Biometric Checker server running for {os_name} on http://localhost:{port}")
        print("Endpoints:")
        print("  GET /check_state          - Get current biometric state hash and metric")
        print("  GET /check_availability   - Check if biometric checker is available for the OS")
        print("\nPress Ctrl+C to shut down the server.")
        server.serve_forever()
    except OSError as e:
        print(f"\nERROR: Could not start server on port {port}. It might be in use. ({e})")
    except KeyboardInterrupt:
        print("\nShutting down checker server...")
        server.server_close()

if __name__ == "__main__":
    run_checker_server()