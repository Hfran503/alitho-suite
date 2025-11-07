import { JSDOM } from 'jsdom';

export interface AtlassianEmployeeData {
  // Name fields
  firstName?: string;
  lastName?: string;
  printName?: string; // First name only for labels
  fullName?: string;

  // Contact fields
  personalEmail?: string;
  workEmail?: string;
  phoneNumber?: string;

  // Address fields
  address1?: string;
  address2?: string;
  address3?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  countryCategory?: string; // Philippines, Australia, India, United States of America, International US

  // Employment fields
  startDate?: string;
  manager?: string;
  department?: string;
  location?: string;

  // Metadata
  hasAddress: boolean;
  isAddressMissing: boolean;
}

export interface ParsedAtlassianEmail {
  employeeData: AtlassianEmployeeData;
  rawFields: Record<string, string>;
  extractedFrom: 'html' | 'subject' | 'mixed';
}

/**
 * Check if address is missing or a placeholder
 */
function isAddressMissing(address?: string): boolean {
  if (!address || address.trim() === '') return true;

  const placeholderPatterns = [
    /\[address to be confirmed in workday prior to start date\]/i,
    /\[not available\]/i,
    /\[to be confirmed\]/i,
    /\[pending\]/i,
    /\[tbd\]/i,
    /to be determined/i,
    /n\/a/i,
  ];

  const trimmedAddress = address.trim();
  return placeholderPatterns.some((pattern) => pattern.test(trimmedAddress));
}

/**
 * Convert HTML to text with line breaks preserved
 */
function htmlToTextWithLineBreaks(htmlString: string): string {
  // Replace <br> tags with newlines
  let text = htmlString.replace(/<br\s*\/?>/gi, '\n');
  // Replace closing block tags with newlines
  text = text.replace(/<\/(p|div|li|tr|td|h[1-6])>/gi, '\n');

  // Use JSDOM to parse HTML and extract text
  const dom = new JSDOM(text);
  return dom.window.document.body.textContent || '';
}

/**
 * Extract name from email subject (e.g., "Atlassian Welcome Packet For _ Name" or "For : Name")
 */
function extractNameFromSubject(subject: string): { fullName: string; firstName: string; lastName: string; printName: string } | null {
  // Remove FW:, RE:, etc. prefixes
  let cleanSubject = subject.replace(/^(FW|RE|FWD):\s*/i, '').trim();

  const patterns = [
    /Atlassian Welcome Packet For\s*[_:]\s*(.+?)$/i,  // Handles both "For _ Name" and "For : Name"
    /Welcome Packet For\s*[_:]\s*(.+?)$/i,
    /Welcome (.+?) to Atlassian/i,
  ];

  for (const pattern of patterns) {
    const match = cleanSubject.match(pattern);
    if (match) {
      // Clean up the full name - remove leading colons or underscores
      const fullName = match[1].trim().replace(/^[_:]\s*/, '');
      const nameParts = fullName.split(/\s+/).filter(part => part.length > 0);

      return {
        fullName,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        printName: nameParts[0] || '', // First name for labels
      };
    }
  }

  return null;
}

/**
 * Normalize country name and determine category
 */
function categorizeCountry(country?: string): string {
  if (!country) return 'International US';

  const normalized = country.trim().toLowerCase();

  const countryCategories: Record<string, string> = {
    philippines: 'Philippines',
    australia: 'Australia',
    india: 'India',
    'united states of america': 'United States of America',
    'united states': 'United States of America',
    usa: 'United States of America',
    us: 'United States of America',
  };

  return countryCategories[normalized] || 'International US';
}

/**
 * Parse HTML email body to extract key-value pairs
 */
function extractFieldsFromHtml(htmlBody: string): Record<string, string> {
  const rawText = htmlToTextWithLineBreaks(htmlBody);
  const lines = rawText.split(/\r?\n/);

  const fields: Record<string, string> = {};

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Match "Key: Value" pattern
    const match = line.match(/^(.*?):\s*(.*)$/);
    if (match) {
      let key = match[1].trim();
      let value = match[2].trim();

      // Skip certain fields
      if (key.toLowerCase().includes('caution')) continue;

      // Clean up [Not Available] placeholders
      if (value.toLowerCase() === '[not available]') {
        value = '';
      }

      fields[key] = value;
    }
  }

  return fields;
}

/**
 * Map extracted fields to AtlassianEmployeeData structure
 */
