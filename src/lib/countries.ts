export interface Country {
  name: string;
  iso: string;
  dial: string;
  flag: string;
}

// Common country dial codes (UK first / default). Add more as needed.
export const COUNTRIES: Country[] = [
  { name: "United Kingdom", iso: "GB", dial: "+44", flag: "🇬🇧" },
  { name: "Ireland", iso: "IE", dial: "+353", flag: "🇮🇪" },
  { name: "United States", iso: "US", dial: "+1", flag: "🇺🇸" },
  { name: "Canada", iso: "CA", dial: "+1", flag: "🇨🇦" },
  { name: "Australia", iso: "AU", dial: "+61", flag: "🇦🇺" },
  { name: "New Zealand", iso: "NZ", dial: "+64", flag: "🇳🇿" },
  { name: "Germany", iso: "DE", dial: "+49", flag: "🇩🇪" },
  { name: "France", iso: "FR", dial: "+33", flag: "🇫🇷" },
  { name: "Spain", iso: "ES", dial: "+34", flag: "🇪🇸" },
  { name: "Italy", iso: "IT", dial: "+39", flag: "🇮🇹" },
  { name: "Netherlands", iso: "NL", dial: "+31", flag: "🇳🇱" },
  { name: "Belgium", iso: "BE", dial: "+32", flag: "🇧🇪" },
  { name: "Portugal", iso: "PT", dial: "+351", flag: "🇵🇹" },
  { name: "Poland", iso: "PL", dial: "+48", flag: "🇵🇱" },
  { name: "Sweden", iso: "SE", dial: "+46", flag: "🇸🇪" },
  { name: "Norway", iso: "NO", dial: "+47", flag: "🇳🇴" },
  { name: "Denmark", iso: "DK", dial: "+45", flag: "🇩🇰" },
  { name: "Finland", iso: "FI", dial: "+358", flag: "🇫🇮" },
  { name: "Switzerland", iso: "CH", dial: "+41", flag: "🇨🇭" },
  { name: "Austria", iso: "AT", dial: "+43", flag: "🇦🇹" },
  { name: "Greece", iso: "GR", dial: "+30", flag: "🇬🇷" },
  { name: "Romania", iso: "RO", dial: "+40", flag: "🇷🇴" },
  { name: "Czechia", iso: "CZ", dial: "+420", flag: "🇨🇿" },
  { name: "Hungary", iso: "HU", dial: "+36", flag: "🇭🇺" },
  { name: "India", iso: "IN", dial: "+91", flag: "🇮🇳" },
  { name: "Pakistan", iso: "PK", dial: "+92", flag: "🇵🇰" },
  { name: "Bangladesh", iso: "BD", dial: "+880", flag: "🇧🇩" },
  { name: "Nigeria", iso: "NG", dial: "+234", flag: "🇳🇬" },
  { name: "South Africa", iso: "ZA", dial: "+27", flag: "🇿🇦" },
  { name: "Kenya", iso: "KE", dial: "+254", flag: "🇰🇪" },
  { name: "Ghana", iso: "GH", dial: "+233", flag: "🇬🇭" },
  { name: "United Arab Emirates", iso: "AE", dial: "+971", flag: "🇦🇪" },
  { name: "Saudi Arabia", iso: "SA", dial: "+966", flag: "🇸🇦" },
  { name: "China", iso: "CN", dial: "+86", flag: "🇨🇳" },
  { name: "Japan", iso: "JP", dial: "+81", flag: "🇯🇵" },
  { name: "South Korea", iso: "KR", dial: "+82", flag: "🇰🇷" },
  { name: "Singapore", iso: "SG", dial: "+65", flag: "🇸🇬" },
  { name: "Malaysia", iso: "MY", dial: "+60", flag: "🇲🇾" },
  { name: "Hong Kong", iso: "HK", dial: "+852", flag: "🇭🇰" },
  { name: "Philippines", iso: "PH", dial: "+63", flag: "🇵🇭" },
  { name: "Indonesia", iso: "ID", dial: "+62", flag: "🇮🇩" },
  { name: "Brazil", iso: "BR", dial: "+55", flag: "🇧🇷" },
  { name: "Mexico", iso: "MX", dial: "+52", flag: "🇲🇽" },
];
