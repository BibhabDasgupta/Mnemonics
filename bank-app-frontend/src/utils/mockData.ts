export interface SimData {
  carrierName: string;
  imsi: string;
}

export interface PhoneData {
  deviceId: string;
  model: string;
}

export interface MockData {
  simData: SimData;
  phoneData: PhoneData;
}

const MOCK_DATABASE: Record<string, MockData> = {
  "+919330377736": {
    simData: { carrierName: "Jio", imsi: "405857123456789" },
    phoneData: { deviceId: "DEVICE123", model: "Samsung Galaxy S21" },
  },
  "+919239257752": {
    simData: { carrierName: "Airtel", imsi: "405856987654321" },
    phoneData: { deviceId: "DEVICE456", model: "iPhone 13" },
  },
  "+919068265551": {
    simData: { carrierName: "Airtel", imsi: "405856987654322" },
    phoneData: { deviceId: "DEVICE456", model: "iPhone 13" },
  },
};

export const getMockData = (phoneNumber: string): MockData | null => {
  return MOCK_DATABASE[phoneNumber] || null;
};