function mapFieldsToEmployeeData(
  fields: Record<string, string>,
  nameFromSubject?: { fullName: string; firstName: string; lastName: string; printName: string } | null
): AtlassianEmployeeData {
  // Extract name fields - prefer subject parsing, fallback to HTML fields
  let firstName = fields['First Name'] || nameFromSubject?.firstName || '';
  let lastName = fields['Last Name'] || nameFromSubject?.lastName || '';
  const fullName = nameFromSubject?.fullName || `${firstName} ${lastName}`.trim();

  // Create print name - ALWAYS use first word of the full name from subject, or first word of firstName
  // This ensures we get just "Prageeth" even if firstName is "Prageeth Harshapriya"
  let printName = '';
  if (nameFromSubject?.fullName) {
    // Use first word from the subject-parsed full name (most reliable)
    const firstWord = nameFromSubject.fullName.split(/\s+/)[0];
    printName = firstWord || '';
  } else if (firstName) {
    // Fallback: use first word of firstName field
    printName = firstName.split(/\s+/).filter(w => w.length > 0)[0] || '';
  }

  // Address fields
  const address1 = fields['Address1'] || fields['Address 1'] || fields['Street Address'] || '';
  const address2 = fields['Address2'] || fields['Address 2'] || '';
  const address3 = fields['Address3'] || fields['Address 3'] || '';

  // Clean up placeholder addresses
  const cleanAddress1 = isAddressMissing(address1) ? '' : address1;

  // Determine country
  const country = fields['Country'] || '';
  const countryCategory = categorizeCountry(country);

  const employeeData: AtlassianEmployeeData = {
    // Name
    firstName,
    lastName,
    printName,
    fullName,

    // Contact
    personalEmail: fields['Personal Email'] || fields['Email'] || '',
    workEmail: fields['Work Email'] || fields['Atlassian Email'] || '',
    phoneNumber: fields['Phone Number'] || fields['Phone'] || fields['Mobile'] || '',

    // Address
    address1: cleanAddress1,
    address2,
    address3,
    city: fields['City'] || '',
    state: fields['State'] || fields['State/Province'] || '',
    zipCode: fields['Zip Code'] || fields['ZIP'] || fields['Postal Code'] || '',
    country,
    countryCategory,

    // Employment
    startDate: fields['Start Date'] || '',
    manager: fields['Manager'] || '',
    department: fields['Department'] || '',
    location: fields['Location'] || fields['Office'] || '',

    // Metadata
    hasAddress: !isAddressMissing(cleanAddress1),
    isAddressMissing: isAddressMissing(cleanAddress1),
  };

  return employeeData;
}

/**
 * Main parser function to extract Atlassian employee data from HTML email
 */
export function parseAtlassianEmail(htmlBody: string, subject?: string): ParsedAtlassianEmail {
  // Extract name from subject if available
  const nameFromSubject = subject ? extractNameFromSubject(subject) : null;

  // Extract fields from HTML
  const rawFields = extractFieldsFromHtml(htmlBody);

  // Map to employee data structure
  const employeeData = mapFieldsToEmployeeData(rawFields, nameFromSubject);

  return {
    employeeData,
    rawFields,
    extractedFrom: nameFromSubject ? 'mixed' : 'html',
  };
}

/**
 * Group employee data by country category for reporting
 */
export function groupByCountry(employees: AtlassianEmployeeData[]): Record<string, AtlassianEmployeeData[]> {
  const groups: Record<string, AtlassianEmployeeData[]> = {
    Philippines: [],
    Australia: [],
    India: [],
    'United States of America': [],
    'International US': [],
  };

  for (const employee of employees) {
    const category = employee.countryCategory || 'International US';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(employee);
  }

  return groups;
}

/**
 * Separate valid addresses from missing addresses
 */
export function separateByAddressStatus(employees: AtlassianEmployeeData[]): {
  valid: AtlassianEmployeeData[];
  missing: AtlassianEmployeeData[];
} {
  return {
    valid: employees.filter((e) => !e.isAddressMissing),
    missing: employees.filter((e) => e.isAddressMissing),
  };
}

/**
 * Generate summary statistics
 */
export function generateSummary(employees: AtlassianEmployeeData[]): Array<{ group: string; count: number }> {
  const grouped = groupByCountry(employees);
  const { missing } = separateByAddressStatus(employees);

  const summary = Object.entries(grouped).map(([group, items]) => ({
    group,
    count: items.length,
  }));

  summary.push({
    group: 'Missing (no Address1)',
    count: missing.length,
  });

  return summary;
}
