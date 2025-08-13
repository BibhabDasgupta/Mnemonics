// --- File: src/services/authService.ts ---
export interface LoginData {
  customer_id: string;
  last_login: string;
  login_location?: string;
  device_info?: string;
}

export class AuthService {
  private static readonly STORAGE_KEY = 'glow_bank_login_data';
  
  // Store login data when user successfully logs in
  static storeLoginData(loginData: LoginData): void {
    const dataToStore = {
      ...loginData,
      current_session_start: new Date().toISOString()
    };
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToStore));
    console.log('🔐 [AuthService] Login data stored:', dataToStore);
  }
  
  // Get last login time
  static getLastLoginTime(): string | null {
    try {
      const storedData = localStorage.getItem(this.STORAGE_KEY);
      if (storedData) {
        const loginData = JSON.parse(storedData);
        return loginData.last_login || loginData.current_session_start;
      }
    } catch (error) {
      console.error('🔐 [AuthService] Error getting login data:', error);
    }
    return null;
  }
  
  // Get current session start time
  static getCurrentSessionStart(): string | null {
    try {
      const storedData = localStorage.getItem(this.STORAGE_KEY);
      if (storedData) {
        const loginData = JSON.parse(storedData);
        return loginData.current_session_start;
      }
    } catch (error) {
      console.error('🔐 [AuthService] Error getting session data:', error);
    }
    return null;
  }
  
  // Get stored login location
  static getLoginLocation(): string | null {
    try {
      const storedData = localStorage.getItem(this.STORAGE_KEY);
      if (storedData) {
        const loginData = JSON.parse(storedData);
        return loginData.login_location;
      }
    } catch (error) {
      console.error('🔐 [AuthService] Error getting login location:', error);
    }
    return null;
  }
  
  // Clear login data on logout
  static clearLoginData(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('🔐 [AuthService] Login data cleared');
  }
}