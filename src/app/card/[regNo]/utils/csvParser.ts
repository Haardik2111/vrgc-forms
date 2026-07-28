import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export interface CsvMember {
  name: string;
  registrationNumber: string;
  phone: string;
  email: string;
  team: string;
  position: string;
}

export async function fetchCsvMembers(): Promise<CsvMember[]> {
  try {
    const colRef = collection(db, 'members');
    const snapshot = await getDocs(colRef);

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        name: data.name || '',
        registrationNumber: data.registrationNumber || data.registration_number || '',
        phone: data.phone || '',
        email: data.email || '',
        team: data.team || '',
        position: data.position || 'Member',
      };
    });
  } catch (err) {
    console.error('Error fetching members from Firestore:', err);
    return [];
  }
}

export function parseMembersCsv(csvText: string): CsvMember[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const nameIdx = headers.findIndex((h) => h.includes('name'));
  const regIdx = headers.findIndex((h) => h.includes('registration'));
  const phoneIdx = headers.findIndex((h) => h.includes('phone'));
  const emailIdx = headers.findIndex((h) => h.includes('email'));
  const teamIdx = headers.findIndex((h) => h.includes('team'));
  const posIdx = headers.findIndex((h) => h.includes('position'));

  const members: CsvMember[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length === 0) continue;

    const regNo = (cols[regIdx] || '').trim();
    if (!regNo) continue;

    members.push({
      name: (cols[nameIdx] || '').trim(),
      registrationNumber: regNo,
      phone: (cols[phoneIdx] || '').trim(),
      email: (cols[emailIdx] || '').trim(),
      team: (cols[teamIdx] || '').trim(),
      position: (cols[posIdx] || '').trim(),
    });
  }

  return members;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